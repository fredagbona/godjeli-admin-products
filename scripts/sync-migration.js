require('dotenv').config();
const mongoose = require('mongoose');
const { syncMigration } = require('../src/controllers/migration');

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

  const req = {
    query: { dryRun: 'false' },
    headers: {},
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };

  await syncMigration(req, res, (err) => {
    if (err) throw err;
  });

  if (!res.body) {
    throw new Error('No response returned from migration sync.');
  }

  console.log(JSON.stringify({ statusCode: res.statusCode, ...res.body }, null, 2));

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
