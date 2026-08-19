const OpenAI = require('openai');

const baseURL = process.env.LLM_BASE_URL;
const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;

if (!baseURL || !apiKey || !model) {
  console.error("ERR: can't find LLM_BASE_URL / LLM_API_KEY / LLM_MODEL environment variables!");
  process.exit(1);
}

// The SDK defaults to a 10-minute timeout and 2 silent built-in retries —
// wrong for an HTTP endpoint that itself needs to answer in seconds.
// We set our own bounds here and do our own retry logic (callWithRetry.js)
// so we control exactly which failures get retried.
const client = new OpenAI({ baseURL, apiKey, timeout: 30_000, maxRetries: 0 });

module.exports = { client, model };
