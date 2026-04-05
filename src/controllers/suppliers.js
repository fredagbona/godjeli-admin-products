const { z } = require('zod');
const Supplier = require('../models/Supplier');
const { ok, created, badRequest, notFound, fail } = require('../middlewares/respond');

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const SUPPLIER_TYPES = ['DIRECT', 'MARKETPLACE', 'GROSSISTE', 'RETAIL', 'AGENT'];

const supplierSchema = z.object({
  name: z.string().trim().min(1),
  type: z.nativeEnum(Object.fromEntries(SUPPLIER_TYPES.map((t) => [t, t]))),
  country: z.string().trim().min(1),
  deliveryDelay: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  isActive: z.boolean().optional(),
});

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

async function listSuppliers(req, res, next) {
  try {
    const filter = { deletedAt: null };
    const isActive = parseBoolean(req.query.isActive);

    if (isActive !== undefined) filter.isActive = isActive;
    if (req.query.type && SUPPLIER_TYPES.includes(req.query.type)) filter.type = req.query.type;
    if (req.query.country) filter.country = { $regex: req.query.country, $options: 'i' };
    if (req.query.search) filter.$text = { $search: req.query.search };

    const suppliers = await Supplier.find(filter).sort({ createdAt: -1 });
    return ok(res, suppliers);
  } catch (error) {
    next(error);
  }
}

async function createSupplier(req, res, next) {
  try {
    const data = supplierSchema.parse(req.body);
    const supplier = await Supplier.create(data);
    return created(res, supplier);
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    if (error.code === 11000) return fail(res, 409, 'CONFLICT', 'Un fournisseur avec ce slug existe deja.');
    next(error);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const data = supplierSchema.partial().parse(req.body);

    const supplier = await Supplier.findOne({ _id: id, deletedAt: null });
    if (!supplier) return notFound(res, 'Supplier not found');

    Object.assign(supplier, data);
    await supplier.save();
    return ok(res, supplier);
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    if (error.code === 11000) return fail(res, 409, 'CONFLICT', 'Un fournisseur avec ce slug existe deja.');
    next(error);
  }
}

async function deleteSupplier(req, res, next) {
  try {
    const id = objectIdSchema.parse(req.params.id);
    const supplier = await Supplier.findOne({ _id: id, deletedAt: null });
    if (!supplier) return notFound(res, 'Supplier not found');

    supplier.isActive = false;
    supplier.deletedAt = new Date();
    await supplier.save();

    return ok(res, { id: supplier._id });
  } catch (error) {
    if (error.name === 'ZodError') return badRequest(res, 'Validation failed', error.errors);
    next(error);
  }
}

module.exports = {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
