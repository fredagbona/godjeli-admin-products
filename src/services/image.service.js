const { cloudinary } = require('../config');

// Shown when an image can't be uploaded — keeps the UI from breaking
const PLACEHOLDER_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/accessories-bag.jpg';

/**
 * Upload a remote image URL directly to Cloudinary (no local file).
 * Returns the hosted Cloudinary URL optimised as WebP at max 800px width.
 * Falls back to PLACEHOLDER_URL on any upload failure.
 *
 * @param {string} remoteUrl - Direct image URL from Shein / AliExpress
 * @returns {Promise<string>} - Cloudinary secure_url (or placeholder)
 */
async function uploadProductImage(remoteUrl) {
  try {
    const result = await cloudinary.uploader.upload(remoteUrl, {
      folder: 'godjeli/products',
      transformation: [
        { width: 800, crop: 'limit' },
        { fetch_format: 'webp', quality: 'auto' },
      ],
    });
    return result.secure_url;
  } catch (err) {
    console.error('Cloudinary upload failed:', err.message);
    return PLACEHOLDER_URL;
  }
}

/**
 * Upload an array of image URLs and return the hosted URLs.
 * Invalid URLs are skipped silently.
 *
 * @param {string[]} urls
 * @returns {Promise<string[]>}
 */
async function uploadProductImages(urls) {
  const results = await Promise.allSettled(urls.map(uploadProductImage));
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

module.exports = { uploadProductImage, uploadProductImages };
