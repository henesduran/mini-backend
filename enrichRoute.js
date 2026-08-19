const express = require('express');
const fs = require('fs');
const path = require('path');
const { EnrichRequest, EnrichResponse } = require('./enrichSchema');
const { callWithRetry } = require('./callWithRetry');
const { extractJson } = require('./parseModelJson');

const router = express.Router();

const PROMPT_VERSION = 'enrich-v1';
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', `${PROMPT_VERSION}.md`), 'utf8');
const TIMEOUT_MS = 30_000;

const LOGS_DIR = path.join(__dirname, 'logs');
const QUARANTINE_PATH = path.join(LOGS_DIR, 'quarantine.jsonl');
const COST_LOG_PATH = path.join(LOGS_DIR, 'cost.jsonl');

const STUB_RESPONSE = {
  category: 'fiction',
  summary: 'A stubbed response — no model was called.',
  quality_flags: [],
  confidence: 0.42,
};

function appendLog(filePath, entry) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
}

function logCost({ model, inputTokens, outputTokens, durationMs, repaired }) {
  const entry = {
    ts: new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: durationMs,
    repaired,
  };
  console.log(`[llm-cost] ${JSON.stringify(entry)}`);
  appendLog(COST_LOG_PATH, entry);
}

router.post('/enrich', async (req, res) => {
  const parsedInput = EnrichRequest.safeParse(req.body);
  if (!parsedInput.success) {
    const firstIssue = parsedInput.error.issues[0];
    return res.status(400).json({ error: `${firstIssue.path.join('.')}: ${firstIssue.message}` });
  }
  const input = parsedInput.data;

  if (process.env.LLM_STUB === '1') {
    return res.status(200).json(STUB_RESPONSE);
  }

  // Kill switch — a way to turn the model off without a deploy, for the
  // day the provider is down, the bill spikes, or the model needs
  // pulling for review. We refuse cleanly rather than fabricate an
  // answer, since a made-up category would silently corrupt data.
  if (process.env.LLM_ENABLED === 'false') {
    return res.status(503).json({ error: 'enrichment is temporarily disabled' });
  }

  const startedAt = Date.now();
  const userMessage = { role: 'user', content: JSON.stringify(input) };

  let first;
  try {
    first = await callWithRetry([{ role: 'system', content: SYSTEM_PROMPT }, userMessage], { timeoutMs: TIMEOUT_MS });
  } catch (err) {
    return handleModelError(res, err);
  }

  const firstText = first.completion.choices[0].message.content;
  let candidate = extractJson(firstText);
  let validation = candidate ? EnrichResponse.safeParse(candidate) : null;

  if (validation?.success) {
    logCost({
      model: first.completion.model,
      inputTokens: first.completion.usage?.prompt_tokens,
      outputTokens: first.completion.usage?.completion_tokens,
      durationMs: Date.now() - startedAt,
      repaired: false,
    });
    return res.status(200).json(validation.data);
  }

  // Repair attempt — hand the model its own broken output and the exact
  // validation error, ask once for a corrected version.
  const failureReason = validation ? JSON.stringify(validation.error.issues) : 'response was not valid JSON';
  let repair;
  try {
    repair = await callWithRetry(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        userMessage,
        { role: 'assistant', content: firstText },
        {
          role: 'user',
          content: `Your previous answer was rejected for this reason: ${failureReason}. Return only corrected JSON matching the schema — no code fence, no commentary.`,
        },
      ],
      { timeoutMs: TIMEOUT_MS }
    );
  } catch (err) {
    return handleModelError(res, err);
  }

  const repairText = repair.completion.choices[0].message.content;
  candidate = extractJson(repairText);
  validation = candidate ? EnrichResponse.safeParse(candidate) : null;

  const totalOutputTokens =
    (first.completion.usage?.completion_tokens ?? 0) + (repair.completion.usage?.completion_tokens ?? 0);
  const totalInputTokens = (first.completion.usage?.prompt_tokens ?? 0) + (repair.completion.usage?.prompt_tokens ?? 0);

  if (validation?.success) {
    logCost({
      model: repair.completion.model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs: Date.now() - startedAt,
      repaired: true,
    });
    return res.status(200).json(validation.data);
  }

  logCost({
    model: repair.completion.model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    durationMs: Date.now() - startedAt,
    repaired: true,
  });
  appendLog(QUARANTINE_PATH, {
    quarantined_at: new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
    input,
    first_response: firstText,
    repair_response: repairText,
    final_error: validation ? validation.error.issues : 'response was not valid JSON',
  });
  return res.status(422).json({ error: 'model could not produce a valid enrichment for this input' });
});

// Never return raw model text or a raw SDK error to the caller — map
// everything to one of two clear outcomes.
function handleModelError(res, err) {
  const isConnectionIssue = err?.status === undefined; // includes timeouts
  if (isConnectionIssue) {
    return res.status(504).json({ error: 'the model did not respond in time' });
  }
  return res.status(502).json({ error: 'the model provider returned an error' });
}

module.exports = router;
