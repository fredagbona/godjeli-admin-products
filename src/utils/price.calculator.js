/**
 * Compute the selling price from a purchase price using env-configured rules.
 *
 * Formula: sellingPrice = (purchasePrice × MARGIN_MULTIPLIER) + FIXED_FEES
 * Result is rounded up to the nearest integer then shifted by -0.01 to produce
 * "clean" prices (e.g. 29.99, 49.99).
 *
 * @param {number} purchasePrice
 * @returns {number}
 */
function computeSellingPrice(purchasePrice) {
  const multiplier = parseFloat(process.env.MARGIN_MULTIPLIER) || 2;
  const fixedFees = parseFloat(process.env.FIXED_FEES) || 2;
  const raw = purchasePrice * multiplier + fixedFees;
  return Math.ceil(raw) - 0.01;
}

/**
 * Calculate margin percentage.
 * @param {number} purchasePrice
 * @param {number} sellingPrice
 * @returns {number}
 */
function calculateMarginPercent(purchasePrice, sellingPrice) {
  if (!sellingPrice) return 0;
  return ((sellingPrice - purchasePrice) / sellingPrice) * 100;
}

module.exports = { computeSellingPrice, calculateMarginPercent };
