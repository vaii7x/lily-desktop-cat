// Optional Claude Code hook: when on, Lily runs the localhost server and has entries in ~/.claude/settings.json
// that ping it on Stop and Notification. That file is backed up before every change, other hooks are never
// touched, and an unreadable file is left alone (the error shows in the menu).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const settings = require('./settings');
const server = require('./hookServer');
const { addHook, removeHook } = require('../shared/hookConfig');

const FILE = path.join(os.homedir(), '.claude', 'settings.json');
let send = () => {};
let error = '';

function editClaudeSettings(change) {
  let text = null;
  try {
    text = fs.readFileSync(FILE, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const cfg = text && text.trim() ? JSON.parse(text.replace(/^﻿/, '')) : {};
  const next = change(cfg);
  if (JSON.stringify(next) === JSON.stringify(cfg)) return;
  // shortcut: one backup per change and none are ever deleted; prune if they pile up.
  if (text !== null) fs.copyFileSync(FILE, `${FILE}.lily-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.lily-tmp`, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(`${FILE}.lily-tmp`, FILE);
}

// The port is taken: say so, and switch the feature off so Claude Code stops pinging someone else's server.
function portBusy(err) {
  const port = settings.get().claudeHook.port;
  console.warn(`[lily] hook port ${port} unavailable:`, err.message);
  setEnabled(false);
  error = `port ${port} is busy, hook turned off`;
  // shortcut: at startup her window may still be loading, so the bubble waits 3 s; fine unless loading gets slower.
  setTimeout(() => send({ type: 'say', text: 'hook port busy' }), 3000);
}

function setEnabled(on) {
  const hook = settings.get().claudeHook;
  error = '';
  try {
    editClaudeSettings((cfg) => (on ? addHook(cfg, hook.port) : removeHook(cfg)));
  } catch (e) {
    error = `couldn't edit ~/.claude/settings.json: ${e.message}`;
    if (on) return; // nothing changed; stay off
  }
  settings.set({ claudeHook: { ...hook, enabled: on } });
  if (on) server.start(hook.port, (kind) => send({ type: 'claude', kind }), portBusy);
  else server.stop();
}

function start(sender) {
  send = sender;
  const hook = settings.get().claudeHook;
  if (hook.enabled) server.start(hook.port, (kind) => send({ type: 'claude', kind }), portBusy);
}

const status = () => ({ enabled: settings.get().claudeHook.enabled, error });

module.exports = { start, setEnabled, status, stop: server.stop };
