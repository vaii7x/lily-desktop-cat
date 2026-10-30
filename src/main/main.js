const { app } = require('electron');
require('./log').start(); // first, so warnings from loading the native modules below land in the log too
const settings = require('./settings');
const windows = require('./windows');
const { createTray } = require('./tray');
const input = require('./input');
const idle = require('./idle');
const timers = require('./timers');
const menu = require('./menu');
const claudeHook = require('./claudeHook');
const audioMeter = require('./audioMeter');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = windows.cat();
    if (win) win.showInactive();
  });
  app.whenReady().then(() => {
    settings.load();
    windows.createCatWindow();
    createTray(windows.sprites, windows.look(), windows.cat, menu.open);
    input.start();
    const toCat = (ev) => {
      const win = windows.cat();
      if (win) win.webContents.send('activity', ev);
    };
    idle.start(toCat, timers.quiet);
    timers.start(toCat, idle.away);
    claudeHook.start(toCat);
    audioMeter.start();
  });
}

// Deny new windows and navigation away from our own files.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (e) => e.preventDefault());
});

app.on('before-quit', settings.flush);
app.on('will-quit', () => {
  input.stop();
  claudeHook.stop();
});
app.on('window-all-closed', () => app.quit());
