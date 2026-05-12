/**
 * Seed script — creates suppliers, one category and one product using the manual pricing flow.
 * Usage: node scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const Supplier = require('../src/models/Supplier');
const Product = require('../src/models/Product');
const { buildPricing, ORIGINS } = require('../src/services/pricing.service');

const SAMPLE_SUPPLIERS = [
  {
    name: 'Fashion Wholesale Paris',
    type: 'GROSSISTE',
    country: 'France',
    deliveryDelay: '5-7 jours',
    rating: 4,
  },
  {
    name: 'Guangzhou Direct',
    type: 'DIRECT',
    country: 'Chine',
    deliveryDelay: '2-3 semaines',
    rating: 3,
  },
];

const SAMPLE_CATEGORY = {
  name: 'Robes',
  description: 'Selection de robes pour le catalogue GoDjeli.',
  image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
};

const SAMPLE_PRODUCT = {
  name: 'Robe d ete fleurie',
  description: 'Robe legere a imprime floral, ideale pour l ete.',
  images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
  productStock: 50,
  productUrl: 'https://example.com/product/robe-ete-fleurie',
  socialProof: {
    stars: 4.5,
    reviews: 120,
    salesCount: 450,
  },
  variants: {
    size: ['S', 'M', 'L', 'XL'],
    color: ['Rouge', 'Bleu', 'Blanc'],
  },
  isPromoted: false,
  promotionDiscountRate: 0,
  costPriceEur: 10,
  weightGrams: 200,
  origin: ORIGINS.EUROPE,
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clean up existing
  await Product.deleteOne({ name: SAMPLE_PRODUCT.name });
  await Category.deleteOne({ name: SAMPLE_CATEGORY.name });
  await Supplier.deleteMany({ name: { $in: SAMPLE_SUPPLIERS.map((s) => s.name) } });

  // Create suppliers
  const suppliers = await Supplier.insertMany(SAMPLE_SUPPLIERS);
  console.log(`Created ${suppliers.length} suppliers:`);
  suppliers.forEach((s) => console.log(`  - ${s.name} (${s.type}, ${s.country})`));

  // Create category
  const category = await Category.create(SAMPLE_CATEGORY);
  console.log(`Created category: ${category.name}`);

  // Create product
  const product = await Product.create({
    name: SAMPLE_PRODUCT.name,
    description: SAMPLE_PRODUCT.description,
    images: SAMPLE_PRODUCT.images,
    categoryId: category._id,
    supplierId: suppliers[0]._id,
    productStock: SAMPLE_PRODUCT.productStock,
    productUrl: SAMPLE_PRODUCT.productUrl,
    socialProof: SAMPLE_PRODUCT.socialProof,
    variants: SAMPLE_PRODUCT.variants,
    isPromoted: SAMPLE_PRODUCT.isPromoted,
    promotionDiscountRate: SAMPLE_PRODUCT.promotionDiscountRate,
    pricing: buildPricing({
      costPriceEur: SAMPLE_PRODUCT.costPriceEur,
      weightGrams: SAMPLE_PRODUCT.weightGrams,
      origin: SAMPLE_PRODUCT.origin,
    }),
  });

  console.log('\nSeed product created:');
  console.log(JSON.stringify(product.toObject(), null, 2));

  await mongoose.disconnect();
  console.log('\nDone.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
