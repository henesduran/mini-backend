const express = require("express");
const app = express();
const PORT = 3000;

app.get("/",(req,res)=>{
    res.json({
        message:"First Backend"
    });
});


app.get("/status",(req,res)=>{
    res.json({
        message : "running",
        timestamp : new Date().toISOString()
    });
});

app.listen(PORT,()=>{
    console.log(`Server is up at port: ${PORT}`);
});
