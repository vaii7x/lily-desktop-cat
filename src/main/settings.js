// Settings store: JSON in userData, migrated on load, debounced atomic writes.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../shared/settingsSchema');

let current = null;
let timer = null;
const file = () => path.join(app.getPath('userData'), 'settings.json');

function load() {
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn('settings unreadable, using defaults:', e.message);
      try { fs.renameSync(file(), `${file()}.bad`); } catch { /* keep going with defaults */ }
    }
  }
  current = migrate(raw);
  return current;
}

const get = () => current;

function set(patch) {
  Object.assign(current, patch);
  clearTimeout(timer);
  timer = setTimeout(flush, 500);
}

function flush() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  try {
    const tmp = `${file()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(current, null, 2));
    fs.renameSync(tmp, file());
  } catch (e) {
    console.warn('settings not saved:', e.message);
  }
}

module.exports = { load, get, set, flush };
