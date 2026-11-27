// Non-destructive, idempotent V2 backfill. Run after deploying the schema, then run sync.
require('dotenv').config();
const { connectDB } = require('../src/config');
const Product = require('../src/models/Product');

async function main() {
  const dryRun = !process.argv.includes('--apply');
  await connectDB();
  const products = await Product.find({});
  const report = { total: products.length, updated: 0, missingGallery: [], missingPricing: [], missingReferences: [] };
  for (const product of products) {
    let modified = false;
    if (!product.status) { product.status = product.isActive ? 'PUBLISHED' : 'ARCHIVED'; modified = true; }
    if (product.salePriceXof == null && product.pricing?.totalPriceEur != null) {
      product.salePriceXof = Math.round(product.pricing.totalPriceEur * 700);
      modified = true;
    }
    if (product.costPriceXof == null && product.pricing?.costPriceEur != null) {
      product.costPriceXof = Math.round(product.pricing.costPriceEur * 700);
      modified = true;
    }
    if (product.stock == null) { product.stock = product.productStock ?? 0; modified = true; }
    if (!product.mainImage?.url && product.images?.length) {
      product.mainImage = { url: product.images[0] };
      modified = true;
    }
    if (!product.gallery && product.images?.length) {
      product.gallery = product.images.slice(1);
      modified = true;
    }
    if (!product.variantOptions) {
      const options = [];
      for (const [name, type, values] of [
        ['Taille', 'TEXT', product.variants?.size || []],
        ['Couleur', 'COLOR', product.variants?.color || []]
      ]) {
        if (values.length) options.push({
          name, type,
          values: [...new Set(values)].map(value => ({ value }))
        });
      }
      product.variantOptions = options;
      modified = true;
    }
    if (!product.sku) modified = true;
    if (!product.gallery?.length) report.missingGallery.push(String(product._id));
    if (!product.salePriceXof || !product.costPriceXof) report.missingPricing.push(String(product._id));
    if (!product.categoryId || !product.supplierId) report.missingReferences.push(String(product._id));
    if (modified) {
      report.updated++;
      if (!dryRun) await product.save();
    }
  }
  process.stdout.write(JSON.stringify({ dryRun, ...report }, null, 2) + '\n');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
