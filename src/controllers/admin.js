const { parseSheinProduct } = require('../services/sheinScraper');
const { parseAliProduct } = require('../services/aliScraper');
const scraperService = require('../services/scraper.service');
const imageService = require('../services/image.service');
const { computeSellingPrice } = require('../utils/price.calculator');
const Product = require('../models/Product');
const { z } = require('zod');

const scrapeSchema = z.object({
  url: z.string().url(),
  site: z.enum(['shein', 'aliexpress']),
  html: z.string().min(1),
});

/**
 * POST /admin/scrape
 * Receives pre-fetched HTML + URL and returns parsed product fields.
 * The caller is responsible for fetching the HTML (e.g. with Puppeteer on the client side).
 */
async function scrapeProduct(req, res, next) {
  try {
    const { url, site, html } = scrapeSchema.parse(req.body);

    let parsed;
    if (site === 'shein') {
      parsed = parseSheinProduct(html, url);
    } else {
      parsed = parseAliProduct(html, url);
    }

    res.json(parsed);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
}

const fetchSchema = z.object({ url: z.string().url() });

/**
 * POST /api/admin/fetch-external-data
 * Takes a raw URL, launches Puppeteer server-side, and returns scraped product fields.
 */
async function fetchExternalData(req, res, next) {
  try {
    const { url } = fetchSchema.parse(req.body);
    const data = await scraperService.scrapeProduct(url);

    // Host the image on Cloudinary immediately so the frontend gets a stable URL
    if (data.mainImage) {
      data.mainImage = await imageService.uploadProductImage(data.mainImage);
    }

    res.json(data);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

const addProductSchema = z.object({
  title: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceSite: z.enum(['shein', 'aliexpress', 'other']),
  sourcePrice: z.number().positive(),
  currency: z.string().optional(),
  remoteImageUrl: z.string().optional(),  // raw external image to upload
  hostedImageUrl: z.string().optional(),  // already-hosted Cloudinary URL
  description: z.string().optional(),
  category: z.string().optional(),
  sizes: z.string().optional(),           // comma-separated: "S, M, L, XL"
});

/**
 * POST /api/admin/products
 * Full pipeline: compute selling price server-side, upload image, parse variants, save.
 */
async function addProduct(req, res, next) {
  try {
    const data = addProductSchema.parse(req.body);

    // 1. Price — always computed server-side
    const price = computeSellingPrice(data.sourcePrice);

    // 2. Image — upload remote URL to Cloudinary if not already hosted
    let mainImage = data.hostedImageUrl || null;
    if (!mainImage && data.remoteImageUrl) {
      mainImage = await imageService.uploadProductImage(data.remoteImageUrl);
    }

    // 3. Variants — "S, M, L" → ["S", "M", "L"]
    const variants = data.sizes
      ? data.sizes.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const product = await Product.create({
      title: data.title,
      sourceUrl: data.sourceUrl,
      sourceSite: data.sourceSite,
      sourcePrice: data.sourcePrice,
      price,
      currency: data.currency || 'EUR',
      mainImage,
      description: data.description,
      category: data.category,
      variants,
    });

    res.status(201).json(product);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
}

module.exports = { scrapeProduct, fetchExternalData, addProduct };
