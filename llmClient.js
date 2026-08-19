const OpenAI = require('openai');

const baseURL = process.env.LLM_BASE_URL;
const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;

if (!baseURL || !apiKey || !model) {
  console.error("ERR: can't find LLM_BASE_URL / LLM_API_KEY / LLM_MODEL environment variables!");
  process.exit(1);
}

// timeout/maxRetries are overridden per-call in enrichRoute.js (Stage 4) —
// the SDK default (10 minute timeout, 2 silent retries) is wrong for an
// HTTP endpoint.
const client = new OpenAI({ baseURL, apiKey });

module.exports = { client, model };
