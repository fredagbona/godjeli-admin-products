const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPricing,
  ORIGINS,
  MOQ_THRESHOLD_EUR,
} = require('../src/services/pricing.service');

test('buildPricing computes the europe robe example', () => {
  const pricing = buildPricing({
    costPriceEur: 10,
    weightGrams: 200,
    origin: ORIGINS.EUROPE,
  });

  assert.equal(pricing.totalPriceEur, 17.57);
  assert.equal(pricing.displayProductPriceEur, 14.73);
  assert.equal(pricing.displayShippingAndCustomsBaseEur, 2.33);
  assert.equal(pricing.displayAdjustmentEur, 0.51);
  assert.equal(pricing.displayShippingAndCustomsEur, 2.84);
  assert.equal(
    pricing.totalPriceEur,
    Math.round((pricing.displayProductPriceEur + pricing.displayShippingAndCustomsEur) * 100) / 100
  );
});

test('buildPricing supports china rate', () => {
  const pricing = buildPricing({
    costPriceEur: 20,
    weightGrams: 500,
    origin: ORIGINS.CHINA,
  });

  assert.equal(pricing.ratePerKgEur, 13.72);
  assert.equal(pricing.logisticsCostEur, 6.86);
  assert.equal(pricing.totalPriceEur, 35.49);
});

test('buildPricing applies MOQ for low cost products', () => {
  const pricing = buildPricing({
    costPriceEur: MOQ_THRESHOLD_EUR - 0.5,
    weightGrams: 1000,
    origin: ORIGINS.CHINA,
  });

  assert.equal(pricing.moq >= 1, true);
  assert.equal(pricing.customsFeeEur > 0, true);
});
