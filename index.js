const express = require("express");
const app = express();
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const Database = require('better-sqlite3');
const PORT = 3000;

app.use(express.json());

const db = new Database('tasks.db');

db.exec(
  `
    CREATE TABLE IF NOT EXISTS tasks(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT 0
    );
  `
);

const insertStmt = db.prepare(`INSERT INTO tasks (title,done) VALUES (?,?)`);

const count = db.prepare(`SELECT COUNT(*) as total FROM tasks`).get()
if (count.total === 0){
  insertStmt.run('Buy groceries', 0);
  insertStmt.run('Walk the dog', 0);
  insertStmt.run('Read a book', 0);
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.get("/",(req,res)=>{
    res.json({
        name:"Task API",
        version: "1.0",
        endpoints: ["/tasks","/stats","/reset"],
    });
});


app.get("/health",(req,res)=>{
    res.json({
        status : "ok"
    });
});

app.get('/tasks', (req, res) => {
  let query = 'SELECT * FROM tasks';
  const params = [];
  const conditions = [];

  if (req.query.done !== undefined) {
    if (req.query.done !== 'true' && req.query.done !== 'false') {
      return res.status(400).json({ error: 'done must be true or false' });
    }
    conditions.push('done = ?');
    params.push(req.query.done === 'true' ? 1 : 0);
  };

  if (req.query.search !== undefined) {
    const word = String(req.query.search).trim();
    if (word === '') {
      return res.status(400).json({ error: 'search must not be empty' });
    }
    conditions.push('title LIKE ?');
    params.push(`%${word}%`);
  };

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  };

  const rows = db.prepare(query).all(...params);

  const tasks = rows.map(row => ({
    ...row,
    done:Boolean(row.done)
  }));

  res.json(tasks);
});

app.get('/stats', (req, res) => {
  const done = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE done = 1`).get().count;
  const total = db.prepare(`SELECT COUNT(*) as count FROM tasks`).get().count;

  res.json({
    total,
    done,
    open:total-done,
  });
});


app.get("/tasks/:id",(req,res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT * FROM tasks WHERE id= ?`).get(id);

    if (!row) return res.status(404).json({error : `Task ${id} not found`});
    res.json({
      ...row,
      done:Boolean(row.done)
    });
});

app.post("/tasks",(req,res)=>{
    const {title} = req.body;

    if (title === undefined || title === null || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required and cannot be empty' });
    };

    const cleanTitle = String(title).trim();
    const result = db.prepare(`INSERT INTO tasks (title,done) VALUES (?,0)`).run(cleanTitle);


    res.status(201).json({
      id:Number(result.lastInsertRowid),
      title:cleanTitle,
      done:false,
    });
});

app.put("/tasks/:id",(req,res)=>{
    const id = Number(req.params.id);
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);

    if (!task) return res.status(404).json({error : `Task ${id} not found`});

    const {title,done} = req.body ?? {};

    const hasTitle = Object.prototype.hasOwnProperty.call(req.body ?? {},"title");
    const hasDone = Object.prototype.hasOwnProperty.call(req.body ?? {},"done");

    if (!hasTitle && !hasDone) {
        return res.status(400).json({ error: 'request body must include title and/or done' });
    };

    let newTitle = task.title;
    let newDone = task.done;

    if (hasTitle) {
    if (title === null || String(title).trim() === '') {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    newTitle = String(title).trim();
  };

  if (hasDone) {
    if (typeof done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }
    newDone = done ? 1 : 0;
  };

  db.prepare(`UPDATE tasks SET title = ?, done = ? WHERE id = ?`).run(newTitle,newDone,id);


  res.json({
    id,
    title:newTitle,
    done:Boolean(newDone),
  });
});

app.delete("/tasks/:id",(req,res) => {
    const id = Number(req.params.id);
    const result = db.prepare(`DELETE from tasks WHERE id = ?`).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    
    res.status(204).send();
});

app.post('/reset', (req, res) => {
  db.prepare(`DELETE FROM tasks`).run();
  db.prepare(`DELETE FROM sqlite_sequence WHERE name = 'tasks'`).run();

  insertStmt.run('Buy groceries', 0);
  insertStmt.run('Walk the dog', 0);
  insertStmt.run('Read a book', 0);

  const rows = db.prepare(`SELECT * FROM tasks`).all();
  const tasks = rows.map(row => ({ ...row, done: Boolean(row.done) }));

  res.json(tasks);
});

app.listen(PORT,()=>{
    console.log(`Server is up at port: ${PORT}`);
});
