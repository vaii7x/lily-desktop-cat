// Adds and removes Lily's entries in a Claude Code settings object (~/.claude/settings.json). Pure, so it can be
// unit-tested. Only handlers whose command posts to 127.0.0.1:<port>/event/... count as ours; nothing else is touched.
const EVENTS = { Stop: 'stop', Notification: 'notification' };
const OURS = /127\.0\.0\.1:\d+\/event\/(stop|notification)\b/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// curl.exe, not curl: in Windows PowerShell `curl` is Invoke-WebRequest. Git Bash runs the same line. No body is
// sent, -m 1 caps the wait, `exit 0` means Claude Code never sees a failure when Lily isn't running, and async
// (set in addHook) keeps Claude from waiting on it at all.
const command = (port, kind) => `curl.exe -s -o NUL -m 1 -X POST http://127.0.0.1:${port}/event/${kind}; exit 0`;

const isOurs = (h) => isObj(h) && typeof h.command === 'string' && OURS.test(h.command);

// Throws on a shape we don't understand, so the caller leaves the file alone.
function check(cfg) {
  if (!isObj(cfg)) throw new Error('settings.json is not a JSON object');
  if (cfg.hooks === undefined) return;
  if (!isObj(cfg.hooks)) throw new Error('"hooks" in settings.json is not an object');
  for (const ev of Object.keys(EVENTS)) {
    if (cfg.hooks[ev] !== undefined && !Array.isArray(cfg.hooks[ev])) throw new Error(`"hooks.${ev}" is not a list`);
  }
}

// A copy without our handlers; groups and lists that only held ours go too.
function removeHook(cfg) {
  check(cfg);
  const out = structuredClone(cfg);
  if (!out.hooks) return out;
  for (const ev of Object.keys(EVENTS)) {
    const groups = out.hooks[ev];
    if (!groups) continue;
    out.hooks[ev] = groups.flatMap((g) => {
      if (!isObj(g) || !Array.isArray(g.hooks) || !g.hooks.some(isOurs)) return [g];
      const rest = g.hooks.filter((h) => !isOurs(h));
      return rest.length ? [{ ...g, hooks: rest }] : [];
    });
    if (!out.hooks[ev].length && groups.length) delete out.hooks[ev];
  }
  if (!Object.keys(out.hooks).length && Object.keys(cfg.hooks).length) delete out.hooks;
  return out;
}

// A copy with exactly one Stop and one Notification entry of ours (an older one on another port is replaced).
function addHook(cfg, port) {
  const out = removeHook(cfg);
  out.hooks = out.hooks || {};
  for (const [ev, kind] of Object.entries(EVENTS)) {
    out.hooks[ev] = [...(out.hooks[ev] || []), { hooks: [{ type: 'command', command: command(port, kind), timeout: 5, async: true }] }];
  }
  return out;
}

module.exports = { addHook, removeHook, command };
