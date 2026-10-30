// Plays one animation at a time at its own fps; looping or one-shot comes from sprites.json, flip mirrors it.
(function () {
  'use strict';

  function create(sprites) {
    let name = 'idle_sit';
    let start = performance.now();
    let flip = false;
    let hold = null; // fixed frame index (watch poses), or null to animate

    // Restarts timing only when the animation changes, so calling it every tick is fine.
    function set(next, now, opts = {}) {
      if (next !== name) {
        name = next;
        start = now;
      }
      flip = opts.flip === true;
      hold = Number.isInteger(opts.frame) ? opts.frame : null;
    }

    function frame(now, look) {
      const i = hold !== null ? hold : Math.floor(((now - start) * sprites.info(name).fps) / 1000);
      return sprites.frame(name, i, look, flip);
    }

    return { set, frame, get name() { return name; }, get frameIndex() { return hold; } };
  }

  window.LilyAnimator = { create };
})();
