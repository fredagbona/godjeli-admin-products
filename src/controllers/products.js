const { z } = require('zod');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const { ok, created, notFound, badRequest, fail } = require('../middlewares/respond');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identifiant invalide.');
const nonempty = (label, max = 2000) => z.string().trim().min(1, `Le champ ${label} est obligatoire.`).max(max, `Le champ ${label} ne doit pas dépasser ${max} caractères.`);
const imageUrl = z.string().url('Une URL d’image est invalide.');
const imageSchema = z.object({
  url: imageUrl,
  alt: z.string().trim().max(125, 'Le texte alternatif est limité à 125 caractères.').optional()
}).strict();
const valueSchema = z.object({
  value: nonempty('valeur'),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'La couleur doit être au format #RRGGBB.').optional(),
  images: z.array(imageUrl).optional()
}).strict();
const optionSchema = z.object({
  name: nonempty('nom de variante', 120),
  type: z.enum(['COLOR', 'TEXT']),
  values: z.array(valueSchema).min(1, 'Chaque variante doit avoir au moins une valeur.')
}).strict();
const productFields = z.object({
  name: nonempty('nom', 120),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'], { errorMap: () => ({ message: 'Le statut doit être DRAFT, PUBLISHED ou ARCHIVED.' }) }),
  categoryId: objectId.optional(),
  supplierId: objectId.optional(),
  description: nonempty('description', 2000).optional(),
  mainImage: imageSchema.optional(),
  gallery: z.array(imageUrl).optional(),
  variantOptions: z.array(optionSchema).max(3, 'Trois options de variantes maximum.').optional(),
  salePriceXof: z.number().int().positive('Le prix de vente doit être supérieur à 0.').optional(),
  costPriceXof: z.number().int().positive('Le coût d’achat doit être supérieur à 0.').optional(),
  stock: z.number().int().min(0, 'Le stock ne peut pas être négatif.').optional()
}).strict();

function validateProduct(data) {
  const result = productFields.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const error = new Error(issue.message || 'Les données du produit sont invalides.');
    error.status = 400;
    throw error;
  }
  const product = result.data;
  if (product.status !== 'DRAFT') {
    for (const key of ['categoryId', 'supplierId', 'description', 'mainImage', 'salePriceXof', 'costPriceXof', 'stock']) {
      if (product[key] === undefined) {
        const error = new Error(`Le champ ${key} est obligatoire pour publier ou archiver un produit.`);
        error.status = 400;
        throw error;
      }
    }
    if (!product.gallery?.length) {
      const error = new Error('La galerie doit contenir au moins une image.');
      error.status = 400;
      throw error;
    }
  }
  const allImages = [product.mainImage?.url, ...(product.gallery || [])].filter(Boolean);
  if (allImages.length > 10) {
    const error = new Error('Dix images maximum au total.');
    error.status = 400;
    throw error;
  }
  const optionNames = new Set();
  for (const option of product.variantOptions || []) {
    const name = option.name.toLocaleLowerCase('fr');
    if (optionNames.has(name)) throw Object.assign(new Error('Les noms des variantes doivent être uniques.'), { status: 400 });
    optionNames.add(name);
    const values = new Set();
    for (const value of option.values) {
      const key = value.value.toLocaleLowerCase('fr');
      if (values.has(key)) throw Object.assign(new Error(`La variante ${option.name} contient une valeur en double.`), { status: 400 });
      values.add(key);
      if (option.type === 'TEXT' && (value.hex !== undefined || value.images !== undefined)) {
        throw Object.assign(new Error('Les pastilles et images sont réservées aux variantes COLOR.'), { status: 400 });
      }
      for (const url of value.images || []) {
        if (!allImages.includes(url)) throw Object.assign(new Error('Les images des couleurs doivent appartenir aux images du produit.'), { status: 400 });
      }
    }
  }
  return product;
}

async function validateRelations(data) {
  if (data.categoryId && !(await Category.exists({ _id: data.categoryId, isActive: true, deletedAt: null }))) {
    throw Object.assign(new Error('La catégorie est introuvable ou inactive.'), { status: 404 });
  }
  if (data.supplierId && !(await Supplier.exists({ _id: data.supplierId, isActive: true, deletedAt: null }))) {
    throw Object.assign(new Error('La boutique est introuvable ou inactive.'), { status: 404 });
  }
}

function parseBoolean(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
function handleError(res, next, error) {
  if (error.status === 404) return notFound(res, error.message);
  if (error.status === 400 || error.name === 'ZodError') return badRequest(res, error.message);
  if (error.code === 11000) return fail(res, 409, 'CONFLICT', 'La référence ou le slug existe déjà.');
  next(error);
}
function mappedFields(data) {
  return {
    ...data,
    images: [data.mainImage?.url, ...(data.gallery || [])].filter(Boolean),
    productStock: data.stock ?? 0,
    isActive: data.status === 'PUBLISHED'
  };
}
async function listProducts(req, res, next) {
  try {
    const filter = { deletedAt: null };
    const active = parseBoolean(req.query.isActive);
    if (active !== undefined) filter.isActive = active;
    if (req.query.status) {
      if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(req.query.status)) return badRequest(res, 'Statut invalide.');
      filter.status = req.query.status;
    }
    if (req.query.categoryId) filter.categoryId = objectId.parse(req.query.categoryId);
    if (req.query.search) filter.$text = { $search: req.query.search };
    return ok(res, await Product.find(filter).populate('categoryId').populate('supplierId').sort({ createdAt: -1 }));
  } catch (e) { handleError(res, next, e); }
}
async function getProduct(req, res, next) {
  try {
    const selector = /^[a-f\d]{24}$/i.test(req.params.id) ? { _id: req.params.id } : { slug: req.params.id };
    const product = await Product.findOne({ ...selector, deletedAt: null }).populate('categoryId').populate('supplierId');
    if (!product) return notFound(res, 'Produit introuvable.');
    return ok(res, product);
  } catch (e) { handleError(res, next, e); }
}
async function createProduct(req, res, next) {
  try {
    const data = validateProduct(req.body);
    await validateRelations(data);
    const product = await Product.create(mappedFields(data));
    await product.populate('categoryId');
    await product.populate('supplierId');
    return created(res, product);
  } catch (e) { handleError(res, next, e); }
}
async function updateProduct(req, res, next) {
  try {
    const id = objectId.parse(req.params.id);
    if ('sku' in req.body) return badRequest(res, 'Le SKU ne peut pas être modifié.');
    const patch = productFields.partial().strict().parse(req.body);
    const product = await Product.findOne({ _id: id, deletedAt: null });
    if (!product) return notFound(res, 'Produit introuvable.');
    const current = {};
    for (const key of Object.keys(productFields.shape)) {
      if (product[key] !== undefined && product[key] !== null) current[key] = ['categoryId', 'supplierId'].includes(key) ? String(product[key]) : (typeof product[key]?.toObject === 'function' ? product[key].toObject() : product[key]);
    }
    current.status = current.status || (product.isActive ? 'PUBLISHED' : 'ARCHIVED');
    if (!current.mainImage && product.images?.length) current.mainImage = { url: product.images[0] };
    if (!current.gallery && product.images?.length > 1) current.gallery = product.images.slice(1);
    const data = validateProduct({ ...current, ...patch });
    await validateRelations(data);
    Object.assign(product, mappedFields(data));
    await product.save();
    await product.populate('categoryId');
    await product.populate('supplierId');
    return ok(res, product);
  } catch (e) { handleError(res, next, e); }
}
async function deleteProduct(req, res, next) {
  try {
    const id = objectId.parse(req.params.id);
    const product = await Product.findOne({ _id: id, deletedAt: null });
    if (!product) return notFound(res, 'Produit introuvable.');
    product.isActive = false;
    product.deletedAt = new Date();
    await product.save();
    return ok(res, { id: product._id });
  } catch (e) { handleError(res, next, e); }
}
module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct, validateProduct };
