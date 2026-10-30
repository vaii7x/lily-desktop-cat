const test = require('node:test');
const assert = require('node:assert/strict');
const { SPRITE_SIZE, DEFAULT_SCALE, windowSize } = require('../src/shared/constants');

test('window is one sprite wide plus bubble room above', () => {
  assert.equal(SPRITE_SIZE, 48);
  assert.equal(DEFAULT_SCALE, 2);
  assert.deepEqual(windowSize(2), { width: 96, height: 136 });
});
