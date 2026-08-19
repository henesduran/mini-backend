const cheerio = require('cheerio');
const { fetchPage } = require('./fetchPage');

// The last URL segment before /index.html, e.g. "a-light-in-the-attic_1000".
// Used as a stable, readable cache filename for each book's detail page.
function slugFor(bookUrl) {
  const parts = new URL(bookUrl).pathname.split('/').filter(Boolean);
  return parts[parts.length - 2] ?? parts[parts.length - 1];
}

// Fetches one book detail page and pulls out the eight raw fields.
// Selectors are scoped to the product area (.product_main, the info
// table), not "the first thing on the page that looks like a price" —
// that guessing approach breaks the day the page grows a second price.
async function extractBook(bookUrl, sourcePage) {
  const { html } = await fetchPage(bookUrl, `book-${slugFor(bookUrl)}`);
  const $ = cheerio.load(html);

  const title = $('.product_main h1').text().trim();
  const priceText = $('.product_main .price_color').first().text().trim();
  const availabilityText = $('.product_main .availability').text().trim();
  const ratingClass = $('.product_main .star-rating').attr('class') ?? '';
  const ratingText = ratingClass.replace('star-rating', '').trim();

  const descriptionParagraph = $('#product_description').next('p');
  const description = descriptionParagraph.length ? descriptionParagraph.text().trim() : null;

  return {
    title,
    product_url: bookUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}

module.exports = { extractBook };
