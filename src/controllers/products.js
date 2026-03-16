const Product = require('../models/Product');
const { ok, created, notFound, badRequest } = require('../middlewares/respond');
const { z } = require('zod');

const productSchema = z.object({
  title: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceSite: z.enum(['shein', 'aliexpress', 'other']).optional(),
  price: z.number().min(0),
  sourcePrice: z.number().min(0).optional(),
  currency: z.string().optional(),
  mainImage: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  variants: z.array(z.string()).optional(),
});

async function listProducts(req, res, next) {
  try {
    const filter = { isVisible: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) filter.$text = { $search: req.query.search };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    return ok(res, products);
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findOne({
      $or: [
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
        { slug: req.params.id },
      ],
      isVisible: true,
    });
    if (!product) return notFound(res, 'Product not found');
    return ok(res, product);
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const data = productSchema.parse(req.body);
    const product = await Product.create(data);
    return created(res, product);
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, 'Validation failed', err.errors);
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res, 'Product not found');

    Object.assign(product, data);
    await product.save();
    return ok(res, product);
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, 'Validation failed', err.errors);
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isVisible: false },
      { new: true }
    );
    if (!product) return notFound(res, 'Product not found');
    return ok(res, { id: product._id });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
