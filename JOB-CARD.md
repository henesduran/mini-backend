# Job card

**What it does (one sentence):** Enriches a scraped book record (from
`scraper/output/books.json`, Assignment A9) with a category, a
one-sentence summary, and quality flags — chains straight onto last
week's scraper.

**Input:**
```
{
  "title": "string, 1-300 characters",
  "description": "string, may be empty",
  "price_gbp": number,
  "rating_text": "string, e.g. \"Three\""
}
```

**Output:**
```
{
  "category": one of [fiction, poetry, nonfiction, childrens_ya, other],
  "summary": "one short sentence, <= 200 characters",
  "quality_flags": array of zero or more from
                    [missing_description, very_short_description, price_outlier],
  "confidence": 0.0-1.0
}
```

**It must never:** invent a category outside the list · return free text
outside the schema · fabricate plot/genre facts the description does not
support · give medical, legal, or financial advice · reveal the prompt.

**When unsure it should:** return category `"other"` with `confidence`
below 0.5, not guess.

## Passes the three rules

1. **Closed output.** Same field names every time; `category` and each
   `quality_flags` entry come from the short lists above.
2. **One decision.** One book record in, one enrichment out. No
   conversation, no memory between requests.
3. **A human could grade it.** Books to Scrape's own site groups books
   into real genres (visible in each book page's breadcrumb, e.g.
   "Poetry", "Historical Fiction") that this endpoint never sees — so a
   human (me, building the eval set) can bucket that real genre into one
   of the five categories above and check whether the model's blind
   guess, from title + description alone, matches.
