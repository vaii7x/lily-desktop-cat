// The menu window beside the cat (double-click or right-click her): follow mode, timer, reminders, focus, look,
// settings, hide and quit. It closes on blur or Esc and resizes to its content, always inside her display.
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');
const settings = require('./settings');
const windows = require('./windows');
const timers = require('./timers');
const idle = require('./idle');
const tray = require('./tray');
const claudeHook = require('./claudeHook');
const tracker = require('./winTracker');
const audioMeter = require('./audioMeter');
const { besidePosition } = require('../shared/placement');
const { intIn } = require('../shared/scheduler');

const WIDTH = 240;
let menuWin = null;
const fromMenu = (e) => menuWin && e.sender === menuWin.webContents;

function place(height) {
  const anchor = windows.cat().getBounds();
  const popup = { width: WIDTH, height: Math.min(height, screen.getDisplayMatching(anchor).workArea.height) };
  menuWin.setBounds({ ...besidePosition(anchor, popup, screen.getDisplayMatching(anchor).workArea), ...popup });
}

function open() {
  if (menuWin) return menuWin.focus();
  if (!windows.cat()) return;
  menuWin = new BrowserWindow({
    width: WIDTH,
    height: 200,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#fbf7f0',
    webPreferences: { preload: path.join(__dirname, '../preload/menuPreload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  place(200);
  menuWin.loadFile(path.join(__dirname, '../renderer/menu/menu.html'));
  menuWin.on('blur', () => menuWin && menuWin.close());
  menuWin.on('closed', () => { menuWin = null; });
}

function state() {
  const s = settings.get();
  const live = timers.status();
  return {
    timer: live.timer, focusLive: live.focus, mood: idle.mood(),
    followMode: s.followMode, coat: s.coat, scale: s.scale, alwaysOnTop: s.alwaysOnTop, startWithWindows: s.startWithWindows,
    thresholds: s.thresholds, focus: s.focus, reminders: s.reminders, claudeHook: claudeHook.status(),
    perchOnWindows: s.perchOnWindows, hideInFullscreen: s.hideInFullscreen, reduceMotion: s.reduceMotion, tracking: tracker.available,
    musicReactions: s.musicReactions, audio: audioMeter.available,
    // swatch colours: fur, patch and white for coats; the iris for eyes
    coats: Object.fromEntries(Object.entries(windows.sprites.coats).map(([k, c]) => [k, [c.B, c.P, c.W]])),
    eyes: windows.sprites.eyes,
  };
}

// In development Windows has to start electron.exe with the app folder; the packaged app is its own exe.
function setStartWithWindows(on) {
  const opts = { openAtLogin: on };
  if (!app.isPackaged) Object.assign(opts, { path: process.execPath, args: [app.getAppPath()] });
  // The portable exe runs from a temp copy: register the real file the user keeps.
  else if (process.env.PORTABLE_EXECUTABLE_FILE) opts.path = process.env.PORTABLE_EXECUTABLE_FILE;
  app.setLoginItemSettings(opts);
  settings.set({ startWithWindows: on });
}

function setThresholds(raw) {
  const t = { hopAwayMin: intIn(raw && raw.hopAwayMin, 1, 600), breakAwayMin: intIn(raw && raw.breakAwayMin, 1, 600),
    zoomiesAwayMin: intIn(raw && raw.zoomiesAwayMin, 1, 600) };
  if (t.hopAwayMin && t.hopAwayMin < t.breakAwayMin && t.breakAwayMin < t.zoomiesAwayMin) settings.set({ thresholds: t });
}

const actions = {
  ...timers.actions,
  follow: (mode) => ['stay', 'follow', 'roam'].includes(mode) && windows.setFollowMode(mode),
  look(raw) {
    windows.setLook({ coat: raw && raw.coat, eyes: raw && raw.eyes, scale: Number(raw && raw.scale) });
    tray.setIcon(windows.sprites, windows.look());
  },
  alwaysOnTop(on) {
    settings.set({ alwaysOnTop: on === true });
    windows.cat().setAlwaysOnTop(on === true);
  },
  startWithWindows: (on) => setStartWithWindows(on === true),
  thresholds: setThresholds,
  claudeHook: (on) => claudeHook.setEnabled(on === true),
  perchOnWindows: (on) => settings.set({ perchOnWindows: on === true }),
  hideInFullscreen: (on) => settings.set({ hideInFullscreen: on === true }),
  reduceMotion: (on) => settings.set({ reduceMotion: on === true }),
  musicReactions: (on) => settings.set({ musicReactions: on === true }),
  hide() {
    windows.cat().hide();
    menuWin.close();
  },
  quit: () => app.quit(),
};

ipcMain.on('open-menu', (e) => {
  if (windows.fromCat(e)) open();
});

ipcMain.handle('menu-state', (e) => (fromMenu(e) ? state() : null));

ipcMain.handle('menu-do', (e, name, arg) => {
  if (!fromMenu(e) || !Object.hasOwn(actions, name)) return null;
  actions[name](arg);
  return menuWin ? state() : null;
});

// The page reports its height; the first report also shows the window, so it never flashes at the wrong size.
ipcMain.on('menu-resize', (e, h) => {
  const height = intIn(Math.ceil(Number(h)), 60, 2000);
  if (!fromMenu(e) || !height) return;
  place(height);
  if (!menuWin.isVisible()) menuWin.show();
});

module.exports = { open };
