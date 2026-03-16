const mongoose = require('mongoose');

function toSlug(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const productSchema = new mongoose.Schema(
  {
    // Identifiers
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },

    // Financials (EUR)
    price: { type: Number, required: true, min: 0 },
    sourcePrice: { type: Number, min: 0 },
    currency: { type: String, default: 'EUR' },

    // Financials (FCFA)
    priceFCFA: { type: Number, min: 0 },

    // Logistics
    weightKg: { type: Number, min: 0 },
    logisticsCostEur: { type: Number, min: 0 },
    logisticsCostFCFA: { type: Number, min: 0 },

    // Media & source
    mainImage: { type: String },
    gallery: [{ type: String }],
    sourceUrl: { type: String },
    sourceSite: { type: String, enum: ['aliexpress', 'other'] },

    // Attributes & stock
    category: { type: String, index: true },
    variants: [{ type: String }],
    description: { type: String },

    // Meta
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate slug from title before saving
productSchema.pre('save', async function () {
  if (!this.isModified('title') && this.slug) return;

  const base = toSlug(this.title);
  let slug = base;
  let attempt = 0;

  while (true) {
    const conflict = await mongoose.model('Product').findOne({ slug, _id: { $ne: this._id } });
    if (!conflict) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  this.slug = slug;
});

// Text index for fast client-side search
productSchema.index({ title: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
