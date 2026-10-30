// Writes preview/sheet.png: every animation as a labelled strip, the FX sprites, and idle_sit in every coat.
// Usage: node tools/preview-sprites.js [scale] [anim,anim...]   (default 6, all anims; a filter drops fx/coats rows)
'use strict';
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { build } = require('./build-sprites');
const { buildColors, rasterize, parseHex } = require('../src/shared/spriteRaster');
const { KEYBOARD, PAWS, TYPE_ANIMS, kneadFrame } = require('../src/shared/behaviorRules');

// Typing frames as they look at runtime: the cat, the keyboard over her lower body, her paws on its keys.
function withKeys(data, anim, i) {
  if (!TYPE_ANIMS.has(anim)) return data.anims[anim].frames[i];
  const grid = data.anims[anim].frames[i].map((r) => [...r]);
  const stamp = (fx, x0, y0) => data.fx[fx].forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.' && grid[y0 + y] && grid[y0 + y][x0 + x] !== undefined) grid[y0 + y][x0 + x] = ch;
  }));
  const left = i === kneadFrame(1);
  stamp(left ? 'keyboard_l' : 'keyboard_r', KEYBOARD.x, KEYBOARD.y);
  for (const [side, down] of [['left', left], ['right', !left]]) stamp('paw_key', PAWS[side].x, down ? PAWS[side].down : PAWS[side].up);
  return grid.map((r) => r.join(''));
}

// 3x5 pixel font, five rows top to bottom
const FONT = Object.fromEntries(Object.entries({
  A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.',
  E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..', G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#',
  I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
  M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.', P: '##. #.# ##. #.. #..',
  Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#', S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.',
  U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# #.# .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#',
  Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###', 0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###',
  2: '##. ..# .#. #.. ###', 3: '##. ..# .#. ..# ##.', 4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.',
  6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.', 8: '### #.# ### #.# ###', 9: '### #.# ### ..# ##.',
  _: '... ... ... ... ###', '@': '.#. #.# #.# #.. .##', ' ': '... ... ... ... ...', '-': '... ... ### ... ...',
  ':': '... .#. ... .#. ...',
}).map(([k, v]) => [k, v.replace(/ /g, '')]));

function main() {
  const scale = Number(process.argv[2]) || 6;
  const data = build();
  const size = data.size * scale;
  const pad = 4 * scale;
  const labelH = 8 * 4;
  const coat = data.coats.calico_tabby;
  const colors = buildColors(coat, data.eyes.yellow_green);

  const only = process.argv[3] && process.argv[3].split(',');
  const rows = Object.entries(data.anims).filter(([name]) => !only || only.includes(name)).map(([name, a]) => ({
    label: `${name} ${a.frames.length}@${a.fps}`,
    cells: a.frames.map((f, i) => ({ grid: withKeys(data, name, i), colors })),
  }));
  const coatEyes = { ragdoll_seal: 'blue', black: 'amber', white: 'blue', grey: 'green' };
  // The typing frames in every coat (the keys stay grey).
  for (const anim of TYPE_ANIMS) {
    if (only && !only.includes(anim)) continue;
    rows.push({
      label: `${anim} coats`,
      cells: Object.keys(data.coats).flatMap((c) => [0, 1].map((i) => ({
        grid: withKeys(data, anim, i),
        colors: buildColors(data.coats[c], data.eyes[coatEyes[c] || 'yellow_green']),
      }))),
    });
  }
  if (!only) rows.push({ label: 'fx', cells: Object.values(data.fx).map((grid) => ({ grid, colors })) });
  if (!only) rows.push({
    label: 'coats: ' + Object.keys(data.coats).join(' '),
    cells: Object.keys(data.coats).map((c) => ({
      grid: data.anims.idle_sit.frames[0],
      colors: buildColors(data.coats[c], data.eyes[coatEyes[c] || 'yellow_green']),
    })),
  });

  const cols = Math.max(...rows.map((r) => r.cells.length));
  const width = pad + cols * (size + pad);
  const height = pad + rows.length * (labelH + size + pad);
  const png = new PNG({ width, height });
  fill(png, 0, 0, width, height, parseHex('#fbfaf7'));

  rows.forEach((row, r) => {
    const top = pad + r * (labelH + size + pad);
    text(png, row.label.toUpperCase(), pad, top + 4, 4, parseHex('#3a3436'));
    row.cells.forEach((cell, c) => {
      const left = pad + c * (size + pad);
      checker(png, left, top + labelH, size, scale);
      const img = rasterize(cell.grid, cell.colors);
      const ox = left + Math.floor((size - img.width * scale) / 2);
      const oy = top + labelH + Math.floor((size - img.height * scale) / 2);
      blit(png, img, ox, oy, scale);
    });
  });

  const out = path.join(__dirname, '..', 'preview');
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, 'sheet.png');
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${width}x${height})`);
}

function put(png, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height || a === 0) return;
  const i = (y * png.width + x) * 4;
  const k = a / 255;
  png.data[i] = Math.round(r * k + png.data[i] * (1 - k));
  png.data[i + 1] = Math.round(g * k + png.data[i + 1] * (1 - k));
  png.data[i + 2] = Math.round(b * k + png.data[i + 2] * (1 - k));
  png.data[i + 3] = 255;
}

function fill(png, x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(png, x, y, c);
}

// light checkerboard, one square per sprite pixel, so the outline and transparency are visible
function checker(png, x0, y0, size, scale) {
  const a = parseHex('#e6e3ec');
  const b = parseHex('#dcd8e3');
  for (let y = 0; y < size; y += scale) {
    for (let x = 0; x < size; x += scale) fill(png, x0 + x, y0 + y, scale, scale, ((x + y) / scale) % 2 ? a : b);
  }
}

function blit(png, img, x0, y0, scale) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      fill(png, x0 + x * scale, y0 + y * scale, scale, scale, img.data.slice(i, i + 4));
    }
  }
}

function text(png, str, x0, y0, s, color) {
  [...str].forEach((ch, n) => {
    const g = FONT[ch] || FONT[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '#') fill(png, x0 + n * 4 * s + (i % 3) * s, y0 + Math.floor(i / 3) * s, s, s, color);
  });
}

main();
