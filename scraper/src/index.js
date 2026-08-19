const fs = require('fs');
const path = require('path');
const { discoverCatalogue } = require('./discoverCatalogue');
const { extractBook } = require('./extractBook');
const { parsePriceGbp } = require('./normalize');
const { BookRecord } = require('./schema');
const stats = require('./stats');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
// Deliberately non-existent — used to prove a single broken page cannot
// take the whole run down. Toggle with SCRAPER_INJECT_FAKE=1.
const FAKE_BOOK_URL = 'https://books.toscrape.com/catalogue/this-book-does-not-exist_9999/index.html';

async function main() {
  const startedAt = new Date();

  const { uniqueBookUrls, sourcePageByBookUrl } = await discoverCatalogue();
  const bookUrls = process.env.SCRAPER_INJECT_FAKE === '1' ? [...uniqueBookUrls, FAKE_BOOK_URL] : uniqueBookUrls;

  const validByUrl = new Map(); // product_url -> record; a Map can't hold duplicates
  const validationErrors = [];
  const failedPages = [];

  for (const bookUrl of bookUrls) {
    let raw;
    try {
      raw = await extractBook(bookUrl, sourcePageByBookUrl.get(bookUrl) ?? 'unknown');
    } catch (err) {
      // One broken page is logged and skipped — it never takes the run down.
      failedPages.push({ url: bookUrl, reason: err.message });
      continue;
    }

    const candidate = { ...raw, price_gbp: parsePriceGbp(raw.price_text) };
    const result = BookRecord.safeParse(candidate);
    if (result.success) {
      validByUrl.set(result.data.product_url, result.data);
    } else {
      validationErrors.push({ product_url: bookUrl, reason: result.error.issues.map((i) => i.message).join('; ') });
    }
  }

  const records = [...validByUrl.values()];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'books.json'), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'errors.json'), JSON.stringify(validationErrors, null, 2));

  const finishedAt = new Date();
  const runReport = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt - startedAt,
    pages_fetched: stats.pagesFetched,
    cache_hits: stats.cacheHits,
    valid_records: records.length,
    invalid_records: validationErrors.length,
    failed_pages: failedPages.length,
    failed_page_details: failedPages,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'run-report.json'), JSON.stringify(runReport, null, 2));

  console.log(
    `valid=${records.length} invalid=${validationErrors.length} failed_pages=${failedPages.length} ` +
      `pages_fetched=${stats.pagesFetched} cache_hits=${stats.cacheHits} duration_ms=${runReport.duration_ms}`
  );
}

main();
