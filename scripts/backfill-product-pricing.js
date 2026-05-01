require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const { buildPricing } = require('../src/services/pricing.service');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const cursor = Product.find({ deletedAt: null }).cursor();
  let processed = 0;
  let updated = 0;

  for await (const product of cursor) {
    processed += 1;
    const nextPricing = buildPricing({
      costPriceEur: product.pricing.costPriceEur,
      weightGrams: product.pricing.weightGrams,
      origin: product.pricing.origin,
    });
    product.pricing = nextPricing;
    await product.save();
    updated += 1;
  }

  console.log(JSON.stringify({ processed, updated }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
