// Models like to wrap JSON in a ```json code fence, or add a sentence
// before/after it ("Sure! Here's the JSON:"). This pulls out the first
// {...} object it can find and parses it. Returns null instead of
// throwing — a bad response is data to handle, not an exception to crash on.
function extractJson(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return null;
  }
  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

module.exports = { extractJson };
