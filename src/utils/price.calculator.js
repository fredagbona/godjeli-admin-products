// ─── Constants ────────────────────────────────────────────────────────────────

/** Fixed internal exchange rate (never use live bank rate). */
const EUR_TO_FCFA = 750;

/** Logistics cost per kilogram in euros. */
const LOGISTICS_RATE_EUR = 15;

// ─── Selling price ────────────────────────────────────────────────────────────

/**
 * Compute the EUR selling price from a purchase price.
 * Formula: (sourcePrice × MARGIN_MULTIPLIER) + FIXED_FEES
 * Rounded up to nearest integer then -0.01 → "clean" prices (29.99, 49.99…)
 *
 * @param {number} sourcePrice - Purchase price in EUR
 * @returns {number} - Selling price in EUR
 */
function computeSellingPrice(sourcePrice) {
  const multiplier = parseFloat(process.env.MARGIN_MULTIPLIER) || 2;
  const fixedFees = parseFloat(process.env.FIXED_FEES) || 2;
  const raw = sourcePrice * multiplier + fixedFees;
  return Math.ceil(raw) - 0.01;
}

// ─── Currency conversion ──────────────────────────────────────────────────────

/**
 * Convert an amount in EUR to FCFA using the fixed internal rate.
 * prix_fcfa = prix_euro × 750
 *
 * @param {number} euros
 * @returns {number} - Amount in FCFA (rounded to nearest integer)
 */
function convertToFCFA(euros) {
  return Math.round(euros * EUR_TO_FCFA);
}

// ─── Logistics ────────────────────────────────────────────────────────────────

/**
 * Compute the logistics cost for a given weight.
 * logistique_brut_euro = poids_kg × 15
 * logistique_brut_fcfa = logistique_brut_euro × 750
 *
 * @param {number} weightKg - Product weight in kilograms
 * @returns {{ eur: number, fcfa: number }}
 */
function computeLogisticsCost(weightKg) {
  const eur = weightKg * LOGISTICS_RATE_EUR;
  const fcfa = convertToFCFA(eur);
  return { eur, fcfa };
}

// ─── Margin ───────────────────────────────────────────────────────────────────

/**
 * Calculate margin percentage between purchase and selling price.
 *
 * @param {number} sourcePrice
 * @param {number} sellingPrice
 * @returns {number}
 */
function calculateMarginPercent(sourcePrice, sellingPrice) {
  if (!sellingPrice) return 0;
  return ((sellingPrice - sourcePrice) / sellingPrice) * 100;
}

module.exports = {
  EUR_TO_FCFA,
  LOGISTICS_RATE_EUR,
  computeSellingPrice,
  convertToFCFA,
  computeLogisticsCost,
  calculateMarginPercent,
};
