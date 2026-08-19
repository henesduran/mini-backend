const { z } = require('zod');

// The shape of a finished, storable record. Anything that doesn't match
// this — wrong type, missing field, an unparsable price — fails validation
// and goes to errors.json instead of books.json.
const BookRecord = z.object({
  title: z.string().min(1),
  product_url: z.string().url(), // the canonical identity of a record
  price_text: z.string(),
  price_gbp: z.number().positive(),
  availability_text: z.string(),
  rating_text: z.string(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string(),
});

module.exports = { BookRecord };
