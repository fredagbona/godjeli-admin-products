require('dotenv').config();
const express = require('express');
const { config, connectDB } = require('./config');
const { pinAuth } = require('./middlewares/auth');
const { errorHandler } = require('./middlewares/errorHandler');
const productController = require('./controllers/products');
const adminController = require('./controllers/admin');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Public — no auth required
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All routes below require a valid x-admin-pin header
app.use(pinAuth);

// GET /api/admin/verify — lets the frontend check if the PIN is valid
app.get('/api/admin/verify', (req, res) => {
  res.json({ ok: true });
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
