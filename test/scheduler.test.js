const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/shared/scheduler');
const { migrate, DEFAULTS, SCHEMA_VERSION } = require('../src/shared/settingsSchema');

const MIN = 60000;
const cfg = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLong: 2 };

test('timer runs, pauses, resumes and finishes', () => {
  let t = S.startTimer(5, 0);
  assert.equal(S.timerLeft(t, MIN), 4 * MIN);
  t = S.pauseTimer(t, MIN);
  assert.equal(S.timerLeft(t, 10 * MIN), 4 * MIN); // paused: time stands still
  assert.equal(S.timerDone(t, 10 * MIN), false);
  t = S.resumeTimer(t, 10 * MIN);
  assert.equal(S.timerDone(t, 14 * MIN - 1), false);
  assert.equal(S.timerDone(t, 14 * MIN), true);
  assert.equal(S.timerLeft(S.NO_TIMER, 0), null);
});

test('focus cycles work and breaks, long break after cyclesBeforeLong', () => {
  let r = S.startFocus(cfg, 0);
  assert.deepEqual(S.advanceFocus(r, cfg, 25 * MIN - 1), { run: r, changed: false });
  r = S.advanceFocus(r, cfg, 25 * MIN).run;
  assert.deepEqual(r, { phase: 'short', cycle: 1, endsAt: 30 * MIN });
  r = S.advanceFocus(r, cfg, 30 * MIN).run;
  assert.deepEqual(r, { phase: 'work', cycle: 1, endsAt: 55 * MIN });
  r = S.advanceFocus(r, cfg, 55 * MIN).run;
  assert.deepEqual(r, { phase: 'long', cycle: 2, endsAt: 70 * MIN });
});

test('focus catches up in one step after the app was closed, without drifting', () => {
  const r = S.advanceFocus(S.startFocus(cfg, 0), cfg, 56 * MIN);
  assert.equal(r.changed, true);
  assert.deepEqual(r.run, { phase: 'long', cycle: 2, endsAt: 70 * MIN });
  assert.equal(S.advanceFocus(S.NO_FOCUS, cfg, 1e12).changed, false);
});

test('focusConfig keeps valid whole minutes only', () => {
  assert.deepEqual(S.focusConfig({ workMin: 50, shortBreakMin: 0, longBreakMin: 'x', cyclesBeforeLong: 3 }, cfg),
    { workMin: 50, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLong: 3 });
});

test('makeReminder validates input', () => {
  assert.deepEqual(S.makeReminder({ kind: 'water', min: 30, repeat: true }, 0, 'a'),
    { id: 'a', kind: 'water', text: 'drink some water', repeat: true, everyMin: 30, nextAt: 30 * MIN });
  assert.equal(S.makeReminder({ kind: 'custom', text: '   ', min: 5 }, 0, 'b'), null);
  assert.equal(S.makeReminder({ kind: 'nope', min: 5 }, 0, 'c'), null);
  assert.equal(S.makeReminder({ kind: 'eyes', min: 0 }, 0, 'd'), null);
  assert.equal(S.makeReminder({ kind: 'custom', text: 'x'.repeat(50), min: 5 }, 0, 'e').text.length, S.TEXT_MAX);
});

test('reminders: repeat reschedules, once is removed, away defers and collapses', () => {
  const rep = S.makeReminder({ kind: 'stretch', min: 10, repeat: true }, 0, 'r');
  const once = S.makeReminder({ kind: 'eyes', min: 15 }, 0, 'o');
  let r = S.dueReminders([rep, once], 10 * MIN, false);
  assert.deepEqual(r.fired.map((x) => x.id), ['r']);
  assert.equal(r.list[0].nextAt, 20 * MIN);
  // away from 12 to 40 min: both came due, nothing fires until the user is back, then both fire together, once
  assert.equal(S.dueReminders(r.list, 39 * MIN, true).fired.length, 0);
  r = S.dueReminders(r.list, 40 * MIN, false);
  assert.deepEqual(r.fired.map((x) => x.id), ['r', 'o']);
  assert.deepEqual(r.list.map((x) => [x.id, x.nextAt]), [['r', 50 * MIN]]);
});

test('fmtLeft', () => {
  assert.equal(S.fmtLeft(0), '0:00');
  assert.equal(S.fmtLeft(4 * MIN + 5000), '4:05');
  assert.equal(S.fmtLeft(4 * MIN + 4001), '4:05'); // rounds up: never shows 0:00 while time is left
  assert.equal(S.fmtLeft(62 * MIN + 9000), '1:02:09');
});

test('settings migrate v1 -> v2', () => {
  const v1 = {
    schemaVersion: 1, scale: 3, followMode: 'roam', coat: { preset: 'black', eyes: 'blue' },
    thresholds: { hopAwayMin: 5, breakAwayMin: 2, zoomiesAwayMin: 20 }, // out of order: reset
    reminders: [{ id: 'ok', kind: 'water', text: 'drink some water', repeat: true, everyMin: 30, nextAt: 5 }, { kind: 'bad' }, null],
  };
  const s = migrate(v1);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.scale, 3);
  assert.equal(s.followMode, 'roam');
  assert.deepEqual(s.coat, { preset: 'black', eyes: 'blue' });
  assert.deepEqual(s.thresholds, DEFAULTS.thresholds);
  assert.deepEqual(s.reminders.map((r) => r.id), ['ok']);
  assert.deepEqual(s.timer, { endsAt: null, leftMs: null });
  assert.deepEqual(s.focusRun, DEFAULTS.focusRun);
  assert.deepEqual(migrate({ focusRun: { phase: 'party', cycle: 1, endsAt: 5 } }).focusRun, DEFAULTS.focusRun);
  assert.deepEqual(migrate({ timer: { endsAt: 9, leftMs: 3 } }).timer, DEFAULTS.timer);
});
