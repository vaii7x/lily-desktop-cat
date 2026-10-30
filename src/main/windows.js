// Cat window: placement, drag, persistence, look and size.
const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');
const settings = require('./settings');
const sprites = require('../../assets/build/sprites.json');
const { BUBBLE_ROOM, windowSize } = require('../shared/constants');
const input = require('./input');
const idle = require('./idle');
const timers = require('./timers');
const { typingLevel, TYPE_ANIMS } = require('../shared/behaviorRules');
const { SPEED: MOOD_SPEED } = require('../shared/moodTiers');
const { clampPosition, nearestArea, positionRange, defaultPosition, opaqueBounds } = require('../shared/placement');
const { surfaces, groundAt, coveredDisplay } = require('../shared/perch');
const tracker = require('./winTracker');

let catWin = null;
let dragTimer = null;
let surfs = []; // window tops she can stand on (perching), DIP
let perched = null; // {id, x, y}: the window under her feet and where it was at the last poll
let hiddenForFullscreen = false;

const webPreferences = (preload) => ({ preload, contextIsolation: true, nodeIntegration: false, sandbox: true });
const size = () => windowSize(settings.get().scale);
const workAreas = () => screen.getAllDisplays().map((d) => d.workArea);
const fromCat = (e) => catWin && e.sender === catWin.webContents;

// Visible pixels of each pose, so screen edges clamp to her body, not the empty sprite margin.
const bodies = Object.fromEntries(Object.entries(sprites.anims).map(([name, a]) => [name, opaqueBounds(a.frames)]));
// The typing keys reach the bottom row of the sprite.
for (const name of TYPE_ANIMS) bodies[name].height = sprites.size - bodies[name].y;
let pose = 'idle_sit'; // the renderer reports her current animation

// The cat occupies the bottom square of the window; the bubble room above is transparent.
function catRect(name = pose) {
  const s = settings.get().scale;
  const b = bodies[name];
  return { x: b.x * s, y: (BUBBLE_ROOM + b.y) * s, width: b.width * s, height: b.height * s };
}

// Unknown coat names in settings fall back to the defaults instead of crashing the renderer.
function look() {
  const c = settings.get().coat;
  return { coat: sprites.coats[c.preset] ? c.preset : 'calico_tabby', eyes: sprites.eyes[c.eyes] ? c.eyes : 'yellow_green' };
}

// Always pass the size too: on mixed-DPI setups Electron can otherwise grow the window when it crosses monitors.
function moveTo(x, y) {
  catWin.setBounds({ x, y, ...size() });
}

const perching = () => tracker.available && settings.get().perchOnWindows;

// The surface under her (perching), in window-position space: y puts her feet on it, x0..x1 keeps her centre
// on it. Her sitting body's bottom is her feet; every pose shares that line.
function groundUnder(pos) {
  const f = catRect('idle_sit');
  const cx = f.x + f.width / 2;
  const g = groundAt(pos.x + cx, pos.y + f.y + f.height, surfs, workAreas());
  return { id: g.id, y: g.y - f.y - f.height, x0: g.x0 - cx, x1: g.x1 - cx };
}

// Polls the other windows while perching or fullscreen hiding is on: every 250 ms, 50 ms while she rides a
// moving window. Hides her while the foreground app fills her display, and carries her along when the window
// she stands on moves.
function watchWindows() {
  if (!catWin) return;
  const s = settings.get();
  let next = s.perchOnWindows || s.hideInFullscreen ? 250 : 1000;
  const fg = s.hideInFullscreen && tracker.foreground();
  const full = fg && coveredDisplay(fg.rect, [screen.getDisplayMatching(catWin.getBounds()).bounds]);
  if (full && !hiddenForFullscreen && catWin.isVisible()) {
    hiddenForFullscreen = true;
    catWin.hide();
  } else if (!full && hiddenForFullscreen) {
    hiddenForFullscreen = false;
    catWin.showInactive();
  }
  if (!s.perchOnWindows) {
    surfs = [];
    perched = null;
    return setTimeout(watchWindows, next);
  }
  const wins = tracker.list();
  const f = catRect('idle_sit');
  surfs = surfaces(wins, workAreas(), f.height, f.width);
  const w = perched && wins.find((x) => x.id === perched.id);
  if (w && !dragTimer && (w.rect.x !== perched.x || w.rect.y !== perched.y)) {
    const b = catWin.getBounds();
    const p = clampPosition({ x: b.x + w.rect.x - perched.x, y: b.y + w.rect.y - perched.y }, catRect(), workAreas());
    moveTo(p.x, p.y);
    settings.set({ position: p });
    next = 50;
  }
  const pos = catWin.getBounds();
  const g = groundUnder(pos);
  const on = g.id !== null && Math.abs(g.y - pos.y) <= 2 && wins.find((x) => x.id === g.id);
  perched = on ? { id: on.id, x: on.rect.x, y: on.rect.y } : null;
  setTimeout(watchWindows, next);
}

function settle() {
  if (!catWin) return;
  const p = clampPosition(catWin.getBounds(), catRect(), workAreas());
  moveTo(p.x, p.y);
  settings.set({ position: p });
}

function createCatWindow() {
  const s = settings.get();
  const start = s.position.x === null ? defaultPosition(size(), screen.getPrimaryDisplay().workArea) : s.position;
  const pos = clampPosition(start, catRect(), workAreas());
  catWin = new BrowserWindow({
    ...pos,
    ...size(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: s.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: webPreferences(path.join(__dirname, '../preload/preload.js')),
  });
  moveTo(pos.x, pos.y); // second step for mixed DPI, see LILY_PLAN section 8
  // Start click-through; the renderer turns mouse input on only over opaque pixels.
  catWin.setIgnoreMouseEvents(true, { forward: true });
  catWin.loadFile(path.join(__dirname, '../renderer/index.html'));
  catWin.on('closed', () => { catWin = null; });
  for (const ev of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(ev, settle);
  if (tracker.available) watchWindows();
  return catWin;
}

// New coat, eyes or size from the menu: the window keeps her feet where they were, then reloads in the new look.
function setLook(next) {
  const s = settings.get();
  const coat = { preset: sprites.coats[next.coat] ? next.coat : s.coat.preset, eyes: sprites.eyes[next.eyes] ? next.eyes : s.coat.eyes };
  const scale = [2, 3, 4].includes(next.scale) ? next.scale : s.scale;
  if (coat.preset === s.coat.preset && coat.eyes === s.coat.eyes && scale === s.scale) return;
  const old = size();
  settings.set({ coat, scale });
  if (!catWin) return;
  const b = catWin.getBounds();
  const n = size();
  const p = clampPosition({ x: b.x + Math.round((old.width - n.width) / 2), y: b.y + old.height - n.height }, catRect(), workAreas());
  moveTo(p.x, p.y);
  settings.set({ position: p });
  catWin.reload();
}

ipcMain.handle('cat-init', (e) => {
  if (!fromCat(e)) return null;
  const s = settings.get();
  return { sprites, look: look(), scale: s.scale, bubbleRoom: BUBBLE_ROOM, followMode: s.followMode };
});

// Midpoint between her eyes in the sitting poses, in sprite px (eyes_open at 15,15 is 16x6).
const EYES = { x: 23, y: 17.5 };

// What the behavior loop needs each tick, in window-position space: where she is, where she may go, and the
// cursor shifted so that "window at cursor" puts her eyes on it (a fixed point, so poses don't jitter).
// Plus the user's activity: typing level, work-time mood, and whether they are away.
ipcMain.handle('cat-world', (e) => {
  if (!fromCat(e)) return null;
  const pos = catWin.getBounds();
  const c = catRect();
  const s = settings.get().scale;
  const p = screen.getCursorScreenPoint();
  let range = positionRange(c, nearestArea(pos, c, workAreas()));
  let ground = null; // perching: the window y that puts her feet on the surface below; she walks only along it
  if (perching()) {
    const g = groundUnder(pos);
    ground = Math.min(g.y, range.y1); // the typing keys reach 1px below her feet: the taskbar clamp wins
    range = { x0: Math.max(range.x0, g.x0), x1: Math.min(range.x1, g.x1), y0: ground, y1: ground };
  }
  return {
    pos: { x: pos.x, y: pos.y },
    cursor: { x: p.x - EYES.x * s, y: p.y - (BUBBLE_ROOM + EYES.y) * s },
    range,
    ground,
    typing: typingLevel(input.recent(), Date.now()),
    presses: input.count(),
    mood: idle.mood(),
    speed: MOOD_SPEED[idle.mood()],
    away: idle.away(),
    tag: timers.tag(), // countdown over her head
    quiet: timers.quiet(), // Focus Mode work phase
    reduceMotion: settings.get().reduceMotion,
  };
});

ipcMain.on('cat-move', (e, to) => {
  const x = Number(to && to.x);
  const y = Number(to && to.y);
  if (!fromCat(e) || dragTimer || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const p = clampPosition({ x, y }, catRect(), workAreas());
  moveTo(p.x, p.y);
  settings.set({ position: p });
});

// A wider pose at the edge (walk, loaf, flop) gets nudged back on screen.
ipcMain.on('cat-pose', (e, name) => {
  if (!fromCat(e) || !Object.hasOwn(bodies, name)) return;
  pose = name;
  if (!dragTimer) settle();
});

function setFollowMode(mode) {
  settings.set({ followMode: mode });
  if (catWin) catWin.webContents.send('follow-mode', mode);
}

ipcMain.on('set-ignore-mouse', (e, ignore) => {
  if (fromCat(e)) catWin.setIgnoreMouseEvents(ignore === true, { forward: true });
});

// The window follows the cursor from main, so fast drags never outrun the renderer's mouse events.
ipcMain.on('drag-start', (e, offset) => {
  const ox = Number(offset && offset.x);
  const oy = Number(offset && offset.y);
  if (!fromCat(e) || !Number.isFinite(ox) || !Number.isFinite(oy)) return;
  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    const to = clampPosition({ x: p.x - ox, y: p.y - oy }, catRect(), workAreas());
    moveTo(to.x, to.y);
  }, 16);
});

ipcMain.on('drag-end', (e) => {
  if (!fromCat(e)) return;
  clearInterval(dragTimer);
  dragTimer = null;
  settle();
});

module.exports = { createCatWindow, cat: () => catWin, fromCat, sprites, look, setLook, setFollowMode };
