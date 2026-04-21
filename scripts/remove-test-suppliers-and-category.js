/**
 * Supprime (Mongo: soft delete comme l’API) les fournisseurs et la catégorie de test,
 * puis aligne PostgreSQL (hard delete des lignes correspondantes et des produits liés).
 *
 * Cible les enregistrements par slug (prioritaire) et par alias de nom (anciennes variantes).
 *
 * Usage: node scripts/remove-test-suppliers-and-category.js
 * Requiert: MONGODB_URI, DATABASE_URL (et DATABASE_SSL si besoin — voir src/utils/pgClient.js)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { getPool } = require('../src/utils/pgClient');
const Category = require('../src/models/Category');
const Supplier = require('../src/models/Supplier');
const Product = require('../src/models/Product');

/** Slugs uniques générés par les modèles (source de vérité la plus fiable). */
const TARGET_CATEGORY_SLUGS = ['test-category'];
const TARGET_SUPPLIER_SLUGS = ['shein-test', 'fashion-wholesale-paris'];

/** Alias de noms (historique / fautes de frappe dans les specs). */
const CATEGORY_NAME_ALIASES = ['Test Category', 'Test Categorie'];
const SUPPLIER_NAME_ALIASES = [
  'SHEIN TEST',
  'Shein Test',
  'FASHION WHOLESALE PARIS',
  'Fashion Wholesale Paris',
];

function categoryMatchFilter() {
  return {
    $or: [
      { slug: { $in: TARGET_CATEGORY_SLUGS } },
      { name: { $in: CATEGORY_NAME_ALIASES } },
    ],
  };
}

function supplierMatchFilter() {
  return {
    $or: [
      { slug: { $in: TARGET_SUPPLIER_SLUGS } },
      { name: { $in: SUPPLIER_NAME_ALIASES } },
    ],
  };
}

function log(section, message) {
  console.log(`[${section}] ${message}`);
}

/**
 * Soft-delete si encore actif. Utilise updateOne + $set pour ne pas ré-valider
 * tout le document (certains produits peuvent être incomplets mais encore liés à la catégorie cible).
 */
async function softDeleteIfActive(doc, label) {
  if (!doc) {
    return { didChange: false, doc: null };
  }
  if (doc.deletedAt != null) {
    log('mongo', `${label} "${doc.name}" (slug=${doc.slug}) déjà soft-supprimé, rien à faire.`);
    return { didChange: false, doc };
  }
  const Model = doc.constructor;
  const now = new Date();
  await Model.updateOne(
    { _id: doc._id },
    { $set: { isActive: false, deletedAt: now } }
  );
  log('mongo', `${label} "${doc.name}" (slug=${doc.slug}) soft-supprimé (_id=${doc._id}).`);
  return { didChange: true, doc };
}

function logMissingMongoTargets(suppliers, categories) {
  for (const slug of TARGET_SUPPLIER_SLUGS) {
    if (!suppliers.some((s) => s.slug === slug)) {
      log('mongo', `Aucun fournisseur avec slug "${slug}" — rien à faire côté Mongo pour ce slug.`);
    }
  }
  for (const slug of TARGET_CATEGORY_SLUGS) {
    if (!categories.some((c) => c.slug === slug)) {
      log('mongo', `Aucune catégorie avec slug "${slug}" — rien à faire côté Mongo pour ce slug.`);
    }
  }
}

async function runMongo() {
  const suppliers = await Supplier.find(supplierMatchFilter());
  const categories = await Category.find(categoryMatchFilter());

  logMissingMongoTargets(suppliers, categories);

  for (const s of suppliers) {
    await softDeleteIfActive(s, 'Fournisseur');
  }

  for (const c of categories) {
    await softDeleteIfActive(c, 'Catégorie');
  }

  const supplierIds = suppliers.map((s) => s._id);
  const categoryIds = categories.map((c) => c._id);

  const productFilter = {
    deletedAt: null,
    $or: [
      ...(categoryIds.length ? [{ categoryId: { $in: categoryIds } }] : []),
      ...(supplierIds.length ? [{ supplierId: { $in: supplierIds } }] : []),
    ],
  };

  if (!productFilter.$or.length) {
    log('mongo', 'Aucun produit à traiter (pas de catégorie/fournisseur cibles trouvés).');
    return {
      categorySourceIds: categories.map((c) => String(c._id)),
      supplierSourceIds: suppliers.map((s) => String(s._id)),
    };
  }

  const products = await Product.find(productFilter);
  if (products.length === 0) {
    log('mongo', 'Aucun produit actif lié à ces entités.');
  }
  for (const p of products) {
    await softDeleteIfActive(p, 'Produit');
  }

  return {
    categorySourceIds: categories.map((c) => String(c._id)),
    supplierSourceIds: suppliers.map((s) => String(s._id)),
  };
}

async function runPostgres({ categorySourceIds, supplierSourceIds }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const delVariants = `
      DELETE FROM "ProductVariant" pv
      USING "Product" p
      WHERE pv."productId" = p.id
        AND (
          p."categoryId" IN (
            SELECT id FROM "Category"
            WHERE slug = ANY($1::text[])
               OR name = ANY($2::text[])
               OR "sourceId" = ANY($3::text[])
          )
          OR p."supplierId" IN (
            SELECT id FROM "Supplier"
            WHERE slug = ANY($4::text[])
               OR name = ANY($5::text[])
               OR "sourceId" = ANY($6::text[])
          )
        )
    `;
    const vRes = await client.query(delVariants, [
      TARGET_CATEGORY_SLUGS,
      CATEGORY_NAME_ALIASES,
      categorySourceIds,
      TARGET_SUPPLIER_SLUGS,
      SUPPLIER_NAME_ALIASES,
      supplierSourceIds,
    ]);
    log('postgres', `ProductVariant supprimées: ${vRes.rowCount ?? 0}.`);

    const delProducts = `
      DELETE FROM "Product"
      WHERE "categoryId" IN (
        SELECT id FROM "Category"
        WHERE slug = ANY($1::text[])
           OR name = ANY($2::text[])
           OR "sourceId" = ANY($3::text[])
      )
      OR "supplierId" IN (
        SELECT id FROM "Supplier"
        WHERE slug = ANY($4::text[])
           OR name = ANY($5::text[])
           OR "sourceId" = ANY($6::text[])
      )
    `;
    const pRes = await client.query(delProducts, [
      TARGET_CATEGORY_SLUGS,
      CATEGORY_NAME_ALIASES,
      categorySourceIds,
      TARGET_SUPPLIER_SLUGS,
      SUPPLIER_NAME_ALIASES,
      supplierSourceIds,
    ]);
    log('postgres', `Product supprimés: ${pRes.rowCount ?? 0}.`);

    const delSup = `
      DELETE FROM "Supplier"
      WHERE slug = ANY($1::text[])
         OR name = ANY($2::text[])
         OR "sourceId" = ANY($3::text[])
    `;
    const sRes = await client.query(delSup, [
      TARGET_SUPPLIER_SLUGS,
      SUPPLIER_NAME_ALIASES,
      supplierSourceIds,
    ]);
    log('postgres', `Supplier supprimés: ${sRes.rowCount ?? 0}.`);

    const delCat = `
      DELETE FROM "Category"
      WHERE slug = ANY($1::text[])
         OR name = ANY($2::text[])
         OR "sourceId" = ANY($3::text[])
    `;
    const cRes = await client.query(delCat, [
      TARGET_CATEGORY_SLUGS,
      CATEGORY_NAME_ALIASES,
      categorySourceIds,
    ]);
    log('postgres', `Category supprimées: ${cRes.rowCount ?? 0}.`);

    await client.query('COMMIT');
    log('postgres', 'Transaction validée.');
  } catch (err) {
    await client.query('ROLLBACK');
    log('postgres', `Rollback: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI manquant.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL manquant.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  log('mongo', 'Connecté.');

  let sourceIds;
  try {
    sourceIds = await runMongo();
  } finally {
    await mongoose.disconnect();
    log('mongo', 'Déconnecté.');
  }

  await runPostgres(sourceIds);
  log('done', 'Terminé.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
