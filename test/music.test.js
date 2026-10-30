const test = require('node:test');
const assert = require('node:assert');
const { NO_MUSIC, musicStep, START_MS, STOP_MS } = require('../src/shared/music');

// Feeds level(t) every 100 ms from `from` to `to`; returns the last state.
function run(s, from, to, level) {
  for (let t = from; t <= to; t += 100) s = musicStep(s, level(t), t);
  return s;
}

test('music: on after 8 s of sound, off after 6 s of quiet', () => {
  let s = run(NO_MUSIC, 0, START_MS - 200, () => 0.3);
  assert.equal(s.on, false);
  s = run(s, START_MS - 100, START_MS + 100, () => 0.3);
  assert.equal(s.on, true);
  s = run(s, START_MS + 200, START_MS + STOP_MS - 300, () => 0);
  assert.equal(s.on, true); // a quiet bit inside a song
  s = run(s, START_MS + STOP_MS, START_MS + STOP_MS + 500, () => 0);
  assert.equal(s.on, false);
});

test('music: short dings never count, and a long gap restarts the wait', () => {
  // a 1 s ding every 5 s
  assert.equal(run(NO_MUSIC, 0, 60000, (t) => (t % 5000 < 1000 ? 0.05 : 0)).on, false);
  // 5 s of sound, 4 s quiet, 5 s of sound: not 8 s in one stretch
  assert.equal(run(NO_MUSIC, 0, 14000, (t) => (t < 5000 || t >= 9000 ? 0.2 : 0)).on, false);
  // beats with 1 s gaps still add up
  assert.equal(run(NO_MUSIC, 0, 9000, (t) => (t % 2000 < 1000 ? 0.2 : 0)).on, true);
});
