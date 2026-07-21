# Mini Backend - Task API

A small REST API for managing a list of tasks, built with Node.js and Express.
Tasks are kept in memory, so the data resets every time the server restarts.
It's a capstone project meant to cover the basics end to end: routing, input
validation, proper status codes, and API docs.

## Getting started

You'll need Node.js installed. Then:

```bash
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

- Storage is in-memory only. There is no database, and nothing survives a restart.
- Built on Express 5. The API contract lives in `openapi.json`, which is what
  powers the `/docs` page.
