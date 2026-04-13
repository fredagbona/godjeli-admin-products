require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { getPool } = require('../src/utils/pgClient');
const Product = require('../src/models/Product');

/**
 * Replaces existing Cartesian product variants in PostgreSQL with a flatter model.
 * Each product's variants are deleted and re-inserted with sizes and colors
 * as independent rows (not size×color combinations).
 */
async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected.');

  const pool = getPool();

  const products = await Product.find({ deletedAt: null }).lean();
  console.log(`Found ${products.length} products in MongoDB.`);

  // We need to map MongoDB _id to PostgreSQL product id.
  // First, get all existing mappings from PostgreSQL.
  const sourceIds = products.map(p => String(p._id));
  const pgResult = await pool.query(
    `SELECT id, "sourceId" FROM "Product" WHERE "sourceId" = ANY($1)`,
    [sourceIds]
  );
  const idMap = {};
  for (const row of pgResult.rows) {
    idMap[row.sourceId] = row.id;
  }

  let totalOldVariants = 0;
  let totalNewVariants = 0;

  await pool.query('BEGIN');

  for (const product of products) {
    const pgProductId = idMap[String(product._id)];
    if (!pgProductId) continue;

    // Delete existing variants
    const delResult = await pool.query(
      'DELETE FROM "ProductVariant" WHERE "productId" = $1',
      [pgProductId]
    );
    totalOldVariants += delResult.rowCount;

    // Insert flat variants
    const sizes = product.variants?.size || [];
    const colors = product.variants?.color || [];
    const variants = [];

    for (const size of sizes) {
      variants.push([crypto.randomUUID(), pgProductId, size, null]);
    }
    for (const color of colors) {
      variants.push([crypto.randomUUID(), pgProductId, null, color]);
    }

    if (variants.length > 0) {
      const values = variants
        .map((_, i) => {
          const base = i * 4 + 1;
          return `($${base}, $${base + 1}, $${base + 2}, $${base + 3})`;
        })
        .join(', ');
      const flatParams = variants.flat();
      const sql = `INSERT INTO "ProductVariant" ("id", "productId", "size", "color") VALUES ${values}`;
      await pool.query(sql, flatParams);
      totalNewVariants += variants.length;
    }
  }

  await pool.query('COMMIT');

  console.log(`Deleted ${totalOldVariants} old Cartesian product variants.`);
  console.log(`Inserted ${totalNewVariants} new flat variants.`);
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
