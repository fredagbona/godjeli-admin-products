const { getPool } = require('../utils/pgClient');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const { ok, fail } = require('../middlewares/respond');

function parseBoolean(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Find entities that need migration: migratedAt is null OR updatedAt > migratedAt
 */
function pendingQuery(Model) {
  return Model.find({
    deletedAt: null,
    $or: [
      { migratedAt: null },
      { $expr: { $gt: ['$updatedAt', '$migratedAt'] } },
    ],
  }).lean();
}

/**
 * Upsert a category into PostgreSQL.
 * Returns the PostgreSQL id (existing or new).
 */
async function upsertCategory(pool, cat) {
  const sql = `
    INSERT INTO "Category" (
      "sourceId", "slug", "name", "description", "image", "isActive",
      "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT ("sourceId") DO UPDATE SET
      "slug" = EXCLUDED."slug",
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "image" = EXCLUDED."image",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id
  `;
  const result = await pool.query(sql, [
    String(cat._id),
    cat.slug,
    cat.name,
    cat.description || null,
    cat.image || null,
    cat.isActive ?? true,
    cat.createdAt,
    cat.updatedAt,
  ]);
  return result.rows[0].id;
}

/**
 * Upsert a supplier into PostgreSQL.
 */
async function upsertSupplier(pool, sup) {
  const sql = `
    INSERT INTO "Supplier" (
      "sourceId", "slug", "name", "type", "country", "deliveryDelay",
      "rating", "isActive", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT ("sourceId") DO UPDATE SET
      "slug" = EXCLUDED."slug",
      "name" = EXCLUDED."name",
      "type" = EXCLUDED."type",
      "country" = EXCLUDED."country",
      "deliveryDelay" = EXCLUDED."deliveryDelay",
      "rating" = EXCLUDED."rating",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id
  `;
  const result = await pool.query(sql, [
    String(sup._id),
    sup.slug,
    sup.name,
    sup.type,
    sup.country,
    sup.deliveryDelay,
    sup.rating ?? null,
    sup.isActive ?? true,
    sup.createdAt,
    sup.updatedAt,
  ]);
  return result.rows[0].id;
}

/**
 * Upsert a product into PostgreSQL.
 */
async function upsertProduct(pool, product, pgCategoryId, pgSupplierId) {
  const sql = `
    INSERT INTO "Product" (
      "sourceId", "slug", "name", "description", "images", "productUrl",
      "productStock", "isActive",
      "socialProofStars", "socialProofReviews", "socialProofSalesCount",
      "categoryId", "supplierId",
      "origin", "costPriceEur", "weightGrams",
      "ratePerKgEur", "logisticsCostEur", "customsFeeEur",
      "paymentFeeEur", "marginAmountEur", "netMarginEur",
      "displayProductPriceEur", "displayShippingAndCustomsEur",
      "totalPriceEur", "totalRealCostEur",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
    )
    ON CONFLICT ("sourceId") DO UPDATE SET
      "slug" = EXCLUDED."slug",
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "images" = EXCLUDED."images",
      "productUrl" = EXCLUDED."productUrl",
      "productStock" = EXCLUDED."productStock",
      "isActive" = EXCLUDED."isActive",
      "socialProofStars" = EXCLUDED."socialProofStars",
      "socialProofReviews" = EXCLUDED."socialProofReviews",
      "socialProofSalesCount" = EXCLUDED."socialProofSalesCount",
      "categoryId" = EXCLUDED."categoryId",
      "supplierId" = EXCLUDED."supplierId",
      "origin" = EXCLUDED."origin",
      "costPriceEur" = EXCLUDED."costPriceEur",
      "weightGrams" = EXCLUDED."weightGrams",
      "ratePerKgEur" = EXCLUDED."ratePerKgEur",
      "logisticsCostEur" = EXCLUDED."logisticsCostEur",
      "customsFeeEur" = EXCLUDED."customsFeeEur",
      "paymentFeeEur" = EXCLUDED."paymentFeeEur",
      "marginAmountEur" = EXCLUDED."marginAmountEur",
      "netMarginEur" = EXCLUDED."netMarginEur",
      "displayProductPriceEur" = EXCLUDED."displayProductPriceEur",
      "displayShippingAndCustomsEur" = EXCLUDED."displayShippingAndCustomsEur",
      "totalPriceEur" = EXCLUDED."totalPriceEur",
      "totalRealCostEur" = EXCLUDED."totalRealCostEur",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id
  `;
  const p = product.pricing || {};
  const sp = product.socialProof || {};
  const v = product.variants || {};
  const result = await pool.query(sql, [
    String(product._id),
    product.slug,
    product.name,
    product.description,
    product.images,
    product.productUrl || '',
    product.productStock ?? 0,
    product.isActive ?? true,
    sp.stars ?? 0,
    sp.reviews ?? 0,
    sp.salesCount ?? 0,
    pgCategoryId,
    pgSupplierId,
    product.pricing?.origin || 'EUROPE',
    p.costPriceEur ?? 0,
    p.weightGrams ?? 0,
    p.ratePerKgEur ?? 0,
    p.logisticsCostEur ?? 0,
    p.customsFeeEur ?? 0,
    p.paymentFeeEur ?? 0,
    p.marginAmountEur ?? 0,
    p.netMarginEur ?? 0,
    p.displayProductPriceEur ?? 0,
    p.displayShippingAndCustomsEur ?? 0,
    p.totalPriceEur ?? 0,
    p.totalRealCostEur ?? 0,
    product.createdAt,
    product.updatedAt,
  ]);
  return result.rows[0].id;
}

/**
 * Sync variants: delete existing ones for this product sourceId, then bulk insert.
 */
async function syncVariants(pool, pgProductId, product) {
  // Delete existing
  await pool.query(
    'DELETE FROM "ProductVariant" WHERE "productId" = $1',
    [pgProductId]
  );

  const variants = [];
  const sizes = product.variants?.size || [];
  const colors = product.variants?.color || [];

  // Create cartesian product of sizes x colors, plus standalone sizes/colors
  const seen = new Set();
  for (const size of sizes) {
    for (const color of colors) {
      const key = `${size}|${color}`;
      if (!seen.has(key)) {
        seen.add(key);
        variants.push([pgProductId, size, color]);
      }
    }
  }
  // Also add size-only and color-only entries
  for (const size of sizes) {
    const key = `${size}|`;
    if (!seen.has(key)) {
      seen.add(key);
      variants.push([pgProductId, size, null]);
    }
  }
  for (const color of colors) {
    const key = `|${color}`;
    if (!seen.has(key)) {
      seen.add(key);
      variants.push([pgProductId, null, color]);
    }
  }

  if (variants.length === 0) return 0;

  const values = variants
    .map((_, i) => {
      const base = i * 3 + 1;
      return `($${base}, $${base + 1}, $${base + 2})`;
    })
    .join(', ');

  const flatParams = variants.flat();
  const sql = `INSERT INTO "ProductVariant" ("productId", "size", "color") VALUES ${values}`;
  await pool.query(sql, flatParams);

  return variants.length;
}

async function syncMigration(req, res, next) {
  try {
    const dryRun = parseBoolean(req.query.dryRun) === true;
    const pool = getPool();

    const categories = await pendingQuery(Category);
    const suppliers = await pendingQuery(Supplier);
    const products = await pendingQuery(Product);

    if (dryRun) {
      return ok(res, {
        dryRun: true,
        categories: categories.length,
        suppliers: suppliers.length,
        products: products.length,
        totalVariants: products.reduce((sum, p) => {
          const sizes = p.variants?.size?.length || 0;
          const colors = p.variants?.color?.length || 0;
          return sum + (sizes * colors || sizes + colors);
        }, 0),
      });
    }

    // Execute in a transaction
    await pool.query('BEGIN');

    let categoryUpserts = 0;
    const categoryMap = {}; // MongoDB _id -> PostgreSQL id

    for (const cat of categories) {
      const pgId = await upsertCategory(pool, cat);
      categoryMap[String(cat._id)] = pgId;
      await Category.updateOne({ _id: cat._id }, { migratedAt: new Date() });
      categoryUpserts++;
    }

    let supplierUpserts = 0;
    const supplierMap = {};

    for (const sup of suppliers) {
      const pgId = await upsertSupplier(pool, sup);
      supplierMap[String(sup._id)] = pgId;
      await Supplier.updateOne({ _id: sup._id }, { migratedAt: new Date() });
      supplierUpserts++;
    }

    let productUpserts = 0;
    let totalVariants = 0;

    for (const product of products) {
      const catId = String(product.categoryId);
      const supId = String(product.supplierId);

      // Category/supplier may have been migrated earlier; look up or upsert on the fly
      let pgCategoryId = categoryMap[catId];
      let pgSupplierId = supplierMap[supId];

      if (!pgCategoryId) {
        const existingCat = await Category.findById(catId).lean();
        if (existingCat) {
          pgCategoryId = await upsertCategory(pool, existingCat);
          categoryMap[catId] = pgCategoryId;
          await Category.updateOne({ _id: catId }, { migratedAt: new Date() });
        }
      }
      if (!pgCategoryId) {
        throw new Error(`Category ${catId} not found for product ${product.name}`);
      }

      if (!pgSupplierId) {
        const existingSup = await Supplier.findById(supId).lean();
        if (existingSup) {
          pgSupplierId = await upsertSupplier(pool, existingSup);
          supplierMap[supId] = pgSupplierId;
          await Supplier.updateOne({ _id: supId }, { migratedAt: new Date() });
        }
      }
      if (!pgSupplierId) {
        throw new Error(`Supplier ${supId} not found for product ${product.name}`);
      }

      const pgProductId = await upsertProduct(pool, product, pgCategoryId, pgSupplierId);
      const variantCount = await syncVariants(pool, pgProductId, product);

      await Product.updateOne({ _id: product._id }, { migratedAt: new Date() });
      productUpserts++;
      totalVariants += variantCount;
    }

    await pool.query('COMMIT');

    return ok(res, {
      dryRun: false,
      categories: { upserted: categoryUpserts },
      suppliers: { upserted: supplierUpserts },
      products: { upserted: productUpserts },
      variants: { upserted: totalVariants },
    });
  } catch (error) {
    // Try to rollback if in transaction
    try {
      const pool = getPool();
      await pool.query('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }

    if (error.code === 'ECONNREFUSED' || error.code === '28P01') {
      return fail(res, 503, 'DB_UNAVAILABLE', `Cannot connect to PostgreSQL: ${error.message}`);
    }
    if (error.status) return fail(res, error.status, 'MIGRATION_ERROR', error.message);
    next(error);
  }
}

module.exports = { syncMigration };
