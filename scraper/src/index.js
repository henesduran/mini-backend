const fs = require('fs');
const path = require('path');
const { discoverCatalogue } = require('./discoverCatalogue');
const { extractBook } = require('./extractBook');
const { parsePriceGbp } = require('./normalize');
const { BookRecord } = require('./schema');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

async function main() {
  const { uniqueBookUrls, sourcePageByBookUrl } = await discoverCatalogue();

  const validByUrl = new Map(); // product_url -> record; a Map can't hold duplicates
  const errors = [];

  for (const bookUrl of uniqueBookUrls) {
    const raw = await extractBook(bookUrl, sourcePageByBookUrl.get(bookUrl));
    const candidate = { ...raw, price_gbp: parsePriceGbp(raw.price_text) };

    const result = BookRecord.safeParse(candidate);
    if (result.success) {
      validByUrl.set(result.data.product_url, result.data);
    } else {
      errors.push({ product_url: bookUrl, reason: result.error.issues.map((i) => i.message).join('; ') });
    }
  }

  const records = [...validByUrl.values()];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'books.json'), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'errors.json'), JSON.stringify(errors, null, 2));

  console.log(`valid=${records.length} errors=${errors.length}`);
}

main();
