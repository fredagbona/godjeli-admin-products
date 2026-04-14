const mongoose = require('mongoose');
const { ORIGINS } = require('../services/pricing.service');
const { slugify } = require('../utils/slugify');

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const FX_RATES = {
  EUR_TO_XOF: 700,
  USD_TO_XOF: 600,
};

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
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    productStock: { type: Number, required: true, min: 0, default: 0 },
    productUrl: { type: String, required: true },
    socialProof: {
      type: {
        stars: { type: Number, default: 0, min: 0, max: 5 },
        reviews: { type: Number, default: 0, min: 0 },
        salesCount: { type: Number, default: 0, min: 0 },
      },
      default: {},
    },
    variants: {
      type: {
        size: [{ type: String }],
        color: [{ type: String }],
      },
      default: {},
    },
    pricing: { type: pricingSchema, required: true },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null, index: true },
    migratedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const FX_RATES = {
  EUR_TO_XOF: 700,
  USD_TO_XOF: 600,
};

productSchema.virtual('price').get(function getPrice() {
  const eur = this.pricing?.totalPriceEur;
  if (eur == null) return null;
  return {
    eur: round2(eur),
    xof: Math.round(eur * FX_RATES.EUR_TO_XOF),
  };
});

// Only expose totalPriceEur in API responses, hide internal pricing details
productSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.pricing;
    return ret;
  },
});

productSchema.set('toObject', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.pricing;
    return ret;
  },
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
