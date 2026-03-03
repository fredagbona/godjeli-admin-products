/**
 * Seed script — verifies that a product can be saved to MongoDB with all fields.
 * Usage: node scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const SAMPLE = {
  title: 'Robe d\'été fleurie',
  price: 29.99,
  sourcePrice: 12.5,
  currency: 'EUR',
  mainImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  gallery: [],
  sourceUrl: 'https://www.shein.com/sample-product.html',
  sourceSite: 'shein',
  category: 'Robes',
  variants: ['S', 'M', 'L', 'XL'],
  description: 'Robe légère à imprimé floral, idéale pour l\'été.',
  isVisible: true,
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Remove any previous seed entry by title to stay idempotent
  await Product.deleteOne({ title: SAMPLE.title });

  const product = await Product.create(SAMPLE);

  console.log('Seed product created:');
  console.log(JSON.stringify(product.toObject(), null, 2));

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
