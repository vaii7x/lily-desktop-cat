// Turns a role-coded sprite grid into RGBA pixels. Shared by the renderer (browser global) and tools (CommonJS).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LilyRaster = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // '.' transparent, O outline, B base, S stripe, P peach, W white, N nose, E iris,
  // K pupil, H shine, I inner ear, T tail dark, M whisker, X shadow,
  // L/G/D light/mid/dark grey for the typing keys, A water blue for the reminder icon (same in every coat)
  const ROLES = '.OBSPWNEKHITMXLGDA';
  const FIXED = { L: '#d8d5dc', G: '#a29daa', D: '#6e6876', A: '#4f9fe0' };
  const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

  function parseHex(hex) {
    if (!HEX.test(hex)) throw new Error(`bad colour ${hex}`);
    const n = (i) => parseInt(hex.slice(i, i + 2), 16);
    return [n(1), n(3), n(5), hex.length === 9 ? n(7) : 255];
  }

  // coat: {O: '#rrggbb', B: ...} for every role except '.' and 'E'; eye: '#rrggbb'
  function buildColors(coat, eye) {
    const colors = { '.': [0, 0, 0, 0], E: parseHex(eye) };
    for (const role of ROLES.slice(1)) {
      if (role === 'E') continue;
      if (FIXED[role]) {
        colors[role] = parseHex(FIXED[role]);
        continue;
      }
      if (!coat[role]) throw new Error(`coat is missing role ${role}`);
      colors[role] = parseHex(coat[role]);
    }
    return colors;
  }

  function rasterize(rows, colors, flip) {
    const height = rows.length;
    const width = rows[0].length;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = colors[rows[y][flip ? width - 1 - x : x]];
        data.set(c, (y * width + x) * 4);
      }
    }
    return { width, height, data };
  }

  return { ROLES, parseHex, buildColors, rasterize };
});
