const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProduct } = require('../src/controllers/products');

const minimal = { name: 'Robe wax', status: 'DRAFT' };
const complete = {
  ...minimal, status: 'PUBLISHED',
  categoryId: '6612f3c9e6a5d8e44bb9a001',
  supplierId: '6612f3c9e6a5d8e44bb9a002',
  description: 'Robe en coton',
  mainImage: { url: 'https://res.cloudinary.com/test/main.jpg' },
  gallery: ['https://res.cloudinary.com/test/red.jpg'],
  salePriceXof: 24500, costPriceXof: 15000, stock: 0,
  variantOptions: [{ name: 'Couleur', type: 'COLOR', values: [
    { value: 'Rouge', hex: '#dc2626', images: ['https://res.cloudinary.com/test/red.jpg'] }
  ] }]
};

test('minimal draft is accepted', () => assert.equal(validateProduct(minimal).status, 'DRAFT'));
test('published product accepts zero stock', () => assert.equal(validateProduct(complete).stock, 0));
test('published incomplete product is rejected', () => assert.throws(() => validateProduct({ ...minimal, status: 'PUBLISHED' })));
test('zero sale price is rejected even in draft', () => assert.throws(() => validateProduct({ ...minimal, salePriceXof: 0 })));
test('unknown color image is rejected', () => assert.throws(() => validateProduct({
  ...complete, variantOptions: [{ name: 'Couleur', type: 'COLOR', values: [
    { value: 'Rouge', images: ['https://res.cloudinary.com/test/other.jpg'] }
  ] }]
})));
test('duplicate option name is rejected case-insensitively', () => assert.throws(() => validateProduct({
  ...complete, variantOptions: [
    { name: 'Taille', type: 'TEXT', values: [{ value: 'S' }] },
    { name: 'taille', type: 'TEXT', values: [{ value: 'L' }] }
  ]
})));
test('SKU cannot be supplied in create payload', () => assert.throws(() => validateProduct({ ...minimal, sku: 'USER-SKU' })));
