const test = require('node:test');
const assert = require('node:assert/strict');
const { createPressClassifier } = require('../src/shared/pressClassifier');
const { clampPosition, besidePosition, opaqueBounds } = require('../src/shared/placement');
const { migrate, DEFAULTS } = require('../src/shared/settingsSchema');

test('short still press is a click; two quick clicks are a double', () => {
  const p = createPressClassifier();
  p.down(100, 100, 0);
  assert.equal(p.move(102, 103), null); // within 4 px
  assert.equal(p.tick(100), null);
  assert.equal(p.up(120), 'click');
  p.down(100, 100, 300);
  assert.equal(p.up(380), 'double');
  p.down(100, 100, 2000);
  assert.equal(p.up(2050), 'click'); // a third click starts over
});

test('moving over 4 px or holding over 150 ms becomes a drag, never a click', () => {
  const p = createPressClassifier();
  p.down(0, 0, 0);
  assert.equal(p.move(5, 0), 'drag');
  assert.equal(p.move(50, 0), null); // reported once
  assert.equal(p.up(60), 'drop');
  p.down(0, 0, 1000);
  assert.equal(p.tick(1100), null);
  assert.equal(p.tick(1151), 'drag');
  assert.equal(p.up(1400), 'drop');
  p.down(0, 0, 1500); // a drop does not count toward a double-click
  assert.equal(p.up(1550), 'click');
  assert.equal(p.up(1600), null);
});

const cat = { x: 0, y: 60, width: 144, height: 144 };
const left = { x: 0, y: 0, width: 1920, height: 1040 };
const right = { x: 1920, y: 0, width: 1280, height: 984 };

test('clamp leaves a cat that is fully on screen alone', () => {
  assert.deepEqual(clampPosition({ x: 500, y: 300 }, cat, [left]), { x: 500, y: 300 });
  assert.deepEqual(clampPosition({ x: 2000.4, y: 300 }, cat, [left, right]), { x: 2000, y: 300 });
});

test('clamp keeps the whole cat inside the work area (no edges, no taskbar)', () => {
  assert.deepEqual(clampPosition({ x: -80, y: 300 }, cat, [left]), { x: 0, y: 300 });
  // Work area ends at 1040 (taskbar below): cat bottom = y + 60 + 144 must be <= 1040.
  assert.deepEqual(clampPosition({ x: 500, y: 1000 }, cat, [left]), { x: 500, y: 836 });
  // Bubble room may go above the top edge; the cat itself may not.
  assert.deepEqual(clampPosition({ x: 500, y: -200 }, cat, [left]), { x: 500, y: -60 });
});

test('clamp picks the monitor her centre is nearest to', () => {
  // Straddling, centre on the left monitor: pushed fully onto the left one.
  assert.deepEqual(clampPosition({ x: 1840, y: 300 }, cat, [left, right]), { x: 1776, y: 300 });
  // Centre past the seam: snaps onto the right monitor.
  assert.deepEqual(clampPosition({ x: 1860, y: 300 }, cat, [left, right]), { x: 1920, y: 300 });
  // Far away, or a removed monitor: lands on the nearest remaining one.
  assert.deepEqual(clampPosition({ x: 5000, y: -900 }, cat, [left, right]), { x: 3056, y: -60 });
  assert.deepEqual(clampPosition({ x: 2500, y: 400 }, cat, [left]), { x: 1776, y: 400 });
});

test('opaque bounds hug the drawn pixels across all frames', () => {
  assert.deepEqual(opaqueBounds([['....', '.O..', '....'], ['....', '....', '..B.']]), { x: 1, y: 1, width: 2, height: 2 });
});

test('popup goes right of the cat, or left at the screen edge', () => {
  const anchor = { x: 100, y: 500, width: 144, height: 204 };
  assert.deepEqual(besidePosition(anchor, { width: 180, height: 100 }, left), { x: 244, y: 604 });
  const edge = { ...anchor, x: 1800 };
  assert.deepEqual(besidePosition(edge, { width: 180, height: 100 }, left), { x: 1620, y: 604 });
});

test('settings migration fills defaults and drops bad values', () => {
  assert.deepEqual(migrate(null), DEFAULTS);
  assert.deepEqual(migrate('garbage'), DEFAULTS);
  const s = migrate({ scale: 99, alwaysOnTop: 'yes', position: { x: 10, y: 'no' }, coat: { eyes: 'blue' }, extra: 1 });
  assert.equal(s.scale, DEFAULTS.scale);
  assert.equal(s.alwaysOnTop, true);
  assert.deepEqual(s.position, { x: null, y: null });
  assert.deepEqual(s.coat, { preset: 'calico_tabby', eyes: 'blue' });
  assert.equal('extra' in s, false);
  assert.deepEqual(migrate({ position: { x: -300, y: 20 } }).position, { x: -300, y: 20 });
});
