const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/shared/behaviorRules');
const { positionRange } = require('../src/shared/placement');
const { migrate } = require('../src/shared/settingsSchema');

const range = { x0: 0, x1: 1000, y0: 0, y1: 600 };
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('higher states interrupt lower ones', () => {
  assert.equal(R.topState({}), 'move');
  assert.equal(R.topState({ pet: true }), 'pet');
  assert.equal(R.topState({ pet: true, dragged: true }), 'dragged');
  assert.equal(R.topState({ typing: true, celebrate: true }), 'celebrate');
  assert.equal(R.topState({ music: true, typing: true }), 'typing'); // typing over a song, then back to vibing
  assert.equal(R.topState({ music: true, pet: true }), 'pet');
});

test('petting keeps her pose: lying down she purrs lying down', () => {
  assert.equal(R.petPose('idle_sit'), 'pet_purr');
  assert.equal(R.petPose('walk'), 'pet_purr');
  assert.equal(R.petPose('loaf_idle'), 'loaf_purr');
  assert.equal(R.petPose('nap_curled'), 'curl_purr');
  assert.equal(R.petPose('loaf_grumpy'), 'loaf_purr');
  const anims = require('../assets/build/sprites.json').anims;
  for (const p of ['loaf_purr', 'curl_purr']) assert.ok(anims[p], p);
});

test('follow: walks sideways along her row to 80 px from the cursor, never up or down', () => {
  assert.deepEqual(R.followSpot({ x: 500, y: 600 }, { x: 100, y: 50 }, range), { x: 180, y: 600 });
  assert.deepEqual(R.followSpot({ x: 100, y: 600 }, { x: 900, y: 600 }, range), { x: 820, y: 600 });
  const near = { x: 500, y: 600 };
  assert.equal(R.followSpot(near, { x: 450, y: 100 }, range), near); // cursor above her: she stays put
  // Cursor past the screen edge: the spot is clamped, so she can arrive and stop.
  assert.deepEqual(R.followSpot({ x: 500, y: 600 }, { x: 1200, y: 600 }, range), { x: 1000, y: 600 });
});

test('follow hysteresis: no getting up for small cursor moves, no stopping short', () => {
  assert.equal(R.shouldWalk(false, 30), false);
  assert.equal(R.shouldWalk(false, 51), true);
  assert.equal(R.shouldWalk(true, 30), true);
  assert.equal(R.shouldWalk(true, 0.5), false);
});

test('steer accelerates smoothly, caps speed, and never overshoots', () => {
  const a = R.steer({ x: 0, y: 0 }, { x: 1000, y: 0 }, 0, 120, 0.1);
  assert.ok(a.speed > 0 && a.speed <= 40.0001 && a.x > 0 && a.x < 5);
  const fast = R.steer({ x: 0, y: 0 }, { x: 1000, y: 0 }, 120, 120, 0.1);
  assert.equal(fast.speed, 120);
  const end = R.steer({ x: 0, y: 0 }, { x: 2, y: 0 }, 120, 120, 0.1);
  assert.deepEqual([end.x, end.arrived], [2, true]);
  assert.ok(end.speed < 120); // slowing down near the target
  assert.equal(R.steer({ x: 5, y: 5 }, { x: 5, y: 5 }, 0, 120, 0.1).arrived, true);
});

test('gaze picks one of 8 directions (3x3 grid), head turns when the cursor is far, mirrored when flipped', () => {
  assert.equal(R.watchFrame(5, 5, false), 4); // on her face: straight ahead
  assert.equal(R.watchFrame(-200, 10, false), 3); // left
  assert.equal(R.watchFrame(200, 10, false), 5); // right
  assert.equal(R.watchFrame(10, -200, false), 1); // up
  assert.equal(R.watchFrame(10, 200, false), 7); // down
  assert.equal(R.watchFrame(-100, -100, false), 0); // up-left
  assert.equal(R.watchFrame(100, -100, false), 2); // up-right
  assert.equal(R.watchFrame(-100, 100, false), 6); // down-left
  assert.equal(R.watchFrame(100, 100, false), 8); // down-right
  assert.equal(R.watchFrame(100, 100, true), 6); // facing left: mirrored
  assert.equal(R.watchFrame(-600, 0, false), 12); // far left: head turns too
  assert.equal(R.watchFrame(400, -400, false), 11); // far up-right
  // Sector edges at 22.5 degrees: a mostly-horizontal cursor still counts as level.
  assert.equal(R.watchFrame(100, 40, false), 5);
  assert.equal(R.watchFrame(100, 45, false), 8);
});

test('her nap routine: awake 10-20 min, then a 1-2 min nap', () => {
  assert.equal(R.awakeMs(() => 0), 10 * 60000);
  assert.equal(R.awakeMs(() => 1), 20 * 60000);
  assert.equal(R.napMs(() => 0), 60000);
  assert.equal(R.napMs(() => 1), 120000);
});

test('activities and roam picks stay within spec and the screen', () => {
  const first = R.pickActivity(seq(0, 0, 0));
  assert.deepEqual([first.anim, first.ms, first.gap], ['idle_sit', 6000, 3000]);
  const last = R.pickActivity(seq(0.999, 1, 1));
  assert.deepEqual([last.anim, last.ms, last.gap], ['slow_blink', 1000, 10000]);
  const loaf = R.pickActivity(seq(0.45, 0.5, 0)); // weights 3+2+2+1 = 8 of 19 come before loaf
  assert.deepEqual([loaf.anim, loaf.ms], ['loaf_idle', 60000]); // lying down lasts a minute or so
  // Every activity is a real animation (or the code-driven look-around), and each gets picked.
  const anims = Object.keys(require('../assets/build/sprites.json').anims);
  for (const list of Object.values(R.MOOD_ACTIVITIES)) {
    for (const [name] of list) assert.ok(name === 'look' || anims.includes(name), name);
  }
  const seen = new Set();
  for (let i = 0; i < 100; i++) seen.add(R.pickActivity(seq(i / 100, 0.5, 0.5)).anim);
  assert.equal(seen.size, R.ACTIVITIES.length);
  assert.equal(R.lookFrame(() => 0.9999), 17);
  assert.equal(R.meowText(() => 0.9999), 'mrow');
  for (let i = 0; i < 100; i++) assert.ok(!R.LIVELY.has(R.pickActivity(seq(i / 100, 0.5, 0.5), 'fresh', true).anim)); // reduce motion
  const nap = R.pickRoam(range, 600, seq(0.05, 0.9, 0));
  assert.deepEqual([nap.target, nap.nap, nap.restMs], [{ x: 1000, y: 600 }, true, 30000]);
  const walk = R.pickRoam(range, 600, seq(0.5, 0.25, 0));
  assert.deepEqual([walk.target, walk.nap], [{ x: 250, y: 600 }, false]);
});

test('position range keeps the cat rect inside the work area', () => {
  const cat = { x: 20, y: 52, width: 60, height: 82 };
  assert.deepEqual(positionRange(cat, { x: 0, y: 0, width: 1440, height: 810 }), { x0: -20, x1: 1360, y0: -52, y1: 676 });
});

test('unknown follow modes fall back to stay', () => {
  assert.equal(migrate({ followMode: 'fly' }).followMode, 'stay');
  assert.equal(migrate({ followMode: 'roam' }).followMode, 'roam');
});

test('typing: knead within 1.5 s of a press, steam at 8+ keys/s over 2 s', () => {
  assert.equal(R.typingLevel([], 10000), null);
  assert.equal(R.typingLevel([8600], 10000), 'knead');
  assert.equal(R.typingLevel([8500], 10000), null); // 1.5 s ago: done
  const fast = Array.from({ length: 16 }, (_, i) => 8100 + i * 120);
  assert.equal(R.typingLevel(fast, 10000), 'steam');
  assert.equal(R.typingLevel(fast.slice(1), 10000), 'knead'); // 15 keys in 2 s is not quite 8/s
});

test('moods change her idle set and sit pose; zoomies stay on her row', () => {
  const tired = new Set(R.MOOD_ACTIVITIES.tired.map(([a]) => a));
  assert.ok(tired.has('idle_sit_droopy') && tired.has('yawn') && !tired.has('idle_sit'));
  assert.ok(R.MOOD_ACTIVITIES.overworked.some(([a]) => a === 'loaf_grumpy'));
  assert.equal(R.pickActivity(seq(0.99, 0, 0), 'overworked').anim, 'loaf_grumpy');
  const dash = R.zoomiesStep(range, 600, seq(0.1, 0.5));
  assert.deepEqual([dash.anim, dash.target], ['run', { x: 500, y: 600 }]);
  assert.equal(R.zoomiesStep(range, 600, seq(0.6, 0)).anim, 'happy_hop');
  assert.equal(R.zoomiesStep(range, 600, seq(0.9, 0)).anim, 'spin');
});

test('typing keys: each real press moves the other paw, and the keys fade 1.5 s after the last press', () => {
  // Alternation follows the press count, not a clock: press 1 left, 2 right, 3 left...
  assert.deepEqual([1, 2, 3, 4, 5].map(R.kneadFrame), [0, 1, 0, 1, 0]);
  // Presses at 0 and 400 ms: typing until 1.9 s, then the keys fade over KEY_FADE_MS.
  const presses = [0, 400];
  const typingAt = (now) => R.typingLevel(presses.filter((t) => t <= now), now);
  assert.equal(typingAt(1899), 'knead');
  assert.equal(typingAt(1900), null);
  // The renderer stamps keyedAt on every typing tick, so the last one is just before 1.9 s.
  const keyedAt = 1899;
  const pop = R.keyLayer(0, 0, 0);
  assert.deepEqual([pop.alpha, pop.dy], [1, 4]); // popping in from below
  assert.deepEqual(R.keyLayer(0, keyedAt, keyedAt), { alpha: 1, dy: 0 });
  const mid = R.keyLayer(0, keyedAt, keyedAt + R.KEY_FADE_MS / 2);
  assert.ok(mid.alpha > 0.4 && mid.alpha < 0.6);
  assert.equal(R.keyLayer(0, keyedAt, keyedAt + R.KEY_FADE_MS), null); // gone
  assert.equal(R.keyLayer(0, null, 5000), null); // never typed / picked up
  // Typing again mid-fade keeps the same keys (no second pop): popAt stays put, so dy stays 0.
  assert.deepEqual(R.keyLayer(0, keyedAt + 100, keyedAt + 100), { alpha: 1, dy: 0 });
});

test('random meows: 3-8 min apart', () => {
  assert.equal(R.meowGapMs(() => 0), 3 * 60000);
  assert.equal(R.meowGapMs(() => 1), 8 * 60000);
});
