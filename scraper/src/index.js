const { discoverCatalogue } = require('./discoverCatalogue');
const { extractBook } = require('./extractBook');

async function main() {
  const { uniqueBookUrls, sourcePageByBookUrl } = await discoverCatalogue();

  const records = [];
  for (const bookUrl of uniqueBookUrls) {
    const record = await extractBook(bookUrl, sourcePageByBookUrl.get(bookUrl));
    records.push(record);
  }

  console.log('--- sample record ---');
  console.log(JSON.stringify(records[0], null, 2));
  console.log(`detail_pages=${records.length}`);
}

main();
