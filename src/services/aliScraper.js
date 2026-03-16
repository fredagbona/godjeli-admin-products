const cheerio = require('cheerio');

/**
 * Parse product data from raw AliExpress page HTML (Cheerio-based).
 * Used by POST /api/admin/scrape when the caller provides pre-fetched HTML.
 *
 * Extraction order: window.runParams JSON → JSON-LD → DOM selectors.
 *
 * @param {string} html - Raw HTML of the AliExpress product page
 * @param {string} url  - Source URL
 * @returns {object}    - Parsed product fields
 */
function parseAliProduct(html, url) {
  const $ = cheerio.load(html);

  let title = '';
  let originalPrice = 0;
  let mainImage = '';
  let galleryRaw = [];

  // ── Strategy 1: window.runParams embedded JSON ────────────────────────────
  $('script').each((_, el) => {
    const src = $(el).html() || '';
    if (!src.includes('runParams')) return;
    try {
      const match = src.match(/window\.runParams\s*=\s*(\{[\s\S]+?\});\s*(?:window|var|$)/);
      if (!match) return;
      const data = JSON.parse(match[1])?.data;
      if (!data) return;

      title = title || data.productInfoComponent?.subject || '';

      const priceComp = data.priceComponent;
      if (priceComp && !originalPrice) {
        const raw =
          priceComp.discountPrice?.minActivityPrice ||
          priceComp.originalPrice?.minPrice ||
          priceComp.discountPrice?.minPrice || '';
        originalPrice = parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
      }

      const imgComp = data.imageComponent;
      if (imgComp?.imagePathList?.length && !mainImage) {
        const list = imgComp.imagePathList.map((u) =>
          u.startsWith('//') ? `https:${u}` : u
        );
        mainImage = list[0];
        galleryRaw = list.slice(1);
      }
    } catch (_) {}
  });

  // ── Strategy 2: JSON-LD ───────────────────────────────────────────────────
  if (!title) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const d = JSON.parse($(el).html());
        const product = d['@type'] === 'Product' ? d :
          (d['@graph'] || []).find((n) => n['@type'] === 'Product');
        if (!product) return;
        title = title || product.name || '';
        const imgs = Array.isArray(product.image) ? product.image : (product.image ? [product.image] : []);
        mainImage = mainImage || imgs[0] || '';
        if (!galleryRaw.length) galleryRaw = imgs.slice(1);
        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        if (offer) originalPrice = originalPrice || parseFloat(String(offer.price).replace(',', '.')) || 0;
      } catch (_) {}
    });
  }

  // ── Strategy 3: DOM selectors fallback ───────────────────────────────────
  if (!title) {
    title =
      $('h1[data-pl="product-title"]').text().trim() ||
      $('h1.product-title-text').text().trim() ||
      $('h1').first().text().trim();
  }

  if (!originalPrice) {
    const priceText =
      $('.product-price-value').first().text().trim() ||
      $('.uniform-banner-box-price').first().text().trim();
    originalPrice = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
  }

  if (!mainImage) {
    $('.image-view-item img').each((_, el) => {
      if (mainImage) return;
      let src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src.startsWith('//')) src = `https:${src}`;
      mainImage = src;
    });
  }

  if (mainImage.startsWith('//')) mainImage = `https:${mainImage}`;

  return { title, originalPrice, mainImage, galleryRaw, sourceUrl: url, sourceSite: 'aliexpress' };
}

module.exports = { parseAliProduct };
