const cheerio = require('cheerio');
const { fetchPage } = require('./fetchPage');

const START_URL = 'https://books.toscrape.com/catalogue/page-1.html';
const MAX_PAGES = 3; // assignment scope: only the first 3 catalogue pages

// Walks the catalogue's own "next" link chain (page 1 -> 2 -> 3) and
// collects every book detail URL it finds, as absolute URLs. The link
// itself always comes from the page — only the "stop after 3" bound is
// ours, per this assignment's scope.
async function discoverCatalogue() {
  const cataloguePages = [];
  const bookUrls = [];

  let pageUrl = START_URL;
  let pageNumber = 1;

  while (pageUrl && pageNumber <= MAX_PAGES) {
    const { html } = await fetchPage(pageUrl, `catalogue-page-${pageNumber}`);
    const $ = cheerio.load(html);

    $('article.product_pod h3 a').each((_, el) => {
      const href = $(el).attr('href');
      const absoluteUrl = new URL(href, pageUrl).toString();
      bookUrls.push(absoluteUrl);
    });

    cataloguePages.push(pageUrl);

    const nextHref = $('li.next a').attr('href');
    pageUrl = nextHref ? new URL(nextHref, pageUrl).toString() : null;
    pageNumber += 1;
  }

  const uniqueBookUrls = [...new Set(bookUrls)];

  return { cataloguePages, bookUrls, uniqueBookUrls };
}

module.exports = { discoverCatalogue };
