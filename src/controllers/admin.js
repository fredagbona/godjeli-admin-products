const { parseAliProduct } = require('../services/aliScraper');
const scraperService = require('../services/scraper.service');
const imageService = require('../services/image.service');
const { computeSellingPrice, convertToFCFA, computeLogisticsCost } = require('../utils/price.calculator');
const Product = require('../models/Product');
const { ok, created, badRequest, fail } = require('../middlewares/respond');
const { z } = require('zod');

// ── POST /api/admin/scrape ────────────────────────────────────────────────────
// Caller provides pre-fetched HTML; server parses with Cheerio (no Puppeteer).

const scrapeSchema = z.object({
  url: z.string().url(),
  html: z.string().min(1),
});

async function scrapeProduct(req, res, next) {
  try {
    const { url, html } = scrapeSchema.parse(req.body);
    return ok(res, parseAliProduct(html, url));
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, 'Validation failed', err.errors);
    next(err);
  }
}

// ── POST /api/admin/fetch-external-data ───────────────────────────────────────
// Caller provides a URL; server fetches with Puppeteer + uploads images to Cloudinary.

const fetchSchema = z.object({ url: z.string().url() });

async function fetchExternalData(req, res, next) {
  try {
    const { url } = fetchSchema.parse(req.body);
    const data = await scraperService.scrapeProduct(url);

    if (data.mainImage) {
      data.mainImage = await imageService.uploadProductImage(data.mainImage);
    }

    data.gallery = data.galleryRaw?.length
      ? await imageService.uploadProductImages(data.galleryRaw)
      : [];
    delete data.galleryRaw;

    return ok(res, data);
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, 'Validation failed', err.errors);
    if (err.status) return fail(res, err.status, 'SCRAPE_ERROR', err.message);
    next(err);
  }
}

// ── POST /api/admin/products ──────────────────────────────────────────────────
// Full pipeline: price calc + image upload + variants parsing + DB save.

const addProductSchema = z.object({
  title: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceSite: z.enum(['aliexpress', 'other']),
  sourcePrice: z.number().positive(),
  currency: z.string().optional(),
  weightKg: z.number().min(0).optional(),
  remoteImageUrl: z.string().optional(),
  hostedImageUrl: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  sizes: z.string().optional(),
});

async function addProduct(req, res, next) {
  try {
    const data = addProductSchema.parse(req.body);

    // 1. Price (EUR) — always computed server-side
    const price = computeSellingPrice(data.sourcePrice);

    // 2. Price (FCFA) — prix_fcfa = prix_euro × 750
    const priceFCFA = convertToFCFA(price);

    // 3. Logistics — poids_kg × 15 € → converti en FCFA
    const logistics = data.weightKg ? computeLogisticsCost(data.weightKg) : null;

    // 4. Image — upload to Cloudinary if not already hosted
    let mainImage = data.hostedImageUrl || null;
    if (!mainImage && data.remoteImageUrl) {
      mainImage = await imageService.uploadProductImage(data.remoteImageUrl);
    }

    // 5. Variants — "S, M, L" → ["S", "M", "L"]
    const variants = data.sizes
      ? data.sizes.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const product = await Product.create({
      title: data.title,
      sourceUrl: data.sourceUrl,
      sourceSite: data.sourceSite,
      sourcePrice: data.sourcePrice,
      price,
      priceFCFA,
      currency: data.currency || 'EUR',
      weightKg: data.weightKg,
      logisticsCostEur: logistics?.eur,
      logisticsCostFCFA: logistics?.fcfa,
      mainImage,
      gallery: data.gallery || [],
      description: data.description,
      category: data.category,
      variants,
    });

    return created(res, product);
  } catch (err) {
    if (err.name === 'ZodError') return badRequest(res, 'Validation failed', err.errors);
    next(err);
  }
}

module.exports = { scrapeProduct, fetchExternalData, addProduct };
