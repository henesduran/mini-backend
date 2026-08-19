// Models like to wrap JSON in a ```json code fence, or add a sentence
// before/after it ("Sure! Here's the JSON:"). This finds the first `{`
// and walks forward tracking brace depth until it returns to zero,
// giving the actual matching closing brace — not just "the last `}` in
// the whole text", which would swallow trailing commentary that happens
// to contain its own `}` (e.g. "...} Hope that helps :)}").
// Returns null instead of throwing — a bad response is data to handle,
// not an exception to crash on.
function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null; // never returned to depth 0 — unterminated object
}

module.exports = { extractJson };
