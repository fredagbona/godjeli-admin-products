const ORIGINS = {
  EUROPE: 'EUROPE',
  CHINA: 'CHINA',
};

const EUROPE_RATE_EUR_PER_KG = 15.24;
const CHINA_RATE_EUR_PER_KG = 13.72;
const CUSTOMS_FEE_EUR = 0.5;
const TARGET_MARGIN_RATE = 0.2;
const PAYMENT_FEE_RATE = 0.029;
const DISPLAY_LOGISTICS_PRODUCT_SHARE = 0.4;
const DISPLAY_LOGISTICS_SHIPPING_SHARE = 0.6;
const MOQ_THRESHOLD_EUR = 5;
const MOQ_MAX = 5;
const PRICE_DENOMINATOR = 1 - TARGET_MARGIN_RATE - PAYMENT_FEE_RATE;

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getOriginRate(origin) {
  if (origin === ORIGINS.EUROPE) return EUROPE_RATE_EUR_PER_KG;
  if (origin === ORIGINS.CHINA) return CHINA_RATE_EUR_PER_KG;

  const error = new Error('Origine logistique invalide.');
  error.status = 400;
  throw error;
}

function buildPricing({ costPriceEur, weightGrams, origin }) {
  const ratePerKg = getOriginRate(origin);
  const logisticsCostEur = round2((weightGrams / 1000) * ratePerKg);
  const moqRaw = costPriceEur < MOQ_THRESHOLD_EUR
    ? Math.ceil((logisticsCostEur + CUSTOMS_FEE_EUR) / (costPriceEur * 0.6))
    : 1;
  const moq = Math.max(1, Math.min(moqRaw, MOQ_MAX));
  const customsFeeEur = round2(CUSTOMS_FEE_EUR / moq);
  const realCostEur = round2(costPriceEur + logisticsCostEur + customsFeeEur);
  const totalPriceEur = round2(realCostEur / PRICE_DENOMINATOR);
  const marginAmountEur = round2(totalPriceEur * TARGET_MARGIN_RATE);
  const paymentFeeEur = round2(totalPriceEur * PAYMENT_FEE_RATE);
  const totalRealCostEur = round2(costPriceEur + logisticsCostEur + customsFeeEur + paymentFeeEur);
  const netMarginEur = round2(totalPriceEur - totalRealCostEur);
  const displayProductPriceEur = round2(
    costPriceEur + logisticsCostEur * DISPLAY_LOGISTICS_PRODUCT_SHARE + marginAmountEur
  );
  const displayShippingAndCustomsBaseEur = round2(
    logisticsCostEur * DISPLAY_LOGISTICS_SHIPPING_SHARE + customsFeeEur
  );
  const displayAdjustmentEur = round2(
    totalPriceEur - displayProductPriceEur - displayShippingAndCustomsBaseEur
  );
  const displayShippingAndCustomsEur = round2(
    displayShippingAndCustomsBaseEur + displayAdjustmentEur
  );

  return {
    moq,
    costPriceEur: round2(costPriceEur),
    weightGrams,
    origin,
    ratePerKgEur: round2(ratePerKg),
    logisticsCostEur,
    customsFeeEur,
    paymentFeeEur,
    marginAmountEur,
    netMarginEur,
    displayProductPriceEur,
    displayShippingAndCustomsBaseEur,
    displayAdjustmentEur,
    displayShippingAndCustomsEur,
    totalPriceEur,
    totalRealCostEur,
  };
}

module.exports = {
  ORIGINS,
  EUROPE_RATE_EUR_PER_KG,
  CHINA_RATE_EUR_PER_KG,
  CUSTOMS_FEE_EUR,
  TARGET_MARGIN_RATE,
  PAYMENT_FEE_RATE,
  DISPLAY_LOGISTICS_PRODUCT_SHARE,
  DISPLAY_LOGISTICS_SHIPPING_SHARE,
  MOQ_THRESHOLD_EUR,
  round2,
  buildPricing,
};
