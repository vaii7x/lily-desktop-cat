// Pure behavior rules (LILY_PLAN section 5). Positions are window positions in DIP; the main process
// shifts the cursor so "cursor" means "where her window would be if her eyes sat on the cursor".
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LilyRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Higher interrupts lower.
  const PRIORITY = ['dragged', 'celebrate', 'nudge', 'pet', 'typing', 'music', 'mood', 'move'];
  const FOLLOW_STOP = 80; // she sits this far from the cursor
  const FOLLOW_GO = 50; // ...and gets up once her spot is this far away (hysteresis: no jitter at rest)
  const ACCEL = 400; // DIP/s^2, for smooth starts and stops
  const WATCH_NEAR = 30; // cursor this close to her eyes: she looks straight ahead
  const WATCH_FAR = 250; // beyond this her head turns as well as her eyes
  const SIN_22 = Math.sin(Math.PI / 8); // half a 45-degree sector

  const topState = (active) => PRIORITY.find((s) => active[s]) || 'move';

  // Petting her keeps her pose: lying down she purrs lying down (user request), otherwise she sits up to purr.
  const PET_POSES = { loaf_idle: 'loaf_purr', loaf_grumpy: 'loaf_purr', nap_curled: 'curl_purr' };
  const petPose = (pose) => PET_POSES[pose] || 'pet_purr';

  const clampPoint = (p, r) => ({ x: Math.min(Math.max(p.x, r.x0), r.x1), y: Math.min(Math.max(p.y, r.y0), r.y1) });

  // She only walks sideways along her own row (user request: never wander over screen content), so follow
  // means: FOLLOW_STOP to the side of the cursor's x, same height, kept on her screen.
  // Within that distance she stays put, so hovering or petting her never makes her back away.
  function followSpot(pos, cursor, range) {
    const dx = pos.x - cursor.x;
    if (Math.abs(dx) <= FOLLOW_STOP) return pos;
    return clampPoint({ x: cursor.x + Math.sign(dx) * FOLLOW_STOP, y: pos.y }, range);
  }

  const shouldWalk = (walking, remaining) => (walking ? remaining >= 1 : remaining > FOLLOW_GO);

  // One movement step toward target: accelerates to vmax, slows down to arrive, never overshoots.
  function steer(pos, target, speed, vmax, dt) {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const remaining = Math.hypot(dx, dy);
    if (remaining < 0.5) return { x: target.x, y: target.y, speed: 0, arrived: true };
    const want = Math.min(vmax, Math.sqrt(2 * ACCEL * remaining));
    const v = speed < want ? Math.min(want, speed + ACCEL * dt) : want;
    const step = Math.min(v * dt, remaining);
    return { x: pos.x + (dx / remaining) * step, y: pos.y + (dy / remaining) * step, speed: v, arrived: step === remaining };
  }

  // watch frames (see assets/frames/sit.txt): a 3x3 grid of gaze directions, row-major, 4 = straight ahead.
  // The 8 directions are 45-degree sectors around her eyes; past WATCH_FAR her head turns too (+9).
  // Mirrored sprites swap left and right.
  function watchFrame(dx, dy, flip) {
    const d = Math.hypot(dx, dy);
    if (d < WATCH_NEAR) return 4;
    const x = flip ? -dx : dx;
    const col = Math.abs(x) / d < SIN_22 ? 1 : x < 0 ? 0 : 2;
    const row = Math.abs(dy) / d < SIN_22 ? 1 : dy < 0 ? 0 : 2;
    return row * 3 + col + (d > WATCH_FAR ? 9 : 0);
  }

  const between = (rand, lo, hi) => lo + rand() * (hi - lo);

  // Things she does on her own while awake (user request: more to do than sitting and staring).
  // [anim, weight, min ms, max ms]; 'look' is a code-driven look-around using the watch frames.
  // Lying down (loaf) lasts minutes and ends only on its own timer.
  const ACTIVITIES = [
    ['idle_sit', 3, 6000, 12000], // tail swish and blinks
    ['groom', 2, 5000, 10000], // washing her face with a paw
    ['look', 2, 4000, 8000], // glancing around the room
    ['yawn', 1, 1200, 1200], // one yawn (6 frames @ 5 fps)
    ['loaf_idle', 1, 30000, 90000], // lying down
    ['stretch', 1, 2000, 2000], // one big stretch (8 frames @ 4 fps)
    ['bat_paw', 2, 2000, 4000], // swiping at a bug only she can see
    ['tail_watch', 2, 3000, 6000], // eyes on her own swishing tail
    ['pounce', 2, 1250, 1250], // crouch, wiggle, pounce on the spot (10 frames @ 8 fps)
    ['spin', 1, 1300, 2000], // chasing her tail
    ['happy_hop', 1, 1200, 1200], // two little hops for no reason
    ['slow_blink', 1, 1000, 1000], // a friendly slow blink (4 frames @ 4 fps)
  ];
  // Work-time moods change what she does between rests: calmer in the groove, droopy when tired, grumpy when
  // overworked. Fresh is her normal routine above.
  const MOOD_ACTIVITIES = {
    fresh: ACTIVITIES,
    groove: [['idle_sit', 2, 6000, 12000], ['groom', 1, 5000, 10000], ['look', 1, 4000, 8000], ['slow_blink', 1, 1000, 1000],
      ['loaf_idle', 2, 60000, 120000], ['stretch', 1, 2000, 2000], ['bat_paw', 1, 2000, 4000], ['tail_watch', 1, 3000, 6000]],
    tired: [['idle_sit_droopy', 4, 6000, 12000], ['yawn', 3, 1200, 1200], ['loaf_idle', 3, 60000, 180000], ['stretch', 1, 2000, 2000]],
    overworked: [['idle_sit_droopy', 2, 6000, 12000], ['yawn', 2, 1200, 1200], ['loaf_grumpy', 4, 60000, 180000]],
  };

  // Bouncy ones, left out with the reduce-motion setting.
  const LIVELY = new Set(['bat_paw', 'pounce', 'spin', 'happy_hop']);

  // The next activity, and a 3-10 s plain sit after it.
  function pickActivity(rand, mood = 'fresh', calm = false) {
    const list = (MOOD_ACTIVITIES[mood] || ACTIVITIES).filter(([a]) => !calm || !LIVELY.has(a));
    let r = rand() * list.reduce((n, a) => n + a[1], 0);
    const a = list.find(([, w]) => (r -= w) < 0) || list[list.length - 1];
    return { anim: a[0], ms: between(rand, a[2], a[3]), gap: between(rand, 3000, 10000) };
  }

  // Typing reactions from recent key-press times (ms): kneading within 1.5 s of a press, steaming at 8+ keys/s
  // sustained over 2 s.
  function typingLevel(times, now) {
    const recent = times.filter((t) => now - t < 2000);
    if (!recent.length || now - recent[recent.length - 1] >= 1500) return null;
    return recent.length >= 16 ? 'steam' : 'knead';
  }

  // The typing keyboard and her paws on it: top-left of each fx sprite (incl. its outline), in sprite px.
  // Her paws rest on two keys of its middle row; a pressing paw stands on its sunken key, the other is lifted.
  const KEYBOARD = { x: 8, y: 38 };
  const PAWS = { left: { x: 18, down: 36, up: 33 }, right: { x: 23, down: 36, up: 33 } };
  const TYPE_ANIMS = new Set(['type_knead', 'type_fast_steam']);
  // Headphones over a typing pose while music plays (user request): typing head at (12,6), fx sprite incl. outline.
  const HEADPHONES = { x: 9, y: 7 };
  const KEY_POP_MS = 150; // the keyboard slides up this fast when typing starts...
  const KEY_POP_PX = 4; // ...from this far below
  const KEY_FADE_MS = 300; // and fade out this fast once she stops (1.5 s after the last press)

  // Each real key press moves the other paw: odd presses are the left paw (frame 0), even ones the right.
  const kneadFrame = (presses) => (presses % 2 === 1 ? 0 : 1);

  // The key layer: popAt = when it appeared, keyedAt = last time she was typing (null = never).
  // Returns null when hidden, else {alpha, dy (sprite px below its spot)}.
  function keyLayer(popAt, keyedAt, now) {
    if (keyedAt === null || now - keyedAt >= KEY_FADE_MS) return null;
    const pop = Math.min(1, (now - popAt) / KEY_POP_MS);
    return { alpha: 1 - Math.max(0, now - keyedAt) / KEY_FADE_MS, dy: Math.round((1 - pop) * KEY_POP_PX) };
  }

  // Zoomies: dash to a random spot along her row, hop, or spin; each segment is short.
  function zoomiesStep(range, y, rand) {
    const r = rand();
    if (r < 0.5) return { anim: 'run', target: { x: between(rand, range.x0, range.x1), y }, ms: 2500 };
    return { anim: r < 0.75 ? 'happy_hop' : 'spin', target: null, ms: between(rand, 900, 1500) };
  }

  // A random gaze while looking around (any of the 18 watch frames).
  const lookFrame = (rand) => Math.min(17, Math.floor(rand() * 18));

  // Her own rest routine (user request: not tied to keyboard or cursor activity, and not too sleepy):
  // awake for 10-20 min, then a 1-2 min nap curled up.
  const awakeMs = (rand) => between(rand, 10 * 60000, 20 * 60000);
  const napMs = (rand) => between(rand, 60000, 120000);

  // Now and then, out of nowhere, a meow (user request): every 3-8 min, in one of a few voices.
  const meowGapMs = (rand) => between(rand, 3 * 60000, 8 * 60000);
  const MEOWS = ['meow', 'meow!', 'mrrp?', 'mew', 'mrow'];
  const meowText = (rand) => MEOWS[Math.min(MEOWS.length - 1, Math.floor(rand() * MEOWS.length))];

  // Roam: wander to a random spot along her row (height y) and rest there, or sometimes nap at one end.
  function pickRoam(range, y, rand) {
    if (rand() < 0.1) {
      return { target: { x: rand() < 0.5 ? range.x0 : range.x1, y }, nap: true, restMs: between(rand, 30000, 90000) };
    }
    return { target: { x: between(rand, range.x0, range.x1), y }, nap: false, restMs: between(rand, 5000, 20000) };
  }

  return {
    PRIORITY, FOLLOW_STOP, FOLLOW_GO, WATCH_NEAR, WATCH_FAR,
    topState, petPose, clampPoint, followSpot, shouldWalk, steer, watchFrame, ACTIVITIES,
    pickActivity, LIVELY, lookFrame, awakeMs, napMs, pickRoam, MOOD_ACTIVITIES, typingLevel, zoomiesStep,
    KEYBOARD, PAWS, TYPE_ANIMS, HEADPHONES, KEY_FADE_MS, kneadFrame, keyLayer, meowGapMs, meowText,
  };
});
