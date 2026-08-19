const { fetchPage } = require('./fetchPage');

const CATALOGUE_PAGE_1 = 'https://books.toscrape.com/catalogue/page-1.html';

async function main() {
  const { html } = await fetchPage(CATALOGUE_PAGE_1, 'catalogue-page-1');
  console.log(`page 1 loaded, ${html.length} characters`);
}

main();
