// Global key-press counter for typing reactions. Privacy (LILY_PLAN rule 6): it keeps only a running count and
// the times of the last few presses, never which key; nothing is logged or sent anywhere. If the hook fails to
// load, typing reactions are simply off.
let hook = null;
let times = [];
let count = 0; // each press moves her other paw

function start() {
  try {
    const { uIOhook } = require('uiohook-napi');
    uIOhook.on('keydown', () => {
      const now = Date.now();
      count++;
      times.push(now);
      if (times.length > 64) times = times.filter((t) => now - t < 2000);
    });
    uIOhook.start();
    hook = uIOhook;
  } catch (err) {
    console.warn('[lily] keyboard hook unavailable, typing reactions are off:', err.message);
  }
}

function stop() {
  try {
    if (hook) hook.stop();
  } catch { /* quitting anyway */ }
  hook = null;
}

// Press times from the last 2 s.
function recent(now = Date.now()) {
  times = times.filter((t) => now - t < 2000);
  return times;
}

module.exports = { start, stop, recent, count: () => count };
