const multer = require('multer');
const { badRequest, ok } = require('../middlewares/respond');
const imageService = require('../services/image.service');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function imageFileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const error = new Error('Format de fichier non supporte.');
    error.status = 400;
    return cb(error);
  }
  return cb(null, true);
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter: imageFileFilter,
});

/** Logo (1) + galerie (jusqu'à 10) pour un fournisseur. */
const supplierAssetsUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 11,
  },
  fileFilter: imageFileFilter,
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'images', maxCount: 10 },
]);

async function uploadImages(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return badRequest(res, 'Validation failed', [
        { message: 'Au moins un fichier image est requis.' },
      ]);
    }

    const uploads = await imageService.uploadAdminImages(req.files);
    return ok(res, uploads);
  } catch (error) {
    next(error);
  }
}

module.exports = { uploadMiddleware, uploadImages, supplierAssetsUpload };
