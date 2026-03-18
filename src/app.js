require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { config, connectDB } = require('./config');
const { pinAuth } = require('./middlewares/auth');
const { errorHandler } = require('./middlewares/errorHandler');
const { ok, fail } = require('./middlewares/respond');
const productController = require('./controllers/products');
const adminController = require('./controllers/admin');

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-pin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '10mb' }));

// Public — no auth required
app.get('/health', async (req, res) => {
  const checks = {};

  // MongoDB
  const dbState = mongoose.connection.readyState;
  checks.mongodb = dbState === 1 ? 'ok' : 'unreachable';

  // Browserless
  const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;
  if (wsEndpoint) {
    try {
      const url = new URL(wsEndpoint);
      const httpUrl = `http://${url.hostname}:${url.port || 80}/pressure`;
      await new Promise((resolve, reject) => {
        http.get(httpUrl, (r) => (r.statusCode === 200 ? resolve() : reject())).on('error', reject);
      });
      checks.browserless = 'ok';
    } catch {
      checks.browserless = 'unreachable';
    }
  } else {
    checks.browserless = 'not_configured';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok' || v === 'not_configured');
  const status = allOk ? 200 : 503;
  const payload = { status: allOk ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks };

  return res.status(status).json({ success: allOk, data: payload });
});

// All routes below require a valid x-admin-pin header
app.use(pinAuth);

// GET /api/admin/verify — lets the frontend check if the PIN is valid
app.get('/api/admin/verify', (req, res) => {
  return ok(res, { verified: true });
});

// Admin helpers (scraping)
app.post('/api/admin/scrape', adminController.scrapeProduct);
app.post('/api/admin/fetch-external-data', adminController.fetchExternalData);

// Admin product insertion (full pipeline: price calc + image upload + variants)
app.post('/api/admin/products', adminController.addProduct);

// Products CRUD
app.get('/products', productController.listProducts);
app.get('/products/:id', productController.getProduct);
app.post('/products', productController.createProduct);
app.patch('/products/:id', productController.updateProduct);
app.delete('/products/:id', productController.deleteProduct);

app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
