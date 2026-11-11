const test = require('node:test');
const assert = require('node:assert/strict');
const { getStoredFilePath, uploadsDirectory } = require('./attachmentStorage');

test('only resolves generated image filenames inside the uploads directory', () => {
  const filename = '123e4567-e89b-12d3-a456-426614174000.jpg';
  assert.equal(getStoredFilePath(filename), require('node:path').join(uploadsDirectory, filename));
  assert.equal(getStoredFilePath('../secret.jpg'), null);
  assert.equal(getStoredFilePath('not-a-uuid.png'), null);
  assert.equal(getStoredFilePath('123e4567-e89b-12d3-a456-426614174000.svg'), null);
});
