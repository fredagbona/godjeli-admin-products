const { z } = require('zod');
const Category = require('../models/Category');
const { ok, created, badRequest, notFound, fail } = require('../middlewares/respond');

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const categorySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
  image: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

async function listCategories(req, res, next) {
  try {
    const filter = { deletedAt: null };
    const isActive = parseBoolean(req.query.isActive);

    if (isActive !== undefined) filter.isActive = isActive;
    if (req.query.search) filter.$text = { $search: req.query.search };

    const categories = await Category.find(filter).sort({ createdAt: -1 });
    return ok(res, categories);
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const data = categorySchema.parse(req.body);
    const category = await Category.create(data);
    return created(res, category);
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    if (error.code === 11000) return fail(res, 409, 'CONFLICT', 'Une categorie avec ce slug existe deja.');
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const data = categorySchema.partial().parse(req.body);

    const category = await Category.findOne({ _id: id, deletedAt: null });
    if (!category) return notFound(res, 'Category not found');

    Object.assign(category, data);
    await category.save();
    return ok(res, category);
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    if (error.code === 11000) return fail(res, 409, 'CONFLICT', 'Une categorie avec ce slug existe deja.');
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const category = await Category.findOne({ _id: id, deletedAt: null });
    if (!category) return notFound(res, 'Category not found');

    category.isActive = false;
    category.deletedAt = new Date();
    await category.save();

    return ok(res, { id: category._id });
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    next(error);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
