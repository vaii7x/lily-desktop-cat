// Mood by continuous work time (LILY_PLAN section 5). Pure; thresholds come from settings.mood.

const MOODS = ['fresh', 'groove', 'tired', 'overworked'];
// Walking speed multiplier per mood.
const SPEED = { fresh: 1, groove: 0.9, tired: 0.7, overworked: 0.5 };

// Fresh 0-30, Groove 30-90, Tired 90-120, Overworked 120+ (each boundary minute belongs to the next tier).
function moodFor(workMin, m) {
  if (workMin < m.freshMaxMin) return 'fresh';
  if (workMin < m.grooveMaxMin) return 'groove';
  if (workMin < m.tiredMaxMin) return 'tired';
  return 'overworked';
}

// "Take a break?" at 90 min, then every 15 min; every 10 min once overworked.
// lastMin: work minute of the previous nudge in this session, or null.
function nudgeDue(workMin, lastMin, m) {
  if (workMin < m.grooveMaxMin) return false;
  if (lastMin === null) return true;
  return workMin - lastMin >= (workMin >= m.tiredMaxMin ? 10 : 15);
}

module.exports = { MOODS, SPEED, moodFor, nudgeDue };
