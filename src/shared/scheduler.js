// Countdown timer, Pomodoro focus and reminders (LILY_PLAN Phase 5). Pure: every function takes `now` (wall-clock
// ms) and returns new values, so state can live in settings and survive a restart.
const MIN = 60000;

const REMINDER_TEXT = { stretch: 'time to stretch!', water: 'drink some water', eyes: 'rest your eyes', custom: '' };
const TEXT_MAX = 24; // the bubble is only as wide as her window

// Whole number in [lo, hi], or null.
function intIn(v, lo, hi) {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

// --- Timer: {endsAt, leftMs}. Running: endsAt set. Paused: leftMs set. Off: both null.
const NO_TIMER = { endsAt: null, leftMs: null };
const startTimer = (min, now) => ({ endsAt: now + min * MIN, leftMs: null });
const timerLeft = (t, now) => (t.endsAt !== null ? Math.max(0, t.endsAt - now) : t.leftMs);
const pauseTimer = (t, now) => (t.endsAt === null ? t : { endsAt: null, leftMs: timerLeft(t, now) });
const resumeTimer = (t, now) => (t.leftMs === null ? t : { endsAt: now + t.leftMs, leftMs: null });
const timerDone = (t, now) => t.endsAt !== null && now >= t.endsAt;

// --- Focus: {phase: '' | 'work' | 'short' | 'long', cycle (work phases finished), endsAt}.
const NO_FOCUS = { phase: '', cycle: 0, endsAt: null };
const startFocus = (cfg, now) => ({ phase: 'work', cycle: 0, endsAt: now + cfg.workMin * MIN });

function nextPhase(run, cfg) {
  if (run.phase !== 'work') return { phase: 'work', cycle: run.cycle, endsAt: run.endsAt + cfg.workMin * MIN };
  const cycle = run.cycle + 1;
  const long = cycle % cfg.cyclesBeforeLong === 0;
  return { phase: long ? 'long' : 'short', cycle, endsAt: run.endsAt + (long ? cfg.longBreakMin : cfg.shortBreakMin) * MIN };
}

// Moves past every phase that has ended (several if the app was closed meanwhile); each phase starts when the
// last one ended, so the schedule doesn't drift. Lengths must be >= 1 min (focusConfig makes sure).
function advanceFocus(run, cfg, now) {
  let r = run;
  while (r.phase && now >= r.endsAt) r = nextPhase(r, cfg);
  return { run: r, changed: r !== run };
}

// Focus lengths from untrusted input; falls back to the current values.
function focusConfig(raw, cur) {
  const pick = (k, hi) => intIn(raw && raw[k], 1, hi) ?? cur[k];
  return { workMin: pick('workMin', 180), shortBreakMin: pick('shortBreakMin', 60), longBreakMin: pick('longBreakMin', 120),
    cyclesBeforeLong: pick('cyclesBeforeLong', 12) };
}

// --- Reminders: {id, kind, text, repeat, everyMin, nextAt}. Repeating ones fire every everyMin; once-only ones
// fire once, everyMin after they were made.
function makeReminder(raw, now, id) {
  const kind = raw && Object.hasOwn(REMINDER_TEXT, raw.kind) ? raw.kind : null;
  const min = intIn(raw && raw.min, 1, 1440);
  const text = kind === 'custom' ? String(raw.text || '').trim().slice(0, TEXT_MAX) : REMINDER_TEXT[kind];
  if (!kind || !min || !text) return null;
  return { id, kind, text, repeat: raw.repeat === true, everyMin: min, nextAt: now + min * MIN };
}

const validReminder = (r) => r !== null && typeof r === 'object' && Object.hasOwn(REMINDER_TEXT, r.kind)
  && typeof r.text === 'string' && r.text.length > 0 && intIn(r.everyMin, 1, 1440) !== null
  && Number.isFinite(r.nextAt) && typeof r.id === 'string';

// Nothing fires while the user is away; whatever came due meanwhile fires together once they're back.
// Returns {list, fired}; repeating reminders that fired restart their interval from now.
function dueReminders(list, now, away) {
  const fired = away ? [] : list.filter((r) => r.nextAt <= now);
  if (!fired.length) return { list, fired };
  const next = list.filter((r) => r.nextAt > now || r.repeat)
    .map((r) => (r.nextAt <= now ? { ...r, nextAt: now + r.everyMin * MIN } : r));
  return { list: next, fired };
}

// "4:05", "1:02:09"
function fmtLeft(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const mmss = `${Math.floor((s % 3600) / 60)}:${String(s % 60).padStart(2, '0')}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mmss.padStart(5, '0')}` : mmss;
}

module.exports = {
  REMINDER_TEXT, TEXT_MAX, intIn, NO_TIMER, startTimer, timerLeft, pauseTimer, resumeTimer, timerDone,
  NO_FOCUS, startFocus, advanceFocus, focusConfig, makeReminder, validReminder, dueReminders, fmtLeft,
};
