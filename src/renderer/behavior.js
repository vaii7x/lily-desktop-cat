// Lily's state machine: what she does each tick given the cursor and her follow mode.
// Pure rules live in src/shared/behaviorRules.js; this file keeps the state between ticks.
(function () {
  'use strict';
  const R = window.LilyRules;
  const SPEED = { follow: 120, roam: 60, run: 260 }; // DIP/s
  const LYING = new Set(['loaf_idle', 'loaf_grumpy']);
  const PET_MS = 2000;
  const GLANCE_MS = 3000; // a calm activity gives way to watching the cursor while it moved this recently
  const CALM = new Set(['idle_sit', 'idle_sit_droopy', 'look', 'tail_watch']); // sitting ones she can look up from
  const RESUME_MS = 3000; // pause after a roam walk is interrupted by petting or a drag
  const GRAVITY = 3000; // DIP/s^2, perching falls
  const LAND_MS = 340; // the land anim: 2 frames @ 6 fps

  function create(mode) {
    let pos = null; // float window position; whole pixels go to main
    let speed = 0;
    let walking = false;
    let flip = false;
    let last = null;
    let dragged = false;
    let loving = false; // hover love in progress
    let petUntil = 0;
    let pose = 'idle_sit'; // what she was doing before being petted, to purr in the same pose
    let idle = null; // current activity: {anim, until, frame, nextLook}
    let nextIdle = 0;
    let roam = null; // {target, nap, restMs}
    let restUntil = 0;
    let napUntil = 0; // asleep while now < napUntil
    let nextNap = null; // set on the first tick; her own clock, not the user's activity
    let now = 0;
    let lastCursor = null;
    let cursorMovedAt = -Infinity;
    let mood = 'fresh'; // from the work timer in main (it also sends her mood's walking speed)
    let away = false; // the user is away: she sleeps until they come back
    let celebration = null; // welcome-back: {tier, until, seg}
    let nudgeUntil = 0;
    let lead = null; // {anim, until}: plays first during a nudge (stretch_big for a stretch reminder, alert for Claude)
    let quiet = false; // Focus Mode work phase: she stays where she is
    let falling = false; // perching: dropping to the surface below
    let vy = 0;
    let landUntil = 0;
    let calm = false; // reduce-motion setting: no hops, dashes or pounces

    function setMode(m) {
      mode = m;
      walking = false;
      speed = 0;
      restUntil = 0;
    }

    const napping = () => away || now < napUntil;
    // Lying down or asleep: she stays put until her own timer (or the user's return) says otherwise.
    const lyingDown = () => napping() || (idle !== null && LYING.has(idle.anim) && now < idle.until);

    function startNap(ms) {
      napUntil = now + ms;
      nextNap = napUntil + R.awakeMs(Math.random);
      idle = null;
    }

    function pet(t) {
      petUntil = t + PET_MS;
    }

    // Welcome back: wide awake and celebrating for ms (tiers in src/shared/awayTiers.js).
    function celebrate(t, tier, ms) {
      celebration = { tier, until: t + ms, seg: null };
      napUntil = 0;
      nextNap = t + ms + R.awakeMs(Math.random);
      idle = null;
      nextIdle = t + ms + 3000;
    }

    // "Take a break?", a reminder or Claude asking: she looks at you while the bubble is up, after anim for animMs.
    function nudge(t, ms, anim = null, animMs = ms) {
      nudgeUntil = t + ms;
      lead = anim ? { anim, until: t + animMs } : null;
    }

    // One movement step toward goal; faces the way she moves (mostly vertical steps keep her facing).
    function stepToward(goal, vmax, dt, world) {
      const s = R.steer(pos, R.clampPoint(goal, world.range), speed, vmax, dt);
      const mx = s.x - pos.x;
      if (Math.abs(mx) > Math.abs(s.y - pos.y) * 0.3 && mx !== 0) flip = mx < 0;
      pos = { x: s.x, y: s.y };
      speed = s.speed;
      return s.arrived;
    }

    const moveOut = () => ({ x: Math.round(pos.x), y: Math.round(pos.y) });

    // Hop and break tiers jump in place; zoomies dash along her row, hop and spin.
    function party(world, dt, rand) {
      const c = celebration;
      if (calm) return { anim: 'slow_blink', flip, move: null };
      if (c.tier !== 'zoomies') return { anim: 'happy_hop', flip, move: null };
      if (!c.seg || now >= c.seg.until) {
        c.seg = R.zoomiesStep(world.range, pos.y, rand);
        c.seg.until = now + c.seg.ms;
        speed = 0;
      }
      if (!c.seg.target) return { anim: c.seg.anim, flip, move: null };
      if (stepToward(c.seg.target, SPEED.run, dt, world)) c.seg.until = now;
      return { anim: 'run', flip, move: moveOut() };
    }

    function rest(world, rand) {
      if (napping()) return { anim: 'nap_curled' }; // also while the user is away
      if (now >= nextNap) {
        startNap(R.napMs(rand));
        return { anim: 'nap_curled' };
      }
      if (idle && now >= idle.until) idle = null;
      if (!idle && now >= nextIdle) {
        const a = R.pickActivity(rand, mood, calm);
        idle = { anim: a.anim, until: now + a.ms, frame: 4, nextLook: now };
        nextIdle = now + a.ms + a.gap;
      }
      // She watches the cursor whenever she's just sitting (user request), and looks up from calm activities
      // when it moves.
      const watching = { anim: 'watch', frame: R.watchFrame(world.cursor.x - pos.x, world.cursor.y - pos.y, flip) };
      if (idle && CALM.has(idle.anim) && now - cursorMovedAt < GLANCE_MS) return watching;
      if (idle && idle.anim === 'look') {
        if (now >= idle.nextLook) {
          idle.frame = R.lookFrame(rand);
          idle.nextLook = now + 600 + rand() * 900;
        }
        return { anim: 'watch', frame: idle.frame };
      }
      if (idle) return { anim: idle.anim };
      return watching;
    }

    // Where to walk this tick, or null to stay put.
    function target(world, rand) {
      if (lyingDown() || quiet) { // she ignores the cursor until she gets up on her own
        walking = false;
        return null;
      }
      if (mode === 'follow') {
        const spot = R.followSpot(pos, world.cursor, world.range);
        walking = R.shouldWalk(walking, Math.hypot(spot.x - pos.x, spot.y - pos.y));
        return walking ? spot : null;
      }
      if (mode === 'roam') {
        if (walking) return roam.target;
        if (now < restUntil) return null;
        roam = R.pickRoam(world.range, pos.y, rand);
        walking = true;
        return roam.target;
      }
      return null; // stay
    }

    // world: {cursor, pos, range} from main. Returns what to draw and where to move (or null).
    function tick(t, world, rand = Math.random) {
      now = t;
      if (nextNap === null) nextNap = now + R.awakeMs(rand);
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      // Moved by a drag, the clamp or a display change: start from where the window really is.
      if (!pos || Math.hypot(world.pos.x - Math.round(pos.x), world.pos.y - Math.round(pos.y)) > 1.5) pos = { ...world.pos };
      if (!lastCursor || Math.hypot(world.cursor.x - lastCursor.x, world.cursor.y - lastCursor.y) > 2) cursorMovedAt = now;
      lastCursor = world.cursor;
      mood = world.mood || 'fresh';
      away = world.away === true;
      quiet = world.quiet === true;
      calm = world.reduceMotion === true;
      if (celebration && now >= celebration.until) celebration = null;
      // Typing doesn't get her up once she's lying down (user request, Phase 3).
      const typing = lyingDown() ? null : world.typing;

      // Perching: with nothing under her she falls to the surface below, lands, then carries on with what she
      // was doing. Only being held stops it.
      falling = false;
      if (typeof world.ground === 'number' && !dragged && pos.y < world.ground - 1) {
        falling = true;
        walking = false;
        speed = 0;
        vy += GRAVITY * dt;
        pos = { x: pos.x, y: Math.min(pos.y + vy * dt, world.ground) };
        if (pos.y >= world.ground) landUntil = now + LAND_MS;
        return { anim: 'fall', flip, move: moveOut() };
      }
      vy = 0;
      if (now < landUntil && !dragged) return { anim: 'land', flip, move: null };

      const top = R.topState({
        dragged, celebrate: celebration !== null, nudge: now < nudgeUntil, pet: loving || now < petUntil, typing,
      });
      if (top === 'celebrate') {
        walking = false;
        return party(world, dt, rand);
      }
      if (top !== 'move') {
        if (walking && mode === 'roam') restUntil = now + RESUME_MS;
        walking = false;
        speed = 0;
        const leading = lead !== null && now < lead.until;
        const anim = { dragged: 'dragged_limp', nudge: leading ? lead.anim : 'watch', pet: R.petPose(pose) }[top]
          || (typing === 'steam' ? 'type_fast_steam' : 'type_knead');
        const frame = top === 'nudge' && !leading ? 4 : top === 'typing' ? R.kneadFrame(world.presses || 0) : undefined;
        return { anim, flip, frame, move: null };
      }

      const goal = target(world, rand);
      if (!goal) {
        const r = rest(world, rand);
        pose = r.anim;
        return { ...r, flip, move: null };
      }
      idle = null;
      pose = 'walk';
      if (stepToward(goal, SPEED[mode] * (world.speed || 1), dt, world)) {
        walking = false;
        speed = 0;
        if (mode === 'roam') {
          restUntil = now + roam.restMs;
          if (roam.nap) startNap(roam.restMs);
        }
      }
      return { anim: 'walk', flip, move: moveOut() };
    }

    return {
      tick,
      pet,
      celebrate,
      nudge,
      setMode,
      setDragged: (v) => { dragged = v; },
      setLoving: (v) => { loving = v; },
      get walking() { return walking || falling || celebration !== null; },
      get celebrating() { return celebration !== null; },
      get napping() { return napping(); },
    };
  }

  window.LilyBehavior = { create };
})();
