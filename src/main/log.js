// Local log: our own warnings and errors (and crashes) go to userData/logs/lily.log as well as the console.
// It never leaves the PC, and nothing that writes to it ever passes key identity (input.js only counts presses).
// At 512 KB the file moves to lily.old.log, so at most two files (~1 MB) are kept.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 512 * 1024;
let file = null;

function write(level, args) {
  if (!file) return;
  const text = args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, file.replace(/\.log$/, '.old.log'));
    fs.appendFileSync(file, `${new Date().toISOString()} ${level} ${text}\n`);
  } catch { /* logging must never take the app down */ }
}

function start() {
  const dir = path.join(app.getPath('userData'), 'logs');
  try {
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'lily.log');
  } catch { return; }
  for (const level of ['warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      orig(...args);
      write(level, args);
    };
  }
  process.on('uncaughtException', (err) => console.error('uncaught:', err));
  process.on('unhandledRejection', (err) => console.error('unhandled rejection:', err));
  app.on('render-process-gone', (_e, _wc, d) => console.error('renderer gone:', d.reason));
  write('info', [`Lily ${app.getVersion()} started`]);
}

module.exports = { start };
