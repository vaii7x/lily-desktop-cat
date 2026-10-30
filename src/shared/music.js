// Music reactions: is something playing? Pure, fed the speakers' peak level about 10 times a second.
// Sound has to last START_MS before she puts her headphones on (so dings and short clips don't count); short
// quiet bits inside a song are fine, and she takes them off after STOP_MS of silence.
const LOUD = 0.002; // peak level; digital silence reads ~0, a quiet system chime ~0.01
const START_MS = 8000;
const GAP_MS = 3000; // quiet allowed while waiting to start (between tracks, soft intros)
const STOP_MS = 6000;

const NO_MUSIC = { on: false, since: null, last: null };

// s: {on, since (when this stretch of sound began), last (last loud sample)}
function musicStep(s, peak, now) {
  let { on, since, last } = s;
  if (peak >= LOUD) {
    if (!on && (last === null || now - last > GAP_MS)) since = now;
    last = now;
  }
  const recent = last !== null && now - last < (on ? STOP_MS : GAP_MS);
  return { on: recent && now - since >= START_MS, since, last };
}

module.exports = { LOUD, START_MS, GAP_MS, STOP_MS, NO_MUSIC, musicStep };
