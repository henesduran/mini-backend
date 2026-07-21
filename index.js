const express = require("express");
const app = express();
const PORT = 3000;

const tasks = [
    { id: 1, title: 'Buy groceries', done: false },
    { id: 2, title: 'Walk the dog', done: false },
    { id: 3, title: 'Read a book', done: false },
]

app.get("/",(req,res)=>{
    res.json({
        name:"Task API",
        version: "1.0",
        endpoints: ["/tasks"],
    });
});


app.get("/health",(req,res)=>{
    res.json({
        status : "ok"
    });
});

app.get("/tasks",(req,res) => {
    res.json(tasks);
});


app.get("/tasks:id",(req,res) => {
    const id = Number(req.params.id);
    const task = tasks.find((t) => t.id == id);

    if (!task) res.status(404).json({error : `Task ${id} not found`});
    res.json(task);
});



app.listen(PORT,()=>{
    console.log(`Server is up at port: ${PORT}`);
});
