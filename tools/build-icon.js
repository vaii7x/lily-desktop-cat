// Writes build/icon.ico (the installer and exe icon): Lily's head from idle_sit, the same crop as the tray icon,
// centred on a 32x32 canvas and scaled pixel-sharp to every size Windows asks for (PNG-compressed ICO entries).
// Usage: node tools/build-icon.js   (after npm run sprites:build)
'use strict';
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const sprites = require('../assets/build/sprites.json');
const { buildColors, rasterize } = require('../src/shared/spriteRaster');

const SIZES = [256, 128, 64, 48, 32, 16];
const BASE = 32;

const rows = sprites.anims.idle_sit.frames[0].slice(5, 30).map((r) => r.slice(10, 35));
const head = rasterize(rows, buildColors(sprites.coats.calico_tabby, sprites.eyes.yellow_green));
const ox = Math.floor((BASE - head.width) / 2);
const oy = Math.floor((BASE - head.height) / 2);

// Nearest-neighbour scale of the 32x32 canvas to size x size.
function png(size) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x * BASE) / size) - ox;
      const sy = Math.floor((y * BASE) / size) - oy;
      if (sx < 0 || sy < 0 || sx >= head.width || sy >= head.height) continue;
      const i = (sy * head.width + sx) * 4;
      head.data.slice(i, i + 4).forEach((v, k) => { out.data[(y * size + x) * 4 + k] = v; });
    }
  }
  return PNG.sync.write(out);
}

const images = SIZES.map(png);
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(SIZES[i] % 256, e); // 0 means 256
  header.writeUInt8(SIZES[i] % 256, e + 1);
  header.writeUInt16LE(1, e + 4); // colour planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(img.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
const out = path.join(__dirname, '../build/icon.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, ...images]));
fs.writeFileSync(path.join(__dirname, '../preview/icon-256.png'), images[0]);
console.log(`wrote ${path.relative(process.cwd(), out)} (${SIZES.join(', ')} px)`);
