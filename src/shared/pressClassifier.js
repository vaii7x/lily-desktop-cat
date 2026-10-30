// Tells a click from a drag from a double-click (LILY_PLAN section 5). Pure: callers pass times and screen points.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LilyPress = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DRAG_PX = 4;
  const DRAG_MS = 150;
  const DOUBLE_MS = 350;

  function createPressClassifier() {
    let press = null; // {x, y, t, dragging}
    let lastClickAt = -Infinity;

    return {
      down(x, y, t) { press = { x, y, t, dragging: false }; },
      // Returns 'drag' once, when the press turns into a drag (moved > 4 px).
      move(x, y) {
        if (!press || press.dragging) return null;
        if (Math.hypot(x - press.x, y - press.y) <= DRAG_PX) return null;
        press.dragging = true;
        return 'drag';
      },
      // Call on a timer while pressed. Returns 'drag' once, when held over 150 ms.
      tick(t) {
        if (!press || press.dragging || t - press.t <= DRAG_MS) return null;
        press.dragging = true;
        return 'drag';
      },
      // Returns 'drop' (end of drag), 'double', 'click', or null (no press).
      up(t) {
        if (!press) return null;
        const p = press;
        press = null;
        if (p.dragging) return 'drop';
        if (t - lastClickAt <= DOUBLE_MS) { lastClickAt = -Infinity; return 'double'; }
        lastClickAt = t;
        return 'click';
      },
      cancel() { press = null; },
    };
  }

  return { DRAG_PX, DRAG_MS, DOUBLE_MS, createPressClassifier };
});
