const path = require('path');
const { cloudinary } = require('../config');

function uploadBuffer(file, folder = 'godjeli/admin') {
  const baseName = path.parse(file.originalname || 'upload').name;
  const publicId = `${Date.now()}-${baseName}`.replace(/[^a-zA-Z0-9-_]/g, '-');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        transformation: [
          { width: 1600, crop: 'limit' },
          { fetch_format: 'webp', quality: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

async function uploadAdminImages(files) {
  const uploads = await Promise.all(files.map((file) => uploadBuffer(file)));

  return uploads.map((upload) => ({
    url: upload.secure_url,
    publicId: upload.public_id,
    width: upload.width,
    height: upload.height,
    format: upload.format,
  }));
}

module.exports = { uploadAdminImages };
