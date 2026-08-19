const express = require('express');
const fs = require('fs');
const path = require('path');
const { EnrichRequest } = require('./enrichSchema');
const { client, model } = require('./llmClient');

const router = express.Router();

const PROMPT_VERSION = 'enrich-v1';
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', `${PROMPT_VERSION}.md`), 'utf8');

const STUB_RESPONSE = {
  category: 'fiction',
  summary: 'A stubbed response — no model was called.',
  quality_flags: [],
  confidence: 0.42,
};

router.post('/enrich', async (req, res) => {
  const parsedInput = EnrichRequest.safeParse(req.body);
  if (!parsedInput.success) {
    const firstIssue = parsedInput.error.issues[0];
    return res.status(400).json({ error: `${firstIssue.path.join('.')}: ${firstIssue.message}` });
  }

  if (process.env.LLM_STUB === '1') {
    return res.status(200).json(STUB_RESPONSE);
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(parsedInput.data) },
    ],
  });

  const rawText = completion.choices[0].message.content;

  // Stage 3 adds parsing + schema validation + repair here. For now,
  // this is deliberately the raw model text so we can eyeball its shape.
  return res.status(200).json({ raw: rawText });
});

module.exports = router;
