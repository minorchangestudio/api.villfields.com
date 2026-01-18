require('dotenv').config({quiet:true});
require("./db/models");
const cors = require('cors');
const express = require('express');
const clerkAuthMiddleware = require('./middlewares/authMiddleware');
const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors())
app.use(express.json());


// Routes
app.use('/api', clerkAuthMiddleware, require('./routes'));


app.get('/status', (req, res) => {
  res.json({
    status:"ok",
    environment:app.get('env'),
    message: 'API is running',
    version: '1.0.0',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    processId: process.pid,
  });
});









app.listen(PORT, () => {
  console.log(`✅ Server is running on port http://localhost:${PORT}`);
});