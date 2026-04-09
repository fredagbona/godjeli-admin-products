const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      const error = new Error('DATABASE_URL is not configured.');
      error.status = 500;
      throw error;
    }
    // SSL is controlled by DATABASE_SSL env var:
    //   "true"    → { rejectUnauthorized: false }
    //   "false"   → false (no SSL)
    //   omitted   → auto: true in production, false otherwise
    let sslOption;
    if (process.env.DATABASE_SSL === 'true') {
      sslOption = { rejectUnauthorized: false };
    } else if (process.env.DATABASE_SSL === 'false') {
      sslOption = false;
    } else {
      sslOption = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
    }
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: sslOption,
    });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

module.exports = { getPool, query };
