const multer = require('multer');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: MAX_IMAGES,
    fields: 0,
    parts: MAX_IMAGES
  }
}).array('images', MAX_IMAGES);

const uploadImages = (req, res, next) => {
  parser(req, res, err => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'Cada imagen debe pesar 5 MB o menos'
          : 'Puedes adjuntar hasta 5 imágenes por reporte'
      });
    }

    return next(err);
  });
};

module.exports = { uploadImages, MAX_IMAGES, MAX_IMAGE_SIZE };
