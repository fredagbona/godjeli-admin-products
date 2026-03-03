/**
 * Calculate margin percentage between cost and selling price.
 */
function calculateMargin(costPrice, sellingPrice) {
  if (!sellingPrice || sellingPrice === 0) return 0;
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
}

/**
 * Suggest a selling price given a cost price and desired margin (%).
 */
function suggestSellingPrice(costPrice, desiredMarginPercent) {
  return costPrice / (1 - desiredMarginPercent / 100);
}

module.exports = { calculateMargin, suggestSellingPrice };
