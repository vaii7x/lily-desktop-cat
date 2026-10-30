// Renders compiled sprites (assets/build/sprites.json) to cached offscreen canvases in any coat.
// Needs src/shared/spriteRaster.js loaded first (window.LilyRaster).
(function () {
  'use strict';
  const { buildColors, rasterize } = window.LilyRaster;

  function create(data) {
    const cache = new Map();
    const colorsByLook = new Map();

    function colors(coat, eyes) {
      const key = `${coat}/${eyes}`;
      if (!colorsByLook.has(key)) {
        if (!data.coats[coat] || !data.eyes[eyes]) throw new Error(`unknown look ${key}`);
        colorsByLook.set(key, buildColors(data.coats[coat], data.eyes[eyes]));
      }
      return colorsByLook.get(key);
    }

    function toCanvas(rows, look, flip) {
      const img = rasterize(rows, colors(look.coat, look.eyes), flip);
      const canvas = new OffscreenCanvas(img.width, img.height);
      canvas.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
      return canvas;
    }

    function cached(key, make) {
      if (!cache.has(key)) cache.set(key, make());
      return cache.get(key);
    }

    // look: {coat, eyes}; flip: true for left-facing
    function frame(anim, index, look, flip = false) {
      const a = data.anims[anim];
      if (!a) throw new Error(`unknown anim ${anim}`);
      const i = a.loop ? index % a.frames.length : Math.min(index, a.frames.length - 1);
      return cached(`${anim}/${i}/${look.coat}/${look.eyes}/${flip}`, () => toCanvas(a.frames[i], look, flip));
    }

    function fx(name, look) {
      if (!data.fx[name]) throw new Error(`unknown fx ${name}`);
      return cached(`fx/${name}/${look.coat}/${look.eyes}`, () => toCanvas(data.fx[name], look, false));
    }

    return {
      size: data.size,
      frame,
      fx,
      info: (anim) => ({ fps: data.anims[anim].fps, loop: data.anims[anim].loop, count: data.anims[anim].frames.length }),
      clear: () => cache.clear(),
    };
  }

  window.LilySprites = { create };
})();
