// "£51.77" -> 51.77. Keeps the raw text around too (callers store both).
function parsePriceGbp(priceText) {
  const match = String(priceText).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : NaN;
}

module.exports = { parsePriceGbp };
