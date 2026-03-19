const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { parseAliProduct } = require('./aliScraper');

puppeteer.use(StealthPlugin());

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const NAV_TIMEOUT = 30000;

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

function normalizeAliUrl(url) {
  const match = url.match(/\/item\/(\d+)\.html/);
  if (match) return `https://www.aliexpress.com/item/${match[1]}.html`;
  return url;
}

// Strategy A: plain HTTP fetch + Cheerio (no headless fingerprint)
async function scrapeWithHttp(url) {
  console.log('[scraper] trying HTTP fetch:', url);
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'max-age=0',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  console.log('[scraper] HTTP response size:', html.length);

  const data = parseAliProduct(html, url);
  console.log('[scraper] HTTP extracted:', JSON.stringify({ title: data.title, originalPrice: data.originalPrice }));
  return data;
}

// Strategy B: Puppeteer/Browserless (full JS rendering)
async function scrapeWithBrowser(url) {
  let browser;
  let isRemote = false;
  try {
    if (process.env.BROWSER_WS_ENDPOINT) {
      isRemote = true;
      console.log('[scraper] connecting to remote browser:', process.env.BROWSER_WS_ENDPOINT);
      browser = await puppeteer.connect({ browserWSEndpoint: process.env.BROWSER_WS_ENDPOINT });
    } else {
      console.log('[scraper] launching local browser');
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
    await page.waitForFunction(() => window.runParams?.data, { timeout: 10000 }).catch(() => {});

    const pageTitle = await page.title();
    console.log('[scraper] browser page title:', pageTitle, '| url:', page.url());

    const data = await page.evaluate(() => {
      let title = '', originalPrice = 0, mainImage = '', galleryRaw = [];

      try {
        const d = window.runParams?.data;
        if (d) {
          title = d.productInfoComponent?.subject || '';
          const priceComp = d.priceComponent;
          if (priceComp) {
            const raw = priceComp.discountPrice?.minActivityPrice || priceComp.originalPrice?.minPrice || priceComp.discountPrice?.minPrice || '';
            originalPrice = parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
          }
          const imgComp = d.imageComponent;
          if (imgComp?.imagePathList?.length) {
            const list = imgComp.imagePathList.map((u) => (u.startsWith('//') ? `https:${u}` : u));
            mainImage = list[0]; galleryRaw = list.slice(1);
          }
        }
      } catch (_) {}

      if (!title) {
        try {
          for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
            const d = JSON.parse(s.textContent);
            const p = d['@type'] === 'Product' ? d : (d['@graph'] || []).find((n) => n['@type'] === 'Product');
            if (p) {
              title = p.name || '';
              const imgs = Array.isArray(p.image) ? p.image : p.image ? [p.image] : [];
              mainImage = mainImage || imgs[0] || ''; if (!galleryRaw.length) galleryRaw = imgs.slice(1);
              const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
              if (offer) originalPrice = originalPrice || parseFloat(String(offer.price).replace(',', '.')) || 0;
              break;
            }
          }
        } catch (_) {}
      }

      if (!title) title = document.querySelector('h1[data-pl="product-title"]')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
      if (!originalPrice) {
        const el = document.querySelector('[class*="price--current"]') || document.querySelector('.product-price-value');
        originalPrice = parseFloat((el?.textContent?.trim() || '').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
      }

      return { title, originalPrice, currency: 'EUR', mainImage, galleryRaw };
    });

    console.log('[scraper] browser extracted:', JSON.stringify({ title: data.title, originalPrice: data.originalPrice }));
    return { ...data, sourceUrl: url, sourceSite: 'aliexpress' };
  } finally {
    if (browser) {
      if (isRemote) browser.disconnect();
      else await browser.close();
    }
  }
}

async function scrapeProduct(url) {
  validateProductUrl(url);
  url = normalizeAliUrl(url);

  // Try plain HTTP first — no headless fingerprint
  try {
    const data = await scrapeWithHttp(url);
    if (data.title || data.originalPrice) {
      return { ...data, currency: data.currency || 'EUR' };
    }
    console.log('[scraper] HTTP gave no data, falling back to browser');
  } catch (httpErr) {
    console.log('[scraper] HTTP failed:', httpErr.message, '— falling back to browser');
  }

  // Fallback: full browser
  const data = await scrapeWithBrowser(url);

  if (!data.title && !data.originalPrice) {
    const err = new Error('Impossible de lire ce produit. Il est peut-être protégé ou inexistant.');
    err.status = 422;
    throw err;
  }

  return data;
}

module.exports = { scrapeProduct };
