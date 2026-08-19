const { client, model } = require('./llmClient');

const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A failure is worth retrying only if trying again could plausibly help:
// no status at all (timeout / connection error), 429 (rate limited), or a
// 5xx (the provider is having a bad time). A 400/401/403/404 will still
// be exactly the same error a second later — retrying those just burns
// time and, on a metered API, quota.
function isRetryable(err) {
  const status = err?.status;
  return status === undefined || status === 429 || (status >= 500 && status < 600);
}

// Wraps one chat completion call with our own timeout + retry policy,
// instead of the SDK's defaults. Returns { completion, attempts, timedOut }.
async function callWithRetry(messages, { timeoutMs = 30_000, temperature = 0.2 } = {}) {
  let attempt = 0;
  let lastErr;

  while (attempt <= MAX_RETRIES) {
    attempt += 1;
    try {
      const completion = await client.chat.completions.create(
        { model, temperature, messages },
        { timeout: timeoutMs }
      );
      return { completion, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt > MAX_RETRIES) break;
      const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 300;
      await sleep(backoffMs);
    }
  }

  throw lastErr;
}

module.exports = { callWithRetry, isRetryable };
