/**
 * Migration PostgreSQL idempotente : ajoute logo + image sur la table "Supplier"
 * (alignée avec le modèle backend et src/controllers/migration.js).
 *
 * Usage:
 *   node scripts/migrate-pg-supplier-media.js
 *   npm run migrate:pg:supplier-media
 *
 * Variables : DATABASE_URL, optionnellement DATABASE_SSL / NODE_ENV (voir src/utils/pgClient.js).
 */
require('dotenv').config();
const { getPool } = require('../src/utils/pgClient');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL manquant.');
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE "Supplier"
      ADD COLUMN IF NOT EXISTS "logo" TEXT
    `);
    console.log('[migrate-pg-supplier-media] Colonne "Supplier"."logo" : vérifiée / ajoutée.');

    await client.query(`
      ALTER TABLE "Supplier"
      ADD COLUMN IF NOT EXISTS "image" TEXT
    `);
    console.log('[migrate-pg-supplier-media] Colonne "Supplier"."image" : vérifiée / ajoutée.');

    await client.query('COMMIT');
    console.log('[migrate-pg-supplier-media] Terminé avec succès.');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore
    }
    console.error('[migrate-pg-supplier-media] Échec:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => {
  process.exit(1);
});
