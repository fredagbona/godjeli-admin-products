require('dotenv').config();
const { syncMigration } = require('../src/controllers/migration');

async function main() {
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
