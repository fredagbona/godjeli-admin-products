const mongoose = require('mongoose');
const { slugify } = require('../utils/slugify');

const SUPPLIER_TYPES = ['DIRECT', 'MARKETPLACE', 'GROSSISTE', 'RETAIL', 'AGENT'];

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    type: { type: String, required: true, enum: SUPPLIER_TYPES },
    country: { type: String, required: true, trim: true },
    deliveryDelay: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null, index: true },
    migratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supplierSchema.pre('save', async function preSave() {
  if (!this.isModified('name') && this.slug) return;

  const base = slugify(this.name);
  let slug = base;
  let attempt = 0;

  while (true) {
    const conflict = await mongoose.model('Supplier').findOne({
      slug,
      _id: { $ne: this._id },
    });

    if (!conflict) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  this.slug = slug;
});

supplierSchema.index({ name: 'text', country: 'text' });

module.exports = mongoose.model('Supplier', supplierSchema);
