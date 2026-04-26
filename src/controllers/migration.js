const crypto = require('crypto');
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
 * Compare MongoDB vs PostgreSQL state to find documents that need syncing.
 * Returns a map: MongoDB _id (string) → { action: 'insert' | 'update' | null }
 * null means PG is already up to date.
 */
async function findPendingDocs(pool, collectionName, Model) {
  const mongoDocs = await Model.find({ deletedAt: null }).lean();
  console.log(`[migration] ${collectionName}: ${mongoDocs.length} documents in MongoDB`);

  if (mongoDocs.length === 0) return { pending: [], total: 0 };

  const sourceIds = mongoDocs.map(d => String(d._id));

  // Query PostgreSQL for sourceId + updatedAt
  const pgResult = await pool.query(
    `SELECT "sourceId", "updatedAt" FROM "${collectionName}" WHERE "sourceId" = ANY($1)`,
    [sourceIds]
  );

  const pgMap = {};
  for (const row of pgResult.rows) {
    pgMap[row.sourceId] = row.updatedAt;
  }

  const pending = [];
  for (const doc of mongoDocs) {
    const id = String(doc._id);
    const pgUpdatedAt = pgMap[id];

    if (!pgUpdatedAt) {
      // Not in PostgreSQL yet → insert
      pending.push({ doc, action: 'insert' });
    } else if (new Date(doc.updatedAt) > new Date(pgUpdatedAt)) {
      // MongoDB is newer → update
      pending.push({ doc, action: 'update' });
    }
    // else: PG is up to date, skip
  }

  console.log(`[migration] ${collectionName}: ${pending.length} docs need syncing`);
  return { pending, total: mongoDocs.length };
}

async function findDeletedSourceIds(Model) {
  const deletedDocs = await Model.find({ deletedAt: { $ne: null } }).lean();
  return deletedDocs.map((doc) => String(doc._id));
}

async function getColumnDataType(pool, tableName, columnName) {
  const result = await pool.query(
    `
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  );

  if (result.rowCount === 0) return null;
  const { data_type: dataType, udt_name: udtName } = result.rows[0];
  return dataType === 'ARRAY' ? udtName : dataType;
}

async function deleteBySourceIds(pool, tableName, sourceIds) {
  if (!sourceIds || sourceIds.length === 0) return 0;
  const result = await pool.query(
    `DELETE FROM "${tableName}" WHERE "sourceId" = ANY($1)`,
    [sourceIds]
  );
  return result.rowCount || 0;
}

async function deleteProductsByRelatedSourceIds(pool, categorySourceIds, supplierSourceIds) {
  const hasCategoryIds = categorySourceIds && categorySourceIds.length > 0;
  const hasSupplierIds = supplierSourceIds && supplierSourceIds.length > 0;

  if (!hasCategoryIds && !hasSupplierIds) return 0;

  const clauses = [];
  const params = [];
  let idx = 1;

  if (hasCategoryIds) {
    clauses.push(`"categoryId" IN (SELECT id FROM "Category" WHERE "sourceId" = ANY($${idx}))`);
    params.push(categorySourceIds);
    idx += 1;
  }

  if (hasSupplierIds) {
    clauses.push(`"supplierId" IN (SELECT id FROM "Supplier" WHERE "sourceId" = ANY($${idx}))`);
    params.push(supplierSourceIds);
  }

  const sql = `DELETE FROM "Product" WHERE ${clauses.join(' OR ')}`;
  const result = await pool.query(sql, params);
  return result.rowCount || 0;
}

/**
 * Upsert a category into PostgreSQL.
 * Returns the PostgreSQL id (existing or new).
 */
async function upsertCategory(pool, cat) {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO "Category" (
      "id", "sourceId", "slug", "name", "description", "image", "isActive",
      "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    id,
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
  const id = crypto.randomUUID();
  const imageColumnType = await getColumnDataType(pool, 'Supplier', 'image');
  const imageValue = imageColumnType === 'json' || imageColumnType === 'jsonb'
    ? JSON.stringify(sup.image ?? null)
    : (sup.image ?? null);
  const sql = `
    INSERT INTO "Supplier" (
      "id", "sourceId", "slug", "name", "type", "country", "deliveryDelay",
      "logo", "image",
      "rating", "isActive", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT ("sourceId") DO UPDATE SET
      "slug" = EXCLUDED."slug",
      "name" = EXCLUDED."name",
      "type" = EXCLUDED."type",
      "country" = EXCLUDED."country",
      "deliveryDelay" = EXCLUDED."deliveryDelay",
      "logo" = EXCLUDED."logo",
      "image" = EXCLUDED."image",
      "rating" = EXCLUDED."rating",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING id
  `;
  const result = await pool.query(sql, [
    id,
    String(sup._id),
    sup.slug,
    sup.name,
    sup.type,
    sup.country,
    sup.deliveryDelay,
    sup.logo ?? null,
    imageValue,
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
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO "Product" (
      "id", "sourceId", "slug", "name", "description", "images", "productUrl",
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
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
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
  const result = await pool.query(sql, [
    id,
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
 * Sync variants: delete existing ones for this product, then insert sizes and
 * colors as independent rows (not Cartesian product).
 * Each row has either a size or a color (never both).
 */
async function syncVariants(pool, pgProductId, product) {
  await pool.query(
    'DELETE FROM "ProductVariant" WHERE "productId" = $1',
    [pgProductId]
  );

  const variants = [];
  const sizes = product.variants?.size || [];
  const colors = product.variants?.color || [];

  for (const size of sizes) {
    variants.push([crypto.randomUUID(), pgProductId, size, null]);
  }
  for (const color of colors) {
    variants.push([crypto.randomUUID(), pgProductId, null, color]);
  }

  if (variants.length === 0) return 0;

  const values = variants
    .map((_, i) => {
      const base = i * 4 + 1;
      return `($${base}, $${base + 1}, $${base + 2}, $${base + 3})`;
    })
    .join(', ');

  const flatParams = variants.flat();
  const sql = `INSERT INTO "ProductVariant" ("id", "productId", "size", "color") VALUES ${values}`;
  await pool.query(sql, flatParams);

  return variants.length;
}

async function syncMigration(req, res, next) {
  let transactionStarted = false;

  try {
    const dryRun = parseBoolean(req.query.dryRun) === true;
    const pool = getPool();

    // Find pending docs by comparing MongoDB vs PostgreSQL state
    const categoriesResult = await findPendingDocs(pool, 'Category', Category);
    const suppliersResult = await findPendingDocs(pool, 'Supplier', Supplier);
    const productsResult = await findPendingDocs(pool, 'Product', Product);
    const deletedCategorySourceIds = await findDeletedSourceIds(Category);
    const deletedSupplierSourceIds = await findDeletedSourceIds(Supplier);
    const deletedProductSourceIds = await findDeletedSourceIds(Product);

    const pendingCategories = categoriesResult.pending;
    const pendingSuppliers = suppliersResult.pending;
    const pendingProducts = productsResult.pending;

    const totalCategories = categoriesResult.total;
    const totalSuppliers = suppliersResult.total;
    const totalProducts = productsResult.total;

    const syncedCategories = totalCategories - pendingCategories.length;
    const syncedSuppliers = totalSuppliers - pendingSuppliers.length;
    const syncedProducts = totalProducts - pendingProducts.length;
    const deletions = {
      categories: deletedCategorySourceIds.length,
      suppliers: deletedSupplierSourceIds.length,
      products: deletedProductSourceIds.length,
      relatedProducts: 0,
    };

    // Filter out products that can't be migrated (missing references)
    const missingRefs = [];
    const migratableProducts = [];
    for (const { doc: p } of pendingProducts) {
      const catId = p.categoryId ? String(p.categoryId) : null;
      const supId = p.supplierId ? String(p.supplierId) : null;
      if (!catId || !supId) {
        missingRefs.push(String(p._id));
      } else {
        migratableProducts.push({ doc: p, action: pendingProducts.find(pp => String(pp.doc._id) === String(p._id))?.action });
      }
    }

    if (dryRun) {
      const relatedDeletedProductsEstimate =
        pendingProducts.filter(({ doc: product }) =>
          (product.categoryId && deletedCategorySourceIds.includes(String(product.categoryId))) ||
          (product.supplierId && deletedSupplierSourceIds.includes(String(product.supplierId)))
        ).length;

      return ok(res, {
        dryRun: true,
        categories: { total: totalCategories, pending: pendingCategories.length, synced: syncedCategories },
        suppliers: { total: totalSuppliers, pending: pendingSuppliers.length, synced: syncedSuppliers },
        products: { total: totalProducts, pending: migratableProducts.length, synced: syncedProducts, skippedMissingRefs: missingRefs.length },
        totalVariants: migratableProducts.reduce((sum, { doc: p }) => {
          const sizes = p.variants?.size?.length || 0;
          const colors = p.variants?.color?.length || 0;
          return sum + sizes + colors;
        }, 0),
        deletions: {
          categories: deletions.categories,
          suppliers: deletions.suppliers,
          products: deletions.products,
          relatedProducts: relatedDeletedProductsEstimate,
        },
      });
    }

    console.log('[migration] Starting PostgreSQL transaction...');

    // Execute in a transaction
    await pool.query('BEGIN');
    transactionStarted = true;

    let categoryUpserts = 0;
    const categoryMap = {}; // MongoDB _id -> PostgreSQL id

    for (const { doc: cat } of pendingCategories) {
      const pgId = await upsertCategory(pool, cat);
      categoryMap[String(cat._id)] = pgId;
      categoryUpserts++;
    }
    console.log(`[migration] Categories upserted: ${categoryUpserts}`);

    let supplierUpserts = 0;
    const supplierMap = {};

    for (const { doc: sup } of pendingSuppliers) {
      const pgId = await upsertSupplier(pool, sup);
      supplierMap[String(sup._id)] = pgId;
      supplierUpserts++;
    }
    console.log(`[migration] Suppliers upserted: ${supplierUpserts}`);

    let productUpserts = 0;
    let totalVariants = 0;

    for (const { doc: product } of migratableProducts) {
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
        }
      }
      if (!pgSupplierId) {
        throw new Error(`Supplier ${supId} not found for product ${product.name}`);
      }

      const pgProductId = await upsertProduct(pool, product, pgCategoryId, pgSupplierId);
      const variantCount = await syncVariants(pool, pgProductId, product);

      productUpserts++;
      totalVariants += variantCount;
    }
    console.log(`[migration] Products upserted: ${productUpserts}, variants: ${totalVariants}`);

    const deletedRelatedProducts = await deleteProductsByRelatedSourceIds(
      pool,
      deletedCategorySourceIds,
      deletedSupplierSourceIds
    );
    const deletedProducts = await deleteBySourceIds(pool, 'Product', deletedProductSourceIds);
    const deletedSuppliers = await deleteBySourceIds(pool, 'Supplier', deletedSupplierSourceIds);
    const deletedCategories = await deleteBySourceIds(pool, 'Category', deletedCategorySourceIds);

    deletions.relatedProducts = deletedRelatedProducts;
    deletions.products = deletedProducts;
    deletions.suppliers = deletedSuppliers;
    deletions.categories = deletedCategories;

    await pool.query('COMMIT');
    console.log('[migration] Transaction committed successfully.');

    return ok(res, {
      dryRun: false,
      categories: { total: totalCategories, upserted: categoryUpserts, synced: syncedCategories },
      suppliers: { total: totalSuppliers, upserted: supplierUpserts, synced: syncedSuppliers },
      products: { total: totalProducts, upserted: productUpserts, synced: syncedProducts, skippedMissingRefs: missingRefs.length },
      variants: { upserted: totalVariants },
      deletions,
    });
  } catch (error) {
    // Only rollback if transaction was actually started
    if (transactionStarted) {
      try {
        const pool = getPool();
        await pool.query('ROLLBACK');
        console.log('[migration] Transaction rolled back.');
      } catch (_) {
        // ignore rollback errors
      }
    }

    if (error.code === 'ECONNREFUSED' || error.code === '28P01') {
      return fail(res, 503, 'DB_UNAVAILABLE', `Cannot connect to PostgreSQL: ${error.message}`);
    }
    if (error.status) return fail(res, error.status, 'MIGRATION_ERROR', error.message);
    next(error);
  }
}

module.exports = { syncMigration };
