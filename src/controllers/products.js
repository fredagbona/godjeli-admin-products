const { z } = require('zod');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const { buildPricing, ORIGINS } = require('../services/pricing.service');
const { ok, created, notFound, badRequest, fail } = require('../middlewares/respond');

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const productSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  categoryId: objectIdSchema,
  supplierId: objectIdSchema,
  images: z.array(z.string().url()).min(1),
  productStock: z.number().int().min(0),
  productUrl: z.string().url(),
  socialProof: z.object({
    stars: z.number().min(0).max(5).optional().default(0),
    reviews: z.number().int().min(0).optional().default(0),
    salesCount: z.number().int().min(0).optional().default(0),
  }).optional().default({}),
  variants: z.object({
    size: z.array(z.string()).optional().default([]),
    color: z.array(z.string()).optional().default([]),
  }).optional().default({}),
  isPromoted: z.boolean().optional().default(false),
  promotionDiscountRate: z.number().min(0).max(1).optional().default(0),
  costPriceEur: z.number().min(0),
  weightGrams: z.number().min(0),
  origin: z.nativeEnum(ORIGINS),
  isActive: z.boolean().optional(),
});

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

async function ensureActiveCategory(categoryId) {
  const category = await Category.findOne({
    _id: categoryId,
    deletedAt: null,
    isActive: true,
  });

  if (!category) {
    const error = new Error('La categorie est introuvable ou inactive.');
    error.status = 400;
    throw error;
  }

  return category;
}

async function ensureActiveSupplier(supplierId) {
  const supplier = await Supplier.findOne({
    _id: supplierId,
    deletedAt: null,
    isActive: true,
  });

  if (!supplier) {
    const error = new Error('Le fournisseur est introuvable ou inactif.');
    error.status = 400;
    throw error;
  }

  return supplier;
}

function buildProductPayload(data) {
  return {
    name: data.name,
    description: data.description,
    categoryId: data.categoryId,
    supplierId: data.supplierId,
    images: data.images,
    productStock: data.productStock,
    productUrl: data.productUrl,
    socialProof: data.socialProof,
    variants: data.variants,
    isPromoted: data.isPromoted ?? false,
    promotionDiscountRate: data.promotionDiscountRate ?? 0,
    isActive: data.isActive ?? true,
    pricing: buildPricing({
      costPriceEur: data.costPriceEur,
      weightGrams: data.weightGrams,
      origin: data.origin,
    }),
  };
}

async function listProducts(req, res, next) {
  try {
    const filter = { deletedAt: null };
    const isActive = parseBoolean(req.query.isActive);

    if (isActive !== undefined) filter.isActive = isActive;
    if (req.query.categoryId) filter.categoryId = objectIdSchema.parse(req.query.categoryId);
    if (req.query.search) filter.$text = { $search: req.query.search };

    const products = await Product.find(filter)
      .populate('categoryId')
      .populate('supplierId')
      .sort({ createdAt: -1 });

    return ok(res, products);
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const selector = req.params.id.match(/^[a-f\d]{24}$/i)
      ? { _id: req.params.id }
      : { slug: req.params.id };

    const product = await Product.findOne({
      ...selector,
      deletedAt: null,
    })
      .populate('categoryId')
      .populate('supplierId');

    if (!product) return notFound(res, 'Product not found');
    return ok(res, product);
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const data = productSchema.parse(req.body);
    await ensureActiveCategory(data.categoryId);
    await ensureActiveSupplier(data.supplierId);

    const product = await Product.create(buildProductPayload(data));
    await product.populate('categoryId');
    await product.populate('supplierId');

    return created(res, product);
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    if (error.code === 11000) return fail(res, 409, 'CONFLICT', 'Un produit avec ce slug existe deja.');
    if (error.status) return fail(res, error.status, 'REQUEST_ERROR', error.message);
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const data = productSchema.partial().parse(req.body);

    const product = await Product.findOne({ _id: id, deletedAt: null });
    if (!product) return notFound(res, 'Product not found');

    const nextCategoryId = data.categoryId || String(product.categoryId);
    await ensureActiveCategory(nextCategoryId);

    const nextSupplierId = data.supplierId || String(product.supplierId);
    await ensureActiveSupplier(nextSupplierId);

    const pricingInput = {
      costPriceEur: data.costPriceEur ?? product.pricing.costPriceEur,
      weightGrams: data.weightGrams ?? product.pricing.weightGrams,
      origin: data.origin ?? product.pricing.origin,
    };

    if (data.name !== undefined) product.name = data.name;
    if (data.description !== undefined) product.description = data.description;
    if (data.images !== undefined) product.images = data.images;
    if (data.categoryId !== undefined) product.categoryId = data.categoryId;
    if (data.supplierId !== undefined) product.supplierId = data.supplierId;
    if (data.productStock !== undefined) product.productStock = data.productStock;
    if (data.productUrl !== undefined) product.productUrl = data.productUrl;
    if (data.socialProof !== undefined) product.socialProof = data.socialProof;
    if (data.variants !== undefined) product.variants = data.variants;
    if (data.isPromoted !== undefined) product.isPromoted = data.isPromoted;
    if (data.promotionDiscountRate !== undefined) product.promotionDiscountRate = data.promotionDiscountRate;
    if (data.isActive !== undefined) product.isActive = data.isActive;

    product.pricing = buildPricing(pricingInput);

    await product.save();
    await product.populate('categoryId');
    await product.populate('supplierId');

    return ok(res, product);
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    if (error.code === 11000) return fail(res, 409, 'CONFLICT', 'Un produit avec ce slug existe deja.');
    if (error.status) return fail(res, error.status, 'REQUEST_ERROR', error.message);
    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const product = await Product.findOne({ _id: id, deletedAt: null });

    if (!product) return notFound(res, 'Product not found');

    product.isActive = false;
    product.deletedAt = new Date();
    await product.save();

    return ok(res, { id: product._id });
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    next(error);
  }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
