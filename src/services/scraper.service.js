const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const NAV_TIMEOUT = 30000;
const SEL_TIMEOUT = 15000;

function detectSite(url) {
  if (url.includes('aliexpress.com')) return 'aliexpress';
  return null;
}

function validateProductUrl(url) {
  if (!detectSite(url)) {
    const err = new Error('URL non supportée. Seul AliExpress est accepté.');
    err.status = 400;
    throw err;
  }
  if (!url.endsWith('.html')) {
    const err = new Error("L'URL doit pointer vers une page produit et se terminer par .html");
    err.status = 400;
    throw err;
  }
}

async function extractAli(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await new Promise((r) => setTimeout(r, 4000));
  await page.waitForSelector('h1', { timeout: SEL_TIMEOUT }).catch(() => {});

  return page.evaluate(() => {
    let title = '';
    let originalPrice = 0;
    let mainImage = '';
    let galleryRaw = [];

    // ── Strategy 1: window.runParams (AliExpress embeds full product state here) ──
    try {
      const data = window.runParams?.data;
      if (data) {
        title = data.productInfoComponent?.subject || '';
        const priceComp = data.priceComponent;
        if (priceComp) {
          const raw =
            priceComp.discountPrice?.minActivityPrice ||
            priceComp.originalPrice?.minPrice ||
            priceComp.discountPrice?.minPrice ||
            '';
          originalPrice = parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
        }
        const imgComp = data.imageComponent;
        if (imgComp?.imagePathList?.length) {
          const list = imgComp.imagePathList.map((u) =>
            u.startsWith('//') ? `https:${u}` : u
          );
          mainImage = list[0];
          galleryRaw = list.slice(1);
        }
      }
    } catch (_) {}

    // ── Strategy 2: JSON-LD ───────────────────────────────────────────────────────
    if (!title) {
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of scripts) {
          const d = JSON.parse(s.textContent);
          const product = d['@type'] === 'Product' ? d :
            (d['@graph'] || []).find((n) => n['@type'] === 'Product');
          if (product) {
            title = title || product.name || '';
            const imgs = Array.isArray(product.image) ? product.image : (product.image ? [product.image] : []);
            mainImage = mainImage || imgs[0] || '';
            if (!galleryRaw.length) galleryRaw = imgs.slice(1);
            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
            if (offer) originalPrice = originalPrice || parseFloat(String(offer.price).replace(',', '.')) || 0;
            break;
          }
        }
      } catch (_) {}
    }

    // ── Strategy 3: DOM selectors fallback ───────────────────────────────────────
    if (!title) {
      title =
        document.querySelector('h1[data-pl="product-title"]')?.textContent?.trim() ||
        document.querySelector('h1.product-title-text')?.textContent?.trim() ||
        document.querySelector('h1')?.textContent?.trim() || '';
    }

    if (!originalPrice) {
      const priceEl =
        document.querySelector('[class*="price--current"]') ||
        document.querySelector('.product-price-value') ||
        document.querySelector('[class*="uniform-banner-box-price"]') ||
        document.querySelector('[class*="Price"] span');
      const raw = priceEl?.textContent?.trim() || '';
      originalPrice = parseFloat(raw.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    }

    if (!mainImage) {
      const imgEl =
        document.querySelector('.magnifier-image') ||
        document.querySelector('[class*="image-view"] img') ||
        document.querySelector('[class*="slider"] img');
      let src = imgEl?.src || '';
      if (src.startsWith('//')) src = `https:${src}`;
      mainImage = src;
    }

    // ── Gallery DOM fallback ──────────────────────────────────────────────────────
    if (!galleryRaw.length) {
      const thumbSelectors = [
        '[class*="thumb"] img', '[class*="Thumb"] img',
        '[class*="thumbnail"] img', '[class*="gallery"] img',
        '[class*="Gallery"] img', '[class*="slider"] img',
        '[class*="Slider"] img', '[class*="img-item"] img',
      ];
      for (const sel of thumbSelectors) {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length > 1) {
          galleryRaw = els
            .map((el) => {
              let src = el.src || el.dataset.src || '';
              src = src.replace(/_\d+x\d+(\.\w+)$/, '$1');
              if (src.startsWith('//')) src = `https:${src}`;
              return src;
            })
            .filter((src) => src && !src.includes('data:'));
          if (galleryRaw.length) break;
        }
      }
      if (galleryRaw[0] === mainImage) galleryRaw = galleryRaw.slice(1);
    }

    return { title, originalPrice, currency: 'EUR', mainImage, galleryRaw };
  });
}

async function scrapeProduct(url) {
  validateProductUrl(url);

  let browser;
  let isRemote = false;
  try {
    if (process.env.BROWSER_WS_ENDPOINT) {
      isRemote = true;
      browser = await puppeteer.connect({ browserWSEndpoint: process.env.BROWSER_WS_ENDPOINT });
    } else {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });

    const data = await extractAli(page, url);

    if (!data.title && !data.originalPrice) {
      const err = new Error('Impossible de lire ce produit. Il est peut-être protégé ou inexistant.');
      err.status = 422;
      throw err;
    }

    return { ...data, sourceUrl: url, sourceSite: 'aliexpress' };
  } finally {
    if (browser) {
      if (isRemote) browser.disconnect();
      else await browser.close();
    }
  }
}

module.exports = { scrapeProduct };
