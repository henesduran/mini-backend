const express = require('express');
const { EnrichRequest } = require('./enrichSchema');

const router = express.Router();

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

  // Stage 2 adds the real model call here.
  return res.status(501).json({ error: 'model call not implemented yet' });
});

module.exports = router;
