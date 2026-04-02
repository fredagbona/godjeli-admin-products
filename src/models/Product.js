const mongoose = require('mongoose');
const { ORIGINS } = require('../services/pricing.service');
const { slugify } = require('../utils/slugify');

const pricingSchema = new mongoose.Schema(
  {
    costPriceEur: { type: Number, required: true, min: 0 },
    weightGrams: { type: Number, required: true, min: 0 },
    origin: { type: String, required: true, enum: Object.values(ORIGINS) },
    ratePerKgEur: { type: Number, required: true, min: 0 },
    logisticsCostEur: { type: Number, required: true, min: 0 },
    customsFeeEur: { type: Number, required: true, min: 0 },
    paymentFeeEur: { type: Number, required: true, min: 0 },
    marginAmountEur: { type: Number, required: true, min: 0 },
    netMarginEur: { type: Number, required: true },
    displayProductPriceEur: { type: Number, required: true, min: 0 },
    displayShippingAndCustomsBaseEur: { type: Number, required: true, min: 0 },
    displayAdjustmentEur: { type: Number, required: true },
    displayShippingAndCustomsEur: { type: Number, required: true, min: 0 },
    totalPriceEur: { type: Number, required: true, min: 0 },
    totalRealCostEur: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    images: {
      type: [{ type: String }],
      validate: {
        validator: (images) => Array.isArray(images) && images.length > 0,
        message: 'Au moins une image est requise.',
      },
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    pricing: { type: pricingSchema, required: true },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual('price').get(function getPrice() {
  return this.pricing?.totalPriceEur ?? null;
});

productSchema.pre('save', async function preSave() {
  if (!this.isModified('name') && this.slug) return;

  const base = slugify(this.name);
  let slug = base;
  let attempt = 0;

  while (true) {
    const conflict = await mongoose.model('Product').findOne({
      slug,
      _id: { $ne: this._id },
    });

    if (!conflict) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  this.slug = slug;
});

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
