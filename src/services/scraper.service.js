const puppeteer = require('puppeteer');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function detectSite(url) {
  if (url.includes('shein.com')) return 'shein';
  if (url.includes('aliexpress.com')) return 'aliexpress';
  return null;
}

async function extractShein(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 9000 });
  await page.waitForSelector('.product-intro__head-name', { timeout: 7000 }).catch(() => {});

  return page.evaluate(() => {
    const title =
      document.querySelector('.product-intro__head-name')?.textContent?.trim() || '';
    const priceRaw =
      document.querySelector('.product-intro__head-mainprice')?.textContent?.trim() ||
      document.querySelector('.product-intro__head-price .from')?.textContent?.trim() ||
      '';
    const originalPrice =
      parseFloat(priceRaw.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

    const imgEl =
      document.querySelector('.product-intro__main-img img') ||
      document.querySelector('.crop-image-container img');
    let mainImage = imgEl?.src || imgEl?.dataset?.src || '';
    if (mainImage.startsWith('//')) mainImage = `https:${mainImage}`;

    return { title, originalPrice, currency: 'EUR', mainImage };
  });
}

async function extractAli(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 9000 });
  await page.waitForSelector('h1', { timeout: 7000 }).catch(() => {});

  return page.evaluate(() => {
    const title =
      document.querySelector('h1[data-pl="product-title"]')?.textContent?.trim() ||
      document.querySelector('h1.product-title-text')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      '';

    const priceEl =
      document.querySelector('.product-price-value') ||
      document.querySelector('[class*="price--current"]') ||
      document.querySelector('[class*="uniform-banner-box-price"]');
    const priceRaw = priceEl?.textContent?.trim() || '';
    const originalPrice =
      parseFloat(priceRaw.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

    const imgEl =
      document.querySelector('.magnifier-image') ||
      document.querySelector('[class*="image-view"] img');
    let mainImage = imgEl?.src || '';
    if (mainImage.startsWith('//')) mainImage = `https:${mainImage}`;

    return { title, originalPrice, currency: 'EUR', mainImage };
  });
}

/**
 * Scrape a product page from Shein or AliExpress using Puppeteer.
 * The browser is closed after every call to avoid RAM leaks.
 *
 * @param {string} url - Full product URL
 * @returns {{ title, originalPrice, currency, mainImage, sourceUrl, sourceSite }}
 */
async function scrapeProduct(url) {
  const site = detectSite(url);
  if (!site) {
    const err = new Error('URL non supportée. Seuls Shein et AliExpress sont acceptés.');
    err.status = 400;
    throw err;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });

    const data = site === 'shein'
      ? await extractShein(page, url)
      : await extractAli(page, url);

    if (!data.title && !data.originalPrice) {
      const err = new Error('Impossible de lire ce produit. Il est peut-être protégé ou inexistant.');
      err.status = 422;
      throw err;
    }

    return { ...data, sourceUrl: url, sourceSite: site };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeProduct };
