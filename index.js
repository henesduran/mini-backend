require('dotenv').config();
const { Client } = require('pg');
const express = require('express');const app = express();
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');

app.use(express.json());

const enrichRoute = require('./enrichRoute');
app.use(enrichRoute);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error("ERR: can't find DATABASE_URL environment variable!");
    process.exit(1);
}
const client = new Client({ connectionString: databaseUrl });

async function initializeDatabase(params) {
  try{
    await client.connect();
    console.log("Connected to client");
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                done BOOLEAN DEFAULT FALSE
            );
        `;
      await client.query(createTableQuery);
      console.log('Table "tasks" checked/created.');
      
      const checkIfEmptyQuery = 'SELECT COUNT(*) FROM tasks;';
      const result = await client.query(checkIfEmptyQuery);

      const count = parseInt(result.rows[0].count, 10);
      if (count === 0) {
          const seedTasks = [
              { title: 'Read book', done: false },
              { title: 'Learn Docker', done: false },
              { title: 'Learn Database', done: true }
          ];
          console.log('Table is empty, adding seed data...');
          for (const task of seedTasks) {
              const insertQuery = 'INSERT INTO tasks (title, done) VALUES ($1, $2)';
              await client.query(insertQuery, [task.title, task.done]);
          }
          console.log('added seed data.');
      } else {
          console.log(`found ${count} tasks.No seed added.`);
      }
  }catch (err) {
        console.error('Error initializing databse:', err);
        process.exit(1);
    }

  }


const port = process.env.PORT || 3000;
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server is up at port: ${port}`);
    });
});


app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.get("/",(req,res)=>{
    res.json({
        name:"Task API",
        version: "1.0",
        endpoints: ["/tasks","/stats","/reset"],
    });
});


app.get("/health", async (req, res) => {
  try {
    await client.query('SELECT 1');
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", db: "disconnected" });
  }
});
app.get('/tasks', async (req, res) => {
  
  try{
    let query = 'SELECT * FROM tasks';
    const params = [];
    const conditions = [];

    if (req.query.done !== undefined) {
      if (req.query.done !== 'true' && req.query.done !== 'false') {
        return res.status(400).json({ error: 'done must be true or false' });
      }
      conditions.push(`done = $${params.length + 1 }`);
      params.push(req.query.done === 'true');
    };

    if (req.query.search !== undefined) {
      const word = String(req.query.search).trim();
      if (word === '') {
        return res.status(400).json({ error: 'search must not be empty' });
      }
      conditions.push(`title ILIKE $${params.length + 1}`);
      params.push(`%${word}%`);
    };

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    };

    const results = await client.query(query, params);
    res.json(results.rows);
  }catch(error){
    console.error('GET /tasks error::', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/stats', async (req, res) => {
  try {
    const totalResult = await client.query('SELECT COUNT(*) as count FROM tasks');
    const doneResult = await client.query('SELECT COUNT(*) as count FROM tasks WHERE done = true');
    
    const total = parseInt(totalResult.rows[0].count, 10);
    const done = parseInt(doneResult.rows[0].count, 10);
    
    res.json({
      total,
      done,
      open: total - done,
    });
  } catch (error) {
    console.error('GET /stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get("/tasks/:id", async (req,res) => {
  try{
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    
    res.json(result.rows[0]);
  }catch(error){
    console.error('GET /tasks/:id error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { title } = req.body;

    if (title === undefined || title === null || String(title).trim() === '') {
      return res.status(400).json({ error: 'title is required and cannot be empty' });
    }

    const cleanTitle = String(title).trim();
    
    const result = await client.query(
      'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
      [cleanTitle, false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('POST /tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const existingTask = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }

    const { title, done } = req.body ?? {};
    const hasTitle = Object.prototype.hasOwnProperty.call(req.body ?? {}, "title");
    const hasDone = Object.prototype.hasOwnProperty.call(req.body ?? {}, "done");

    if (!hasTitle && !hasDone) {
      return res.status(400).json({ error: 'request body must include title and/or done' });
    }

    let newTitle = existingTask.rows[0].title;
    let newDone = existingTask.rows[0].done;

    if (hasTitle) {
      if (title === null || String(title).trim() === '') {
        return res.status(400).json({ error: 'title cannot be empty' });
      }
      newTitle = String(title).trim();
    }

    if (hasDone) {
      if (typeof done !== 'boolean') {
        return res.status(400).json({ error: 'done must be a boolean' });
      }
      newDone = done;
    }
    const result = await client.query(
      'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
      [newTitle, newDone, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('PUT /tasks/:id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const result = await client.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /tasks/:id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


app.post('/reset', async (req, res) => {
  try {
    await client.query('DELETE FROM tasks');
    
    await client.query('ALTER SEQUENCE tasks_id_seq RESTART WITH 1');
    
    const seedTasks = [
      { title: 'Buy groceries', done: false },
      { title: 'Walk the dog', done: false },
      { title: 'Read a book', done: false }
    ];
    
    for (const task of seedTasks) {
      await client.query('INSERT INTO tasks (title, done) VALUES ($1, $2)', [task.title, task.done]);
    }
    
    const result = await client.query('SELECT * FROM tasks ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('POST /reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});