// Cat window: runs the behavior loop, draws Lily, hit-tests her pixels, and turns presses into pet / drag / menu.
(async function () {
  'use strict';
  const { sprites: data, look, scale, bubbleRoom, followMode } = await window.lily.init();
  const sprites = window.LilySprites.create(data);
  const animator = window.LilyAnimator.create(sprites);
  const particles = window.LilyParticles.create(sprites, look, scale, bubbleRoom);
  const bubbles = window.LilyBubbles.create(scale, sprites, look);
  const behavior = window.LilyBehavior.create(followMode);
  const press = window.LilyPress.createPressClassifier();
  const canvas = document.getElementById('cat');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const S = data.size;
  canvas.width = S * scale;
  canvas.height = (S + bubbleRoom) * scale;
  const catTop = bubbleRoom * scale;
  const R = window.LilyRules;
  const HOVER_PET_MS = 500;
  const LOVE_HEART_MS = 700; // a new heart this often while she is being hovered
  const HEAD_ROWS = 32; // top 32 sprite rows of the cat = her head and chin in sitting poses
  const HOVER_SLACK = 4 * scale; // the cursor counts as on her within this many px of her outline
  const FX_MS = { party: 350, steam: 300, note: 900 }; // how often a sparkle/heart or steam puff appears
  const FOCUS = { work: 'focus time', short: 'break time!', long: 'long break!' };
  const NUDGE = { tired: ['take a break?', 5000], overworked: ['break time!!', 7000] };

  let dragging = false;
  let holdTimer = null;
  let hoverSince = null; // when the cursor settled on her head; null once loving starts or it leaves
  let loving = false; // hover-pet in progress: purrs and hearts until the cursor leaves her
  let lastHeart = 0;
  let lastFx = 0;
  let keysPopAt = 0; // typing keys: when they popped in...
  let keyedAt = null; // ...and the last tick she was typing (null: hidden)
  let pose = null;
  let tag = null; // timer / focus countdown over her head
  let quiet = false; // Focus Mode work phase
  let reduceMotion = false; // setting: no sparkles, steam or keyboard shake
  let music = false; // headphones stay on while she types over a song
  let nextMeow = performance.now() + R.meowGapMs(Math.random);

  function setLoving(v) {
    loving = v;
    behavior.setLoving(v);
  }

  // Hearts start above her head, which is lower when she is loafing or curled up.
  const LOW_HEAD = new Set(['loaf_idle', 'loaf_purr', 'nap_curled', 'curl_purr']);
  const heartY = () => bubbleRoom + (LOW_HEAD.has(pose) ? 18 : 6);

  async function tick(now) {
    // The cursor can rest without firing mousemove, so the hover timer is checked here.
    if (hoverSince !== null && now - hoverSince >= HOVER_PET_MS) {
      hoverSince = null;
      setLoving(true);
    }
    if (loving && now - lastHeart >= LOVE_HEART_MS) {
      particles.add(12 + Math.floor(Math.random() * 18), now, heartY());
      lastHeart = now;
    }
    const world = await window.lily.world();
    if (!world) return;
    tag = world.tag || null;
    quiet = world.quiet === true;
    reduceMotion = world.reduceMotion === true;
    music = world.music === true;
    const out = behavior.tick(now, world);
    meow(now);
    effects(out.anim, now);
    if (R.TYPE_ANIMS.has(out.anim)) {
      if (!R.keyLayer(keysPopAt, keyedAt, now)) keysPopAt = now; // still fading: no second pop, no flicker
      keyedAt = now;
    } else if (out.anim === 'dragged_limp') keyedAt = null; // picked up: the keys vanish at once
    animator.set(out.anim, now, out);
    if (out.anim !== pose) {
      pose = out.anim;
      window.lily.setPose(pose); // main keeps her body, not the empty sprite margin, on screen
    }
    if (out.move) window.lily.move(out.move.x, out.move.y);
  }

  // Now and then a meow, out of nowhere; skipped (until next time) while she sleeps, is held, or you focus.
  function meow(now) {
    if (now < nextMeow) return;
    nextMeow = now + R.meowGapMs(Math.random);
    if (!behavior.napping && !dragging && !quiet && !bubbles.active) bubbles.show(R.meowText(Math.random), 2000, now);
  }

  // Sparkles and hearts while she celebrates, steam puffs off her head while you type fast.
  function effects(anim, now) {
    if (reduceMotion) return;
    const kind = behavior.celebrating ? 'party' : { type_fast_steam: 'steam', vibe: 'note' }[anim] || null;
    if (!kind || now - lastFx < FX_MS[kind]) return;
    lastFx = now;
    if (kind === 'steam') particles.add(Math.random() < 0.5 ? 10 : 32, now, bubbleRoom + 8, 'steam');
    else if (kind === 'note') particles.add(Math.random() < 0.5 ? 6 : 36, now, bubbleRoom + 10, 'note');
    else particles.add(8 + Math.floor(Math.random() * 30), now, heartY(), Math.random() < 0.5 ? 'heart' : 'sparkle');
  }

  // The keyboard over her lower body, then her paws on it (the pressing paw on its sunken key).
  // It pops up when typing starts, shakes while she steams, and fades out after typing stops.
  function drawKeys(now) {
    const k = R.keyLayer(keysPopAt, keyedAt, now);
    if (!k) return;
    const typing = R.TYPE_ANIMS.has(animator.name);
    const left = typing && animator.frameIndex === 0;
    const shake = animator.name === 'type_fast_steam' && !reduceMotion ? (Math.floor(now / 50) % 2 ? 1 : -1) : 0;
    const put = (name, x, y) => {
      const img = sprites.fx(name, look);
      ctx.drawImage(img, x * scale, catTop + y * scale, img.width * scale, img.height * scale);
    };
    ctx.globalAlpha = k.alpha;
    put(typing ? (left ? 'keyboard_l' : 'keyboard_r') : 'keyboard', R.KEYBOARD.x + shake, R.KEYBOARD.y + k.dy);
    ctx.globalAlpha = 1;
    if (!typing) return;
    for (const side of ['left', 'right']) {
      const p = R.PAWS[side];
      put('paw_key', p.x, (side === 'left') === left ? p.down : p.up);
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(animator.frame(now, look), 0, catTop, S * scale, S * scale);
    if (animator.name === 'type_fast_steam') {
      // red-faced from the effort: tint only her pixels
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255, 40, 40, 0.28)';
      ctx.fillRect(0, catTop, S * scale, S * scale);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (music && R.TYPE_ANIMS.has(animator.name)) {
      const img = sprites.fx('headphones', look);
      const x = animator.flip ? S - R.HEADPHONES.x - img.width : R.HEADPHONES.x; // mirrored poses mirror her head
      ctx.drawImage(img, x * scale, catTop + R.HEADPHONES.y * scale, img.width * scale, img.height * scale);
    }
    drawKeys(now);
    particles.draw(ctx, now);
    bubbles.draw(ctx, now, tag);
  }

  // 30 Hz while walking, 4 Hz while napping, 12 Hz otherwise (sprites run at 2-8 fps); nothing while hidden.
  async function loop() {
    if (!document.hidden) {
      const now = performance.now();
      await tick(now);
      draw(now);
    }
    const ms = document.hidden ? 500 : behavior.walking || R.TYPE_ANIMS.has(pose) ? 33 : behavior.napping && !particles.active && !bubbles.active ? 250 : 83;
    setTimeout(loop, ms);
  }

  function pet() {
    const now = performance.now();
    behavior.pet(now);
    particles.add(26, now, heartY());
    particles.add(14, now + 500, heartY());
    particles.add(22, now + 1000, heartY());
  }

  // Opaque pixel under the cursor = clickable (cat, hearts, later bubbles).
  const isOpaqueAt = (x, y) => ctx.getImageData(x, y, 1, 1).data[3] > 0;

  let ignoring = true;
  function setIgnore(ignore) {
    if (ignore === ignoring) return;
    ignoring = ignore;
    window.lily.setIgnoreMouse(ignore);
  }

  function startDrag(grabX, grabY) {
    setLoving(false);
    hoverSince = null;
    dragging = true;
    behavior.setDragged(true);
    setIgnore(false);
    window.lily.dragStart(grabX, grabY);
  }

  function endPress(result) {
    clearInterval(holdTimer);
    if (result === 'drop') {
      dragging = false;
      behavior.setDragged(false);
      window.lily.dragEnd();
    } else if (result === 'click') pet();
    else if (result === 'double') window.lily.openMenu();
  }

  // Any opaque pixel within HOVER_SLACK of (x, y). The window gets forwarded mousemoves over its
  // transparent pixels too, so this works just outside her outline.
  function isNearCat(x, y) {
    if (x < 0 || y < 0) return false;
    const box = ctx.getImageData(x - HOVER_SLACK, y - HOVER_SLACK, HOVER_SLACK * 2 + 1, HOVER_SLACK * 2 + 1).data;
    for (let i = 3; i < box.length; i += 4) if (box[i] > 0) return true;
    return false;
  }

  // Resting on (or right next to) her head for 0.5 s starts a purr that lasts while the cursor stays on or near her.
  function trackHover(x, y) {
    if (dragging) return;
    const onCat = isNearCat(x, y);
    const onHead = onCat && y >= catTop - HOVER_SLACK && y < catTop + HEAD_ROWS * scale;
    if (onHead && hoverSince === null && !loving) hoverSince = performance.now();
    if (!onHead) hoverSince = null;
    if (!onCat && loving) setLoving(false);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !isOpaqueAt(e.offsetX, e.offsetY)) return;
    canvas.setPointerCapture(e.pointerId);
    const grab = { x: e.clientX, y: e.clientY };
    press.down(e.screenX, e.screenY, performance.now());
    clearInterval(holdTimer);
    holdTimer = setInterval(() => {
      if (press.tick(performance.now()) === 'drag') startDrag(grab.x, grab.y);
    }, 20);
    canvas.onpointermove = (m) => {
      if (press.move(m.screenX, m.screenY) === 'drag') startDrag(grab.x, grab.y);
    };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    canvas.onpointermove = null;
    endPress(press.up(performance.now()));
  });

  canvas.addEventListener('pointercancel', () => {
    canvas.onpointermove = null;
    endPress(dragging ? press.up(performance.now()) : (press.cancel(), null));
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!dragging) setIgnore(!isOpaqueAt(e.offsetX, e.offsetY));
    trackHover(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('mouseleave', () => {
    if (!dragging) setIgnore(true);
    trackHover(-1, -1);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (isOpaqueAt(e.offsetX, e.offsetY)) window.lily.openMenu();
  });

  window.lily.onFollowMode((m) => behavior.setMode(m));
  window.lily.onActivity((ev) => {
    const now = performance.now();
    if (ev.type === 'celebrate') {
      behavior.celebrate(now, ev.tier, Number(ev.ms) || 0);
      if (ev.tier !== 'hop') bubbles.show("you're back!", 2500, now);
    } else if (ev.type === 'nudge' && NUDGE[ev.mood]) {
      const [text, ms] = NUDGE[ev.mood];
      behavior.nudge(now, ms);
      bubbles.show(text, ms, now);
    } else if (ev.type === 'timer-done') {
      behavior.celebrate(now, 'break', 4000);
      bubbles.show("time's up!", 5000, now);
    } else if (ev.type === 'focus' && FOCUS[ev.phase]) {
      if (ev.phase !== 'work') behavior.celebrate(now, 'break', 5000); // she sits quiet during work
      bubbles.show(FOCUS[ev.phase], 4000, now);
    } else if (ev.type === 'reminder' && Array.isArray(ev.kinds)) {
      const kinds = ev.kinds.filter((k) => ['water', 'eyes', 'stretch'].includes(k));
      behavior.nudge(now, 6000, kinds.includes('stretch') ? 'stretch_big' : null, 1400); // stretch_big: 8 frames @ 6 fps
      bubbles.show(String(ev.text), 6000, now, kinds);
    } else if (ev.type === 'claude' && ev.kind === 'stop') {
      behavior.celebrate(now, 'break', 3000);
      bubbles.show('done!', 3000, now);
    } else if (ev.type === 'claude' && ev.kind === 'notification') {
      behavior.nudge(now, 4000, 'alert');
      bubbles.show('?', 4000, now);
    } else if (ev.type === 'say') {
      bubbles.show(String(ev.text), 5000, now);
    }
  });
  loop();
})();
