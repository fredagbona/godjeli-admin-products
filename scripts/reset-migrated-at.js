require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected.');

  const collections = ['categories', 'suppliers', 'products'];

  for (const name of collections) {
    const result = await mongoose.connection.db.collection(name).updateMany(
      {},
      { $unset: { migratedAt: '' } }
    );
    console.log(`${name}: ${result.modifiedCount} documents cleared.`);
  }

  console.log('Done. migratedAt has been removed from all documents.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
