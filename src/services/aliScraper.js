const cheerio = require('cheerio');

/**
 * Parse product data from raw AliExpress page HTML.
 * Puppeteer should be used to fetch the HTML due to JS rendering.
 *
 * @param {string} html - Raw HTML of the AliExpress product page
 * @param {string} url  - Source URL
 * @returns {object}    - Parsed product fields
 */
function parseAliProduct(html, url) {
  const $ = cheerio.load(html);

  const name = $('h1[data-pl="product-title"]').text().trim()
    || $('h1.product-title-text').text().trim();

  const priceText = $('.product-price-value').first().text().trim()
    || $('.uniform-banner-box-price').first().text().trim();
  const originalPrice = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

  const images = [];
  $('.image-view-item img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src) images.push(src.startsWith('//') ? `https:${src}` : src);
  });

  return {
    name,
    originalPrice,
    images,
    sourceUrl: url,
    sourceSite: 'aliexpress',
  };
}

module.exports = { parseAliProduct };
