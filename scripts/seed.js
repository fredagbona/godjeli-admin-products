/**
 * Seed script — creates one category and one product using the manual pricing flow.
 * Usage: node scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { buildPricing, ORIGINS } = require('../src/services/pricing.service');

const SAMPLE_CATEGORY = {
  name: 'Robes',
  description: 'Selection de robes pour le catalogue GoDjeli.',
  image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
};

const SAMPLE_PRODUCT = {
  name: 'Robe d ete fleurie',
  description: 'Robe legere a imprime floral, ideale pour l ete.',
  images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
  costPriceEur: 10,
  weightGrams: 200,
  origin: ORIGINS.EUROPE,
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await Product.deleteOne({ name: SAMPLE_PRODUCT.name });
  await Category.deleteOne({ name: SAMPLE_CATEGORY.name });

  const category = await Category.create(SAMPLE_CATEGORY);
  const product = await Product.create({
    name: SAMPLE_PRODUCT.name,
    description: SAMPLE_PRODUCT.description,
    images: SAMPLE_PRODUCT.images,
    categoryId: category._id,
    pricing: buildPricing({
      costPriceEur: SAMPLE_PRODUCT.costPriceEur,
      weightGrams: SAMPLE_PRODUCT.weightGrams,
      origin: SAMPLE_PRODUCT.origin,
    }),
  });

  console.log('Seed product created:');
  console.log(JSON.stringify(product.toObject(), null, 2));

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
