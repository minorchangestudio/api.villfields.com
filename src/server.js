require('dotenv').config({ quiet: true });
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
    status: "ok",
    environment: app.get('env'),
    message: 'API is running',
    version: '1.0.0',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    processId: process.pid,
  });
});


app.get('/site-info', (req, res) => {

  const siteName = process.env.DB_NAME;
  var siteData = {}

  switch (siteName) {
    case 'villfields':
      siteData = {
        name: 'Vill Fields',
        siteURL: 'https://villfields.com',
        db: 'villfields',
      };
      break;
    case 'photo-booth':
      siteData = {
        name: 'Photo Booth',
        siteURL: 'https://photoboothnearme.us',
        db: 'photo-booth',
      };
      break;
    case 'higho-market':
      siteData = {
        name: 'Higho Market',
        siteURL: 'https://highomarket.ca',
        db: 'higho-market',
      };
      break;
    case 'minor-change':
      siteData = {
        name: 'Minor Change',
        siteURL: 'https://minorchange.studio',
        db: 'minor-change',
      };
      break;
    default:
      siteData = {
        name: 'Unknown',
        db: 'unknown',
      };
      break;
  }

  res.json(siteData);

});









app.listen(PORT, () => {
  console.log(`✅ Server is running on port http://localhost:${PORT}`);
});