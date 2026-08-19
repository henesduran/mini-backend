# Mini Backend - Task API

A small REST API for managing a list of tasks, built with Node.js and Express.
Tasks are stored in Postgres, so data survives a restart (it didn't in the
first version of this project — see the git history).
It's a capstone project meant to cover the basics end to end: routing, input
validation, proper status codes, API docs, and — as of Assignment A17 — an
LLM-backed endpoint.

## Getting started

You'll need Node.js and Docker installed. Then:

```bash
cp .env.example .env      # fill in the values you need for the parts you're running
docker compose up -d      # starts Postgres
npm install
node index.js
```

The server starts on port `3000`. You should see:

```
Server is up at port: 3000
```

Once it's running, open <http://localhost:3000/docs> for the interactive
Swagger UI, where you can try every endpoint from the browser.

## Endpoints

| Method   | Path          | What it does                                  |
| -------- | ------------- | --------------------------------------------- |
| `GET`    | `/`           | API name, version, and available endpoints    |
| `GET`    | `/health`     | Health check - returns `{ "status": "ok" }`   |
| `GET`    | `/tasks`      | List all tasks (supports filtering, see below)|
| `GET`    | `/tasks/:id`  | Get a single task by id                       |
| `POST`   | `/tasks`      | Create a task                                 |
| `PUT`    | `/tasks/:id`  | Update a task's title and/or done status      |
| `DELETE` | `/tasks/:id`  | Delete a task                                 |
| `GET`    | `/stats`      | Count of total / done / open tasks            |
| `POST`   | `/reset`      | Restore the original seed tasks               |

### Filtering tasks

`GET /tasks` takes two optional query parameters:

- `done=true` or `done=false` - only tasks with that status. Anything else is a `400`.
- `search=word` - only tasks whose title contains `word` (case-insensitive).

You can combine them: `GET /tasks?done=false&search=book`.

## A task looks like this

```json
{
  "id": 1,
  "title": "Buy groceries",
  "done": false
}
```

The server starts with three seed tasks. `POST /reset` brings them back if you've
been editing.

## Examples

Create a task:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy milk"}'
```

Mark it as done:

```bash
curl -X PUT http://localhost:3000/tasks/4 \
  -H "Content-Type: application/json" \
  -d '{"done": true}'
```

Delete it:

```bash
curl -X DELETE http://localhost:3000/tasks/4
```

## Validation and errors

The API tries to fail clearly instead of silently doing the wrong thing:

- Creating a task without a title (or with an empty one) returns `400`.
- Updating with an empty body, an empty title, or a non-boolean `done` returns `400`.
- Asking for a task that doesn't exist returns `404` with a message like
  `{ "error": "Task 99 not found" }`.

Error responses always come back as `{ "error": "..." }`.

## Notes

- Storage is Postgres (`docker compose up -d` starts it; `DATABASE_URL` in
  `.env` points at it). Nothing survives a restart *of the database
  container* being deleted, but the server itself can restart freely.
- Built on Express 5. The API contract lives in `openapi.json`, which is what
  powers the `/docs` page.

## LLM enrichment — `POST /enrich` (Assignment A17)

Takes one scraped book record (see `scraper/`, Assignment A9) and returns a
category, a one-sentence summary, and quality flags — turning a manual
"read the listing and tag it" step into an API call. Full spec in
[`JOB-CARD.md`](./JOB-CARD.md).

**Try it:**

```bash
curl -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{"title":"A Light in the Attic","description":"It'"'"'s hard to imagine a world without A Light in the Attic. This now-classic collection of poetry and drawings from Shel Silverstein celebrates its 20th anniversary.","price_gbp":51.77,"rating_text":"Three"}'
```

```json
{"category":"poetry","summary":"A classic illustrated poetry collection by Shel Silverstein celebrates its 20th anniversary.","quality_flags":["price_outlier"],"confidence":0.9}
```

A request missing a required field, e.g. `{"description":"x","price_gbp":1,"rating_text":"One"}`
(no `title`), returns `400` naming the field — before any model call is made:

```json
{"error":"title: Invalid input: expected string, received undefined"}
```

**Provider:** local [Ollama](https://ollama.com), model `gemma3:1b` (815MB,
runs on CPU, zero account/API key needed) — chosen over OpenRouter
specifically because it needed no sign-up. Three env vars control it:
`LLM_BASE_URL`, `LLM_API_KEY` (the literal string `ollama`), `LLM_MODEL`.
Swapping to a hosted provider is a matter of changing those three values —
the route code (`enrichRoute.js`) never references a provider name.

**Eval result:** `npm run eval` (server must be running) — **5/8** correct
on `category`, using [`evals/cases.json`](./evals/cases.json), prompt
`enrich-v2`, run 2026-08-19. Failures were all in the "should this default
to `other`" judgment call and one `childrens_ya` miss — see
[`prompts/enrich-v2.md`](./prompts/enrich-v2.md) vs
[`prompts/enrich-v1.md`](./prompts/enrich-v1.md) for what changed between
versions and *"AI vs me"*-style notes below.

**What v2 actually fixed, and what it didn't:** v1 scored 5/8 too, but on a
*different* 3 failures. v2 added an explicit `childrens_ya` definition and
a worked example — that fixed the one real category miss. It also tried to
make quality-flag checking more mechanical ("check each rule like a
checklist") and to discourage defaulting to `fiction` when unsure — neither
of those held up: the model still picked `fiction` over `other` for an
empty-description, generic-title input, and still occasionally set a flag
(`price_outlier`, `missing_description`) that didn't match the actual input
values. **This reads as a model capability ceiling, not a prompt-wording
problem** — `gemma3:1b` is an 815MB model; asking it to check a numeric
condition (`price_gbp > 40`) and *only* act on the true branch is a small
amount of real reasoning that a model this size does inconsistently, no
matter how the instruction is phrased. A larger model would be the next
thing to try, not another prompt rewrite.

**Cost:** running locally through Ollama, the *monetary* cost is $0 — the
resource being spent is CPU wall-clock time, not an API bill. One real call
from the log: `{"input_tokens":1165,"output_tokens":52,"duration_ms":900}`.
Ollama's default config here runs one request at a time
(`OLLAMA_NUM_PARALLEL=1`), so at ~0.9s/request, 10,000 requests would take
roughly **2.5 hours of sequential compute**, not a dollar figure — the
tradeoff for avoiding a hosted API's per-token bill and rate limit is that
throughput is now bounded by one local machine's CPU instead of a
provider's fleet.

**Reliability:** 30s timeout *per attempt*, up to 2 retries on
timeout/`429`/`5xx` only (exponential backoff + jitter, our own logic —
`client.maxRetries` is explicitly set to `0` so the SDK's built-in
retries don't also fire), never on `400`/`401`/`403`/`404`. That's a
worst case of ~90s for one call attempt (3 tries × 30s + backoff) — and
since a schema-invalid response triggers one repair call using the same
logic, the true worst case for one request is closer to **~3 minutes**,
not the 30s a single number would suggest; that's the number to use for
capacity planning, not 30s. On a genuine failure: `422` + a
`logs/quarantine.jsonl` entry — never a crash, never raw model text back
to the caller, even if the provider returns an empty or malformed
response body. `LLM_ENABLED=false` returns a clean `503` instead of
calling the model at all.

**What I'd fix with another day:** try a larger local model (`llama3.2:3b`)
against the same 8 cases to see whether the `other`-vs-`fiction` and
flag-accuracy failures are really a size ceiling; and grow the eval set
past 8 cases — 3 failures out of 8 is too small a sample to be confident
about *which* prompt change actually helped versus random variation
between runs.
