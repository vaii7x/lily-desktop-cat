const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// behavior.js is a renderer script: run it with the rules on a fake window.
const window = { LilyRules: require('../src/shared/behaviorRules') };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/renderer/behavior.js'), 'utf8'), { window });

const world = (pos, ground) => ({ pos, ground, cursor: { x: 0, y: 0 }, range: { x0: 0, x1: 1000, y0: ground, y1: ground } });

test('perching: she falls to the ground, lands, then sits', () => {
  const b = window.LilyBehavior.create('stay');
  let pos = { x: 100, y: 100 };
  let out = b.tick(0, world(pos, 500));
  let t = 0;
  for (; t < 2000 && out.anim === 'fall'; t += 33) {
    if (out.move) pos = out.move;
    out = b.tick(t + 33, world(pos, 500));
  }
  assert.equal(pos.y, 500);
  assert.equal(out.anim, 'land');
  assert.ok(t < 1000, `fell for ${t} ms`);
  assert.notEqual(b.tick(t + 33 + 400, world(pos, 500)).anim, 'land');
});

test('perching: no fall while held, or with perching off', () => {
  const b = window.LilyBehavior.create('stay');
  b.setDragged(true);
  assert.equal(b.tick(0, world({ x: 0, y: 0 }, 500)).anim, 'dragged_limp');
  b.setDragged(false);
  assert.notEqual(b.tick(33, { ...world({ x: 0, y: 0 }, 0), ground: null }).anim, 'fall');
});
