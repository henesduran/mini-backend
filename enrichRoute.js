const express = require('express');
const fs = require('fs');
const path = require('path');
const { EnrichRequest, EnrichResponse } = require('./enrichSchema');
const { client, model } = require('./llmClient');
const { extractJson } = require('./parseModelJson');

const router = express.Router();

const PROMPT_VERSION = 'enrich-v1';
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', `${PROMPT_VERSION}.md`), 'utf8');

const LOGS_DIR = path.join(__dirname, 'logs');
const QUARANTINE_PATH = path.join(LOGS_DIR, 'quarantine.jsonl');

const STUB_RESPONSE = {
  category: 'fiction',
  summary: 'A stubbed response — no model was called.',
  quality_flags: [],
  confidence: 0.42,
};

function quarantine(entry) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.appendFileSync(QUARANTINE_PATH, JSON.stringify({ ...entry, quarantined_at: new Date().toISOString() }) + '\n');
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

  const userMessage = { role: 'user', content: JSON.stringify(input) };

  // Attempt 1.
  const first = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, userMessage],
  });
  const firstText = first.choices[0].message.content;
  let candidate = extractJson(firstText);
  let validation = candidate ? EnrichResponse.safeParse(candidate) : null;

  if (validation?.success) {
    return res.status(200).json(validation.data);
  }

  // Repair attempt — hand the model its own broken output and the exact
  // validation error, ask once for a corrected version. This is not a
  // second independent try; it's a targeted fix.
  const failureReason = validation ? JSON.stringify(validation.error.issues) : 'response was not valid JSON';
  const repair = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      userMessage,
      { role: 'assistant', content: firstText },
      {
        role: 'user',
        content: `Your previous answer was rejected for this reason: ${failureReason}. Return only corrected JSON matching the schema — no code fence, no commentary.`,
      },
    ],
  });
  const repairText = repair.choices[0].message.content;
  candidate = extractJson(repairText);
  validation = candidate ? EnrichResponse.safeParse(candidate) : null;

  if (validation?.success) {
    return res.status(200).json(validation.data);
  }

  quarantine({
    prompt_version: PROMPT_VERSION,
    input,
    first_response: firstText,
    repair_response: repairText,
    final_error: validation ? validation.error.issues : 'response was not valid JSON',
  });
  return res.status(422).json({ error: 'model could not produce a valid enrichment for this input' });
});

module.exports = router;
