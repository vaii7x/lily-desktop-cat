// Away detection and welcome-back tiers (LILY_PLAN section 5). Pure; thresholds come from settings.thresholds.
const MIN = 60000;

// A = away duration. Under hopAwayMin: nothing; then a hop; from breakAwayMin a break; from zoomiesAwayMin zoomies.
function awayTier(awayMs, t) {
  const m = awayMs / MIN;
  if (m < t.hopAwayMin) return 'none';
  if (m < t.breakAwayMin) return 'hop';
  if (m < t.zoomiesAwayMin) return 'break';
  return 'zoomies';
}

// A break (or longer) resets the work timer to Fresh.
const resetsTimer = (tier) => tier === 'break' || tier === 'zoomies';

// How long she celebrates, in real ms: one hop, 6-8 s of jumping, or 15-20 s of zoomies.
function celebrateMs(tier, rand) {
  if (tier === 'hop') return 600;
  if (tier === 'break') return 6000 + rand() * 2000;
  if (tier === 'zoomies') return 15000 + rand() * 5000;
  return 0;
}

// One poll of the away tracker. state: {awayStart: ms|null, sessionStart: ms}. idleMs: time since the last input.
// She counts as away once idle reaches hopAwayMin (when she curls up); any input after that brings her back.
// Returns {state, event}: event is {type: 'away'}, {type: 'back', tier, awayMs}, or null.
function step(state, now, idleMs, t) {
  const awayAfter = t.hopAwayMin * MIN;
  if (state.awayStart === null) {
    if (idleMs < awayAfter) return { state, event: null };
    return { state: { ...state, awayStart: now - idleMs }, event: { type: 'away' } };
  }
  if (idleMs >= awayAfter) return { state, event: null };
  const awayMs = now - idleMs - state.awayStart; // ended at the last input, not at this poll
  const tier = awayTier(awayMs, t);
  return {
    state: { awayStart: null, sessionStart: resetsTimer(tier) ? now : state.sessionStart },
    event: { type: 'back', tier, awayMs },
  };
}

module.exports = { awayTier, resetsTimer, celebrateMs, step };
