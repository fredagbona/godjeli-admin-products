/**
 * Capitalize first letter of each word.
 */
function toTitleCase(str) {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Remove excess whitespace and HTML entities from scraped text.
 */
function cleanText(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { toTitleCase, cleanText };
