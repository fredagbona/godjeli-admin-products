const mongoose = require('mongoose');
const { slugify } = require('../utils/slugify');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

categorySchema.pre('save', async function preSave() {
  if (!this.isModified('name') && this.slug) return;

  const base = slugify(this.name);
  let slug = base;
  let attempt = 0;

  while (true) {
    const conflict = await mongoose.model('Category').findOne({
      slug,
      _id: { $ne: this._id },
    });

    if (!conflict) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  this.slug = slug;
});

categorySchema.index({ name: 'text' });

module.exports = mongoose.model('Category', categorySchema);
