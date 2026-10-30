// Settings defaults and migration (LILY_PLAN section 3). Pure, so it can be unit-tested.
const { DEFAULT_SCALE } = require('./constants');
const { validReminder } = require('./scheduler');

const SCHEMA_VERSION = 2;

const DEFAULTS = {
  schemaVersion: SCHEMA_VERSION,
  position: { x: null, y: null },
  scale: DEFAULT_SCALE,
  followMode: 'stay', // user request (Phase 3): she shouldn't chase the cursor unless asked to
  alwaysOnTop: true,
  roam: true,
  perchOnWindows: false,
  hideInFullscreen: true,
  reduceMotion: false, // fewer bouncy animations and effects
  coat: { preset: 'calico_tabby', eyes: 'yellow_green' },
  startWithWindows: false,
  thresholds: { hopAwayMin: 2, breakAwayMin: 5, zoomiesAwayMin: 20 },
  mood: { freshMaxMin: 30, grooveMaxMin: 90, tiredMaxMin: 120 },
  reminders: [],
  focus: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 },
  claudeHook: { enabled: false, port: 47821 },
  timer: { endsAt: null, leftMs: null }, // v2: a running or paused countdown survives a restart
  focusRun: { phase: '', cycle: 0, endsAt: null }, // v2: the Pomodoro in progress
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Fills missing keys from defaults, drops values of the wrong type. Never throws.
function merge(defaults, raw) {
  const out = {};
  for (const [k, d] of Object.entries(defaults)) {
    const v = isObj(raw) ? raw[k] : undefined;
    if (isObj(d)) out[k] = merge(d, v);
    else if (Array.isArray(d)) out[k] = Array.isArray(v) ? v : structuredClone(d);
    else if (d === null) out[k] = isNum(v) ? v : null;
    else out[k] = typeof v === typeof d ? v : d;
  }
  return out;
}

function migrate(raw) {
  // v1 -> v2 only added keys (timer, focusRun), which merge fills in; the checks below hold for every version.
  const s = merge(DEFAULTS, raw);
  s.schemaVersion = SCHEMA_VERSION;
  if (!Number.isInteger(s.scale) || s.scale < 1 || s.scale > 6) s.scale = DEFAULTS.scale;
  if (!['follow', 'stay', 'roam'].includes(s.followMode)) s.followMode = DEFAULTS.followMode;
  if (s.position.x === null || s.position.y === null) s.position = { x: null, y: null };
  s.reminders = s.reminders.filter(validReminder);
  const t = s.thresholds;
  if (!(t.hopAwayMin >= 1 && t.hopAwayMin < t.breakAwayMin && t.breakAwayMin < t.zoomiesAwayMin)) {
    s.thresholds = { ...DEFAULTS.thresholds };
  }
  if (s.timer.endsAt !== null && s.timer.leftMs !== null) s.timer = { ...DEFAULTS.timer };
  if (!['work', 'short', 'long'].includes(s.focusRun.phase) || s.focusRun.endsAt === null) s.focusRun = { ...DEFAULTS.focusRun };
  if (Object.values(s.focus).some((v) => !Number.isInteger(v) || v < 1)) s.focus = { ...DEFAULTS.focus };
  const port = s.claudeHook.port;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) s.claudeHook.port = DEFAULTS.claudeHook.port;
  return s;
}

module.exports = { SCHEMA_VERSION, DEFAULTS, migrate };
