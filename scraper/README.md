# The polite scraper (A9)

A small pipeline that downloads the first three catalogue pages of
[Books to Scrape](https://books.toscrape.com), visits all 60 book pages,
turns the HTML into clean, schema-checked JSON records, survives a broken
page without crashing, and writes an honest report of what happened.

## Target classification

- **Target:** `books.toscrape.com`, specifically the catalogue starting at
  `https://books.toscrape.com/catalogue/page-1.html`.
- **Why this is an appropriate target:** the parent site,
  [toscrape.com](https://toscrape.com), describes Books to Scrape in its
  own words as *"A fictional bookstore that desperately wants to be
  scraped. It's a safe place for beginners learning web scraping and for
  developers validating their scraping technologies as well."* That
  sentence is the permission this project relies on. It's also the
  **only** site this scraper touches, and this code is not intended to be
  pointed at anything else without re-checking that target's own rules
  and terms first.
- **Scope:** the first 3 catalogue pages only (as many as the site's own
  "next" link chain produces before it runs out), and the 60 book detail
  pages those pages link to. Nothing else on the site is fetched.
- **Data collected per book:** title, product URL, price (raw text and a
  parsed number), availability text, star rating, description (nullable),
  plus provenance (`source_page`, `fetched_at`). No personal data, no
  account data — everything collected is a public product listing.
- **`robots.txt` check:** `curl -i https://books.toscrape.com/robots.txt`
  returns `404 Not Found`. **No robots file found** — per the assignment's
  own framing, a missing file is not permission, it is just a missing
  file; the actual permission for this project comes from the sandbox's
  own "please scrape me" description above, not from an absent
  `robots.txt`.

**I will not reuse this code on another site without checking its rules
and terms first.**

## Running it

```bash
cd scraper
npm install
node src/index.js
```

Produces `output/books.json` (60 validated records), `output/errors.json`
(any records that failed schema validation, with a reason), and
`output/run-report.json` (counts, cache hits, failures, duration).

## Record shape

```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price_text": "£51.77",
  "price_gbp": 51.77,
  "availability_text": "In stock (22 available)",
  "rating_text": "Three",
  "description": "...",
  "source_page": "https://books.toscrape.com/catalogue/page-1.html",
  "fetched_at": "2026-08-19T10:00:00.000Z"
}
```

## Politeness rules this scraper follows

- Every real request sends an identifying `User-Agent`:
  `FlyRankInternshipA9/1.0 (+https://github.com/henesduran/mini-backend)`.
- Every real request has a timeout (10s) — it never waits forever.
- Every real request waits at least 500ms after the previous one.
- Every response's saved HTML is cached under `cache/`; while developing,
  a second run reads the cached copy instead of re-fetching.
- `404` and `403` responses are never retried — only timeouts and `5xx`
  get one retry.

## Sample run report

A real `output/run-report.json` from a fresh run (empty `cache/`, so
every page is a genuine fetch):

```json
{
  "started_at": "2026-08-19T10:00:24.773Z",
  "finished_at": "2026-08-19T10:01:08.993Z",
  "duration_ms": 44220,
  "pages_fetched": 63,
  "cache_hits": 0,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "failed_page_details": []
}
```

63 pages fetched = 3 catalogue pages + 60 book detail pages. To see the
failure path, run `SCRAPER_INJECT_FAKE=1 node src/index.js` — it appends
one made-up book URL to the list, and the run still finishes with 60
good records and `failed_pages: 1` in the report.

## Why no browser was needed

Every field this scraper collects — title, price, availability, rating,
description — is present in the raw HTML the server sends back on a
plain `fetch()`. `view-source:` on any book page shows the same text
`extractBook.js` parses. A headless browser (Playwright, Puppeteer) only
earns its cost when content is injected by client-side JavaScript after
the initial HTML loads — that's not the case here, so running one would
only add startup time and memory for no extra data.

## Ethics note

This scraper is pointed at exactly one target: a sandbox site whose own
homepage invites scraping. That doesn't generalize. Before pointing
anything like this at a different site: check for an official API first
and use that instead if one exists; never bypass a login wall, a
paywall, or a block (a `403` or a CAPTCHA is the site telling you no,
and retrying past it is not "polite" anymore); and only collect the
fields the task actually needs, not everything reachable.

## Requirements coverage

- [x] One command processes exactly the first 3 catalogue pages and
  discovers 60 unique book URLs (Stage 2 checkpoint).
- [x] Every detail page produces the eight raw fields plus a numeric
  `price_gbp` (Stage 3/4).
- [x] Records are schema-validated (Zod) before storage; failures land in
  `errors.json` with a reason (Stage 4).
- [x] `output/books.json` holds exactly 60 unique records, on a first run
  and a rerun (Stage 4 idempotency check).
- [x] Every real request: identifying user-agent, timeout, ≥500ms delay,
  status check; development reads from cache (Stage 1).
- [x] README documents target classification and the robots check
  result (above).
- [x] One deliberately broken URL is logged and skipped; the run finishes
  and the good records survive (Stage 5, `SCRAPER_INJECT_FAKE=1`).
- [x] `output/run-report.json` reports counts, failures, cache hits, and
  duration (Stage 5).
- [ ] Stretch goals (parser unit tests, CSV export, background execution,
  local-model enrichment) were not built for this pass — the required
  path was the priority given the time budget. Noted here rather than
  silently skipped.
