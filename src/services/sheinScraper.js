const cheerio = require('cheerio');

/**
 * Parse product data from raw Shein page HTML.
 * Puppeteer should be used to fetch the HTML due to JS rendering.
 *
 * @param {string} html - Raw HTML of the Shein product page
 * @param {string} url  - Source URL
 * @returns {object}    - Parsed product fields
 */
function parseSheinProduct(html, url) {
  const $ = cheerio.load(html);

  const name = $('h1.product-intro__head-name').text().trim();
  const priceText = $('.product-intro__head-price .from').first().text().trim();
  const originalPrice = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
  const images = [];
  $('.product-intro__thumbs-item img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src) images.push(src.startsWith('//') ? `https:${src}` : src);
  });

  return {
    name,
    originalPrice,
    images,
    sourceUrl: url,
    sourceSite: 'shein',
  };
}

module.exports = { parseSheinProduct };
