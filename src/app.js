require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { config, connectDB } = require('./config');
const { pinAuth } = require('./middlewares/auth');
const { errorHandler } = require('./middlewares/errorHandler');
const { ok } = require('./middlewares/respond');
const productController = require('./controllers/products');
const categoryController = require('./controllers/categories');
const supplierController = require('./controllers/suppliers');
const migrationController = require('./controllers/migration');
const uploadController = require('./controllers/uploads');

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
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const checks = { mongodb: dbState === 1 ? 'ok' : 'unreachable' };
  const allOk = checks.mongodb === 'ok';
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

app.post(
  '/api/admin/uploads/images',
  uploadController.uploadMiddleware.array('images', 10),
  uploadController.uploadImages
);

app.get('/api/admin/categories', categoryController.listCategories);
app.post('/api/admin/categories', categoryController.createCategory);
app.patch('/api/admin/categories/:id', categoryController.updateCategory);
app.delete('/api/admin/categories/:id', categoryController.deleteCategory);

app.get('/api/admin/suppliers', supplierController.listSuppliers);
app.post('/api/admin/suppliers', supplierController.createSupplier);
app.patch('/api/admin/suppliers/:id', supplierController.updateSupplier);
app.delete('/api/admin/suppliers/:id', supplierController.deleteSupplier);

app.post('/api/admin/migration/sync', migrationController.syncMigration);

app.get('/api/admin/products', productController.listProducts);
app.get('/api/admin/products/:id', productController.getProduct);
app.post('/api/admin/products', productController.createProduct);
app.patch('/api/admin/products/:id', productController.updateProduct);
app.delete('/api/admin/products/:id', productController.deleteProduct);

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
