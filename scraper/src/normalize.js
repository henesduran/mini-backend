// "£51.77" -> 51.77, "£1,234.56" -> 1234.56. Keeps the raw text around
// too (callers store both). Strips thousands-separator commas before
// matching digits — without that, "£1,234.56" would parse as just "1".
function parsePriceGbp(priceText) {
  const withoutCommas = String(priceText).replace(/,/g, '');
  const match = withoutCommas.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : NaN;
}

module.exports = { parsePriceGbp };
