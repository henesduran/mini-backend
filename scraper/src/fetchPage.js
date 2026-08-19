const fs = require('fs');
const path = require('path');

const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/henesduran/mini-backend)';
const TIMEOUT_MS = 10_000;
const REQUEST_DELAY_MS = 500;
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

// Downloads `url` (with a real user-agent, a timeout, and a status check)
// unless a cached copy already exists under scraper/cache/<cacheName>.html,
// in which case that copy is read instead and the site is never touched.
async function fetchPage(url, cacheName) {
  const cachePath = cachePathFor(cacheName);

  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, 'utf8');
    console.log(`CACHE HIT  ${url}  (${html.length} bytes)`);
    return { html, fromCache: true };
  }

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

  const html = await response.text();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, html, 'utf8');
  console.log(`FETCH      ${url}  (${html.length} bytes)`);

  // Politeness delay — only for requests that actually left the machine.
  await sleep(REQUEST_DELAY_MS);

  return { html, fromCache: false };
}

module.exports = { fetchPage, FetchError, USER_AGENT };
