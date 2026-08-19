const fs = require('fs');
const path = require('path');
const stats = require('./stats');

const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/henesduran/mini-backend)';
const TIMEOUT_MS = 10_000;
const REQUEST_DELAY_MS = 500;
const RETRY_DELAY_MS = 1_500;
const CACHE_DIR = path.join(__dirname, '..', 'cache');

class FetchError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = 'FetchError';
    this.status = status; // undefined for a timeout / network failure
    this.url = url;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePathFor(cacheName) {
  return path.join(CACHE_DIR, `${cacheName}.html`);
}

// One real HTTP GET, no retry, no cache lookup — the thing that either
// succeeds or throws a FetchError.
async function requestOnce(url) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } catch (err) {
    throw new FetchError(`request failed or timed out: ${err.message}`, undefined, url);
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (response.status !== 200) {
    throw new FetchError(`unexpected status ${response.status}`, response.status, url);
  }

  return response.text();
}

// A failed request is worth one retry only if trying again could plausibly
// help: a timeout/network blip, or the server saying "I'm overloaded"
// (5xx). A 404 will still be a 404 in a second, and retrying a 403 is how
// a polite robot turns into a pest — so those fail immediately.
function isRetryable(err) {
  return err.status === undefined || err.status >= 500;
}

// Downloads `url` (with a real user-agent, a timeout, a status check, and
// one retry on a timeout/5xx) unless a cached copy already exists under
// scraper/cache/<cacheName>.html, in which case that copy is read instead
// and the site is never touched.
async function fetchPage(url, cacheName) {
  const cachePath = cachePathFor(cacheName);

  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, 'utf8');
    console.log(`CACHE HIT  ${url}  (${html.length} bytes)`);
    stats.cacheHits += 1;
    return { html, fromCache: true };
  }

  let html;
  try {
    html = await requestOnce(url);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    console.log(`RETRY      ${url}  (${err.message})`);
    await sleep(RETRY_DELAY_MS);
    html = await requestOnce(url); // if this one also fails, we let it throw
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, html, 'utf8');
  console.log(`FETCH      ${url}  (${html.length} bytes)`);
  stats.pagesFetched += 1;

  // Politeness delay — only for requests that actually left the machine.
  await sleep(REQUEST_DELAY_MS);

  return { html, fromCache: false };
}

module.exports = { fetchPage, FetchError, USER_AGENT };
