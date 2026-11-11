const test = require('node:test');
const assert = require('node:assert/strict');
const { detectarTipoImagen } = require('./imageTypes');

test('detects supported image types from file signatures', () => {
  assert.deepEqual(detectarTipoImagen(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), {
    mime: 'image/png',
    extension: 'png'
  });
  assert.deepEqual(detectarTipoImagen(Buffer.from([0xff, 0xd8, 0xff, 0x00])), {
    mime: 'image/jpeg',
    extension: 'jpg'
  });
  assert.deepEqual(detectarTipoImagen(Buffer.from('RIFFxxxxWEBP')), {
    mime: 'image/webp',
    extension: 'webp'
  });
});

test('rejects files that are not supported image types', () => {
  assert.equal(detectarTipoImagen(Buffer.from('not an image')), null);
});
