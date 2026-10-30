const test = require('node:test');
const assert = require('node:assert');
const { parseParts, parseFrames, compose, build } = require('../tools/build-sprites');
const { ROLES, buildColors, rasterize, parseHex } = require('../src/shared/spriteRaster');

const PHASE1 = { idle_sit: 4, watch: 18, walk: 6, loaf_idle: 4, nap_curled: 4, dragged_limp: 2, pet_purr: 4 };

test('real assets build into 48x48 frames of valid roles', () => {
  const out = build();
  for (const [name, count] of Object.entries(PHASE1)) {
    assert.ok(out.anims[name], `missing anim ${name}`);
    assert.strictEqual(out.anims[name].frames.length, count, name);
  }
  for (const [name, a] of Object.entries(out.anims)) {
    for (const f of a.frames) {
      assert.strictEqual(f.length, 48, name);
      for (const row of f) {
        assert.strictEqual(row.length, 48, name);
        for (const ch of row) assert.ok(ROLES.includes(ch), `${name}: bad role ${ch}`);
      }
    }
  }
  assert.ok(out.fx.heart && out.fx.zzz);
  assert.ok(out.coats.calico_tabby && out.coats.ragdoll_seal);
});

test('parts reject bad role characters and ragged rows', () => {
  assert.throws(() => parseParts('@a\nBZB\n', 't.txt'), /t.txt:2: invalid role character 'Z'/);
  assert.throws(() => parseParts('@a\nBBB\nBB\n', 't.txt'), /row width 2, expected 3/);
  assert.throws(() => parseParts('BBB\n', 't.txt'), /before any @part/);
});

test('compose rings parts with outline, flips, and expands groups', () => {
  const parts = parseParts('@dot\nB\n@eye noline\nE\n', 'p.txt');
  const { groups, anims } = parseFrames('group g\n  dot 1 1\nanim a 2\nframe\n  g 1 0\n  eye 0 0\n', 'f.txt');
  const grid = compose(anims.a.frames[0], { parts, groups }, 5, 4);
  assert.deepStrictEqual(grid, ['EOO..', 'OOBO.', '..O..', '.....']);
  const flipped = compose([{ name: 'tri', x: 0, y: 0, fh: true, fv: true }],
    { parts: parseParts('@tri noline\nWB\nB.\n', 'p.txt'), groups: {} }, 2, 2);
  assert.deepStrictEqual(flipped, ['OB', 'BW']);
  assert.throws(() => compose([{ name: 'dot', x: 9, y: 0, where: 'f:1' }], { parts, groups: {} }, 4, 4), /outside/);
});

test('ragdoll palette swap recolours the same grid', () => {
  const out = build();
  const rows = out.anims.idle_sit.frames[0];
  const calico = rasterize(rows, buildColors(out.coats.calico_tabby, out.eyes.yellow_green));
  const ragdoll = rasterize(rows, buildColors(out.coats.ragdoll_seal, out.eyes.blue));
  const y = rows.findIndex((r) => r.includes('B'));
  const x = rows[y].indexOf('B');
  const at = (img) => [...img.data.slice((y * 48 + x) * 4, (y * 48 + x) * 4 + 4)];
  assert.deepStrictEqual(at(calico), parseHex(out.coats.calico_tabby.B));
  assert.deepStrictEqual(at(ragdoll), parseHex(out.coats.ragdoll_seal.B));
  const flipped = rasterize(['OB'], buildColors(out.coats.calico_tabby, out.eyes.blue), true);
  assert.deepStrictEqual([...flipped.data.slice(0, 4)], parseHex(out.coats.calico_tabby.B));
});
