// A small speech bubble in the room above her head: short text (and reminder icons), gone after a few seconds.
// With no bubble up, a running timer or focus countdown shows there as a smaller tag.
(function () {
  'use strict';
  const INK = '#2a2025';

  function create(scale, sprites, look) {
    let cur = null; // {text, until, icons}

    function show(text, ms, now, icons = []) {
      cur = { text, until: now + ms, icons };
    }

    // Box with a dark border and a tail pointing down at her; returns its inner left x.
    function box(ctx, w, h, y) {
      const W = ctx.canvas.width;
      const x = Math.round((W - w) / 2);
      ctx.fillStyle = INK;
      ctx.fillRect(x + scale, y, w - 2 * scale, h);
      ctx.fillRect(x, y + scale, w, h - 2 * scale);
      ctx.fillRect(W / 2 - scale, y + h, 2 * scale, 2 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + scale, y + scale, w - 2 * scale, h - 2 * scale);
      return x;
    }

    function draw(ctx, now, tag) {
      if (cur && now >= cur.until) cur = null;
      const W = ctx.canvas.width;
      if (!cur) {
        if (!tag) return;
        ctx.font = `${4 * scale}px "Segoe UI", sans-serif`;
        const w = Math.min(W - 2 * scale, Math.ceil(ctx.measureText(tag).width) + 6 * scale);
        box(ctx, w, 7 * scale, 9 * scale);
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, W / 2, 12.5 * scale + scale / 2, w - 4 * scale);
        return;
      }
      ctx.font = `bold ${5 * scale}px "Segoe UI", sans-serif`;
      const imgs = cur.icons.map((k) => sprites.fx(`icon_${k}`, look));
      const iconW = imgs.reduce((n, img) => n + (img.width + 1) * scale, 0);
      const w = Math.min(W - 2 * scale, Math.ceil(ctx.measureText(cur.text).width) + iconW + 6 * scale);
      const h = 11 * scale;
      const y = 2 * scale;
      let x = box(ctx, w, h, y) + 3 * scale;
      for (const img of imgs) {
        ctx.drawImage(img, x, y + Math.round((h - img.height * scale) / 2), img.width * scale, img.height * scale);
        x += (img.width + 1) * scale;
      }
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textW = w - (x - Math.round((W - w) / 2)) - 3 * scale;
      ctx.fillText(cur.text, x + textW / 2, y + h / 2 + scale / 2, textW);
    }

    return { show, draw, get active() { return cur !== null; } };
  }

  window.LilyBubbles = { create };
})();
