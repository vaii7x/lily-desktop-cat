// Work timer, mood and away detection from the system idle time, lock/unlock and suspend/resume.
// Sends {type: 'celebrate', tier, ms} and {type: 'nudge', mood} to the cat window.
// --debug-clock=N runs the work timer and away time N times faster (default 20) to test the tiers.
const { powerMonitor } = require('electron');
const settings = require('./settings');
const { step, celebrateMs, resetsTimer } = require('../shared/awayTiers');
const { moodFor, nudgeDue } = require('../shared/moodTiers');

const flag = process.argv.find((a) => a.startsWith('--debug-clock'));
const SPEED = flag ? Math.max(1, Number(flag.split('=')[1]) || 20) : 1;
const POLL_MS = 1000;
const t0 = Date.now();
const clock = () => t0 + (Date.now() - t0) * SPEED;

let state = { awayStart: null, sessionStart: clock() };
let offSince = null; // locked or suspended since (clock ms): she is away no matter what the idle time says
let lastNudgeMin = null;
let mood = 'fresh';
let send = () => {};
let quiet = () => false; // Focus Mode work phase: no nudges

const systemIdleMs = () => powerMonitor.getSystemIdleTime() * 1000 * SPEED;

function poll() {
  const now = clock();
  const idleMs = offSince !== null ? now - offSince : systemIdleMs();
  const r = step(state, now, idleMs, settings.get().thresholds);
  state = r.state;
  if (r.event && r.event.type === 'back') {
    if (resetsTimer(r.event.tier)) lastNudgeMin = null; // a real break: fresh start
    if (r.event.tier !== 'none') send({ type: 'celebrate', tier: r.event.tier, ms: celebrateMs(r.event.tier, Math.random) });
  }
  const workMin = (now - state.sessionStart) / 60000;
  const m = settings.get().mood;
  const next = moodFor(workMin, m);
  if (state.awayStart === null && !quiet() && nudgeDue(workMin, lastNudgeMin, m)) {
    lastNudgeMin = workMin;
    send({ type: 'nudge', mood: next });
  }
  if (SPEED > 1 && (next !== mood || r.event)) {
    console.log(`[lily debug] work ${workMin.toFixed(1)} min, mood ${next}${r.event ? `, ${r.event.type} ${r.event.tier || ''}` : ''}`);
  }
  mood = next;
}

function start(sender, isQuiet) {
  send = sender;
  quiet = isQuiet;
  const off = () => {
    if (offSince === null) offSince = clock() - systemIdleMs();
  };
  // Check once more while still "off" (so a long lock counts as away), then let real input bring her back.
  const on = () => {
    if (offSince === null) return;
    poll();
    offSince = null;
    poll();
  };
  powerMonitor.on('lock-screen', off);
  powerMonitor.on('suspend', off);
  powerMonitor.on('unlock-screen', on);
  powerMonitor.on('resume', on);
  setInterval(poll, POLL_MS);
  if (SPEED > 1) console.log(`[lily debug] clock x${SPEED}`);
}

module.exports = { start, mood: () => mood, away: () => state.awayStart !== null };
