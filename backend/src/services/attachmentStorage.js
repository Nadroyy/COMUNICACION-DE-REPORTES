const fs = require('node:fs/promises');
const path = require('node:path');

const uploadsDirectory = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads')
);

const getStoredFilePath = filename => {
  if (typeof filename !== 'string' || !/^[0-9a-f-]{36}\.(png|jpe?g|webp)$/.test(filename)) {
    return null;
  }
  return path.join(uploadsDirectory, filename);
};

const removeStoredFiles = async filenames => {
  await Promise.all(filenames.map(async filename => {
    const storedPath = getStoredFilePath(filename);
    if (!storedPath) return;
    try {
      await fs.unlink(storedPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }));
};

module.exports = { uploadsDirectory, getStoredFilePath, removeStoredFiles };
