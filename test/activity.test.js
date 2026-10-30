const test = require('node:test');
const assert = require('node:assert/strict');
const { moodFor, nudgeDue, SPEED } = require('../src/shared/moodTiers');
const { awayTier, resetsTimer, celebrateMs, step } = require('../src/shared/awayTiers');
const { DEFAULTS } = require('../src/shared/settingsSchema');

const m = DEFAULTS.mood;
const t = DEFAULTS.thresholds;
const MIN = 60000;

test('mood tiers at every boundary', () => {
  const at = (mins) => mins.map((x) => moodFor(x, m));
  assert.deepEqual(at([0, 29, 29.99]), ['fresh', 'fresh', 'fresh']);
  assert.deepEqual(at([30, 31, 89]), ['groove', 'groove', 'groove']);
  assert.deepEqual(at([90, 91, 119]), ['tired', 'tired', 'tired']);
  assert.deepEqual(at([120, 121, 600]), ['overworked', 'overworked', 'overworked']);
  assert.deepEqual(Object.keys(SPEED), ['fresh', 'groove', 'tired', 'overworked']);
  assert.ok(SPEED.fresh > SPEED.groove && SPEED.groove > SPEED.tired && SPEED.tired > SPEED.overworked);
});

test('nudges: first at 90 min, then every 15, every 10 once overworked', () => {
  assert.equal(nudgeDue(89, null, m), false);
  assert.equal(nudgeDue(90, null, m), true);
  assert.equal(nudgeDue(104, 90, m), false);
  assert.equal(nudgeDue(105, 90, m), true);
  assert.equal(nudgeDue(120, 105, m), true); // crossed into overworked: 15 min still counts
  assert.equal(nudgeDue(129, 120, m), false);
  assert.equal(nudgeDue(130, 120, m), true);
});

test('away tiers at every boundary', () => {
  const at = (mins) => mins.map((x) => awayTier(x * MIN, t));
  assert.deepEqual(at([0, 1, 1.99]), ['none', 'none', 'none']);
  assert.deepEqual(at([2, 3, 4.99]), ['hop', 'hop', 'hop']);
  assert.deepEqual(at([5, 6, 19.99]), ['break', 'break', 'break']);
  assert.deepEqual(at([20, 21, 300]), ['zoomies', 'zoomies', 'zoomies']);
  assert.deepEqual(['none', 'hop', 'break', 'zoomies'].map(resetsTimer), [false, false, true, true]);
  assert.equal(celebrateMs('hop', () => 0), 600);
  assert.deepEqual([celebrateMs('break', () => 0), celebrateMs('break', () => 1)], [6000, 8000]);
  assert.deepEqual([celebrateMs('zoomies', () => 0), celebrateMs('zoomies', () => 1)], [15000, 20000]);
});

test('away tracker: curls up after 2 idle minutes, celebrates on return, resets the timer only for breaks', () => {
  let s = { awayStart: null, sessionStart: 0 };
  assert.equal(step(s, 100 * MIN, 1.9 * MIN, t).event, null);
  let r = step(s, 100 * MIN, 2 * MIN, t);
  assert.deepEqual(r.event, { type: 'away' });
  assert.equal(r.state.awayStart, 98 * MIN); // away since the last input
  s = r.state;
  assert.equal(step(s, 101 * MIN, 3 * MIN, t).event, null); // still away
  // Back after 3 min away (input 1 s before this poll): a hop, same work session.
  r = step(s, 101 * MIN + 1000, 1000, t);
  assert.deepEqual([r.event.tier, r.event.awayMs, r.state.awayStart, r.state.sessionStart], ['hop', 3 * MIN, null, 0]);
  // Back after 10 min: a break, the session restarts now.
  r = step(s, 108 * MIN, 0, t);
  assert.deepEqual([r.event.tier, r.state.sessionStart], ['break', 108 * MIN]);
  assert.equal(step(s, 130 * MIN, 0, t).event.tier, 'zoomies');
});
