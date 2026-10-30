// Hearts, sparkles and steam puffs that rise from her into the bubble room and fade out.
(function () {
  'use strict';
  const LIFE_MS = 1200;
  const RISE = { heart: 22, sparkle: 12, steam: 14, note: 18 }; // sprite px over a lifetime
  const DRIFT = { heart: 0, sparkle: 0, steam: 6, note: 5 }; // steam drifts away from her head

  function create(sprites, look, scale, bubbleRoom) {
    let list = []; // {x, y0 (sprite px), born (ms, may be in the future for staggered ones), kind}

    function add(x, born, y0 = bubbleRoom + 6, kind = 'heart') {
      list.push({ x, y0, born, kind });
    }

    function draw(ctx, now) {
      list = list.filter((p) => now - p.born < LIFE_MS);
      for (const p of list) {
        const t = (now - p.born) / LIFE_MS;
        if (t < 0) continue;
        const img = sprites.fx(p.kind, look);
        const x = p.x + Math.round(t * DRIFT[p.kind] * (p.x < 24 ? -1 : 1));
        const y = p.y0 - Math.round(t * RISE[p.kind]);
        ctx.globalAlpha = 1 - t * t;
        ctx.drawImage(img, x * scale, y * scale, img.width * scale, img.height * scale);
      }
      ctx.globalAlpha = 1;
    }

    return { add, draw, get active() { return list.length > 0; } };
  }

  window.LilyParticles = { create };
})();
