// Compiles assets/parts + assets/frames + assets/palettes into assets/build/sprites.json.
//
// parts/*.txt   "@name [noline]" then grid rows of role characters. Every part gets a 1px
//               outline ring painted under it unless marked noline (eyes, blush...).
//               Parts named fx_* are also exported as standalone effect sprites.
// frames/*.txt  "anim <name> <fps> [noloop]", then "frame" blocks of "<part|group> x y [fh] [fv]".
//               "group <name>" blocks define reusable placement lists (global across files).
'use strict';
const fs = require('fs');
const path = require('path');
const { SPRITE_SIZE } = require('../src/shared/constants');
const { ROLES } = require('../src/shared/spriteRaster');

const ASSETS = path.join(__dirname, '..', 'assets');
const NO_RING = new Set(['.', 'O', 'M', 'X']); // whiskers and shadow never get outlined
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function checkRow(row, where) {
  for (const ch of row) {
    if (!ROLES.includes(ch)) throw new Error(`${where}: invalid role character '${ch}'`);
  }
}

function lines(text, file) {
  return text.split(/\r?\n/).map((raw, i) => ({ text: raw.trim(), where: `${file}:${i + 1}` }))
    .filter((l) => l.text && !l.text.startsWith('#'));
}

function parseParts(text, file, parts = {}) {
  let cur = null;
  for (const { text: line, where } of lines(text, file)) {
    if (line.startsWith('@')) {
      const [name, ...flags] = line.slice(1).split(/\s+/);
      if (parts[name]) throw new Error(`${where}: duplicate part ${name}`);
      cur = parts[name] = { rows: [], noline: flags.includes('noline'), where };
      continue;
    }
    if (!cur) throw new Error(`${where}: grid row before any @part header`);
    checkRow(line, where);
    if (cur.rows.length && line.length !== cur.rows[0].length) {
      throw new Error(`${where}: row width ${line.length}, expected ${cur.rows[0].length}`);
    }
    cur.rows.push(line);
  }
  return parts;
}

function parseFrames(text, file, groups = {}, anims = {}) {
  let list = null;
  let anim = null;
  for (const { text: line, where } of lines(text, file)) {
    const [word, ...args] = line.split(/\s+/);
    if (word === 'anim') {
      const [name, fps, ...flags] = args;
      if (!name || !(Number(fps) > 0)) throw new Error(`${where}: expected "anim <name> <fps>"`);
      if (anims[name]) throw new Error(`${where}: duplicate anim ${name}`);
      anim = anims[name] = { fps: Number(fps), loop: !flags.includes('noloop'), frames: [] };
      list = null;
    } else if (word === 'group') {
      if (groups[args[0]]) throw new Error(`${where}: duplicate group ${args[0]}`);
      list = groups[args[0]] = [];
      anim = null;
    } else if (word === 'frame') {
      if (!anim) throw new Error(`${where}: frame outside an anim`);
      list = [];
      anim.frames.push(list);
    } else {
      if (!list) throw new Error(`${where}: placement outside a frame or group`);
      const [x, y, ...flags] = args;
      if (!Number.isInteger(Number(x)) || !Number.isInteger(Number(y))) {
        throw new Error(`${where}: expected "<part> x y [fh] [fv]"`);
      }
      list.push({ name: word, x: Number(x), y: Number(y), fh: flags.includes('fh'), fv: flags.includes('fv'), where });
    }
  }
  return { groups, anims };
}

function transform(rows, fh, fv) {
  let out = fh ? rows.map((r) => [...r].reverse().join('')) : rows;
  if (fv) out = [...out].reverse();
  return out;
}

function compose(placements, lib, width, height) {
  const grid = Array.from({ length: height }, () => Array(width).fill('.'));
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;

  function place(list, ox, oy, depth) {
    if (depth > 8) throw new Error('groups nested too deep (cycle?)');
    for (const p of list) {
      if (lib.groups[p.name]) {
        place(lib.groups[p.name], ox + p.x, oy + p.y, depth + 1);
        continue;
      }
      const part = lib.parts[p.name];
      if (!part) throw new Error(`${p.where}: unknown part or group '${p.name}'`);
      const rows = transform(part.rows, p.fh, p.fv);
      const px = ox + p.x;
      const py = oy + p.y;
      const at = (x, y) => (rows[y] && rows[y][x]) || '.';
      if (!part.noline) {
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
          if (NO_RING.has(ch)) return;
          for (const [dx, dy] of DIRS) {
            const gx = px + x + dx;
            const gy = py + y + dy;
            // white fluff merges into white fluff (chin into chest ruff) instead of getting a line
            if (at(x + dx, y + dy) === '.' && inside(gx, gy) && !(ch === 'W' && grid[gy][gx] === 'W')) {
              grid[gy][gx] = 'O';
            }
          }
        }));
      }
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        if (!inside(px + x, py + y)) throw new Error(`${p.where}: part '${p.name}' pixel outside the ${width}x${height} frame`);
        grid[py + y][px + x] = ch;
      }));
    }
  }

  place(placements, 0, 0, 0);
  // final silhouette outline, for noline parts that ended up on the edge
  const add = [];
  grid.forEach((row, y) => row.forEach((ch, x) => {
    if (ch !== '.') return;
    if (DIRS.some(([dx, dy]) => inside(x + dx, y + dy) && !NO_RING.has(grid[y + dy][x + dx]))) add.push([x, y]);
  }));
  for (const [x, y] of add) grid[y][x] = 'O';
  return grid.map((r) => r.join(''));
}

function readDir(dir, ext) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort()
    .map((f) => ({ file: path.join(path.basename(dir), f), text: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

function checkPalettes(coats, eyes) {
  const { buildColors } = require('../src/shared/spriteRaster');
  const anyEye = Object.values(eyes)[0];
  for (const [name, coat] of Object.entries(coats)) {
    try { buildColors(coat, anyEye); } catch (e) { throw new Error(`palette ${name}: ${e.message}`); }
  }
  for (const [name, hex] of Object.entries(eyes)) {
    try { buildColors(Object.values(coats)[0], hex); } catch (e) { throw new Error(`eyes ${name}: ${e.message}`); }
  }
}

function build(assets = ASSETS) {
  const coats = JSON.parse(fs.readFileSync(path.join(assets, 'palettes', 'coats.json'), 'utf8'));
  const eyes = JSON.parse(fs.readFileSync(path.join(assets, 'palettes', 'eyes.json'), 'utf8'));
  checkPalettes(coats, eyes);

  const parts = {};
  for (const { file, text } of readDir(path.join(assets, 'parts'), '.txt')) parseParts(text, file, parts);
  const lib = { parts, groups: {} };
  const anims = {};
  for (const { file, text } of readDir(path.join(assets, 'frames'), '.txt')) parseFrames(text, file, lib.groups, anims);

  const out = { size: SPRITE_SIZE, coats, eyes, anims: {}, fx: {} };
  for (const [name, a] of Object.entries(anims)) {
    if (!a.frames.length) throw new Error(`anim ${name} has no frames`);
    out.anims[name] = { fps: a.fps, loop: a.loop, frames: a.frames.map((f) => compose(f, lib, SPRITE_SIZE, SPRITE_SIZE)) };
  }
  for (const [name, part] of Object.entries(parts)) {
    if (!name.startsWith('fx_')) continue;
    const w = part.rows[0].length + 2;
    const h = part.rows.length + 2;
    out.fx[name.slice(3)] = compose([{ name, x: 1, y: 1, where: part.where }], lib, w, h);
  }
  return out;
}

if (require.main === module) {
  const out = build();
  const file = path.join(ASSETS, 'build', 'sprites.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  const summary = Object.entries(out.anims).map(([n, a]) => `${n} ${a.frames.length}@${a.fps}`).join(', ');
  console.log(`wrote ${path.relative(process.cwd(), file)}: ${summary}; fx: ${Object.keys(out.fx).join(', ')}`);
}

module.exports = { parseParts, parseFrames, compose, build };
