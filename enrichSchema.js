const { z } = require('zod');

// What a caller must send us. Rejecting a bad shape here means a bad
// request never costs a model call.
const EnrichRequest = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000), // "" is allowed — many scraped records have no description
  price_gbp: z.number(),
  rating_text: z.string().min(1).max(20),
});

const CATEGORIES = ['fiction', 'poetry', 'nonfiction', 'childrens_ya', 'other'];
const QUALITY_FLAGS = ['missing_description', 'very_short_description', 'price_outlier'];

// What the model must hand back. category and every quality_flags entry
// come from the closed lists above — nothing free-text except `summary`,
// and even that is length-capped.
const EnrichResponse = z.object({
  category: z.enum(CATEGORIES),
  summary: z.string().min(1).max(200),
  quality_flags: z.array(z.enum(QUALITY_FLAGS)),
  confidence: z.number().min(0).max(1),
});

module.exports = { EnrichRequest, EnrichResponse, CATEGORIES, QUALITY_FLAGS };
