const test = require('node:test');
const assert = require('node:assert');
const { subtract, surfaces, groundAt, coveredDisplay } = require('../src/shared/perch');

const area = { x: 0, y: 0, width: 1920, height: 1040 };
const win = (id, x, y, width, height) => ({ id, rect: { x, y, width, height } });

test('subtract cuts covered spans out of a line', () => {
  assert.deepStrictEqual(subtract(0, 100, []), [[0, 100]]);
  assert.deepStrictEqual(subtract(0, 100, [[20, 40], [60, 200]]), [[0, 20], [40, 60]]);
  assert.deepStrictEqual(subtract(0, 100, [[-10, 200]]), []);
});

test('a window top is a surface where nothing above covers it', () => {
  const s = surfaces([win(1, 300, 200, 400, 300), win(2, 100, 400, 800, 400)], [area], 80, 60);
  assert.deepStrictEqual(s, [{ id: 1, x0: 300, x1: 700, y: 200 }, { id: 2, x0: 100, x1: 300, y: 400 }, { id: 2, x0: 700, x1: 900, y: 400 }]);
});

test('no surface without headroom, below the taskbar, too narrow, or off every work area', () => {
  const s = surfaces([win(1, 0, -8, 1920, 1048), win(2, 100, 1100, 400, 300), win(3, 500, 300, 40, 300), win(4, 3000, 300, 400, 300)],
    [area], 80, 60);
  assert.deepStrictEqual(s, []);
});

test('surfaces are cut to their work area (window hanging off the screen edge)', () => {
  assert.deepStrictEqual(surfaces([win(1, 1700, 500, 600, 300)], [area], 80, 60), [{ id: 1, x0: 1700, x1: 1920, y: 500 }]);
});

test('ground is the highest surface at or below her feet that holds her x', () => {
  const surfs = [{ id: 1, x0: 300, x1: 700, y: 200 }, { id: 2, x0: 100, x1: 900, y: 400 }];
  assert.equal(groundAt(500, 100, surfs, [area]).id, 1);
  assert.equal(groundAt(500, 201, surfs, [area]).id, 1); // standing on it, within tolerance
  assert.equal(groundAt(500, 250, surfs, [area]).id, 2); // below window 1's top: falls to window 2
  assert.deepStrictEqual(groundAt(1000, 100, surfs, [area]), { id: null, x0: 0, x1: 1920, y: 1040 }); // taskbar
});

test('ground between two monitors falls back to the nearest work area', () => {
  const right = { x: 1920, y: 0, width: 1280, height: 984 };
  assert.equal(groundAt(3300, 100, [], [area, right]).y, 984);
  assert.equal(groundAt(2500, 100, [], [area, right]).y, 984);
});

test('fullscreen means covering a whole display', () => {
  const d = { x: 0, y: 0, width: 1920, height: 1080 };
  assert.deepStrictEqual(coveredDisplay({ x: 0, y: 0, width: 1920, height: 1080 }, [d]), d);
  assert.deepStrictEqual(coveredDisplay({ x: -1, y: -1, width: 1922, height: 1082 }, [d]), d);
  assert.equal(coveredDisplay({ x: 0, y: 0, width: 1920, height: 1040 }, [d]), null); // maximized, taskbar visible
});
