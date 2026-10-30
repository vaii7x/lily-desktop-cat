const test = require('node:test');
const assert = require('node:assert');
const { addHook, removeHook, command } = require('../src/shared/hookConfig');
const { migrate } = require('../src/shared/settingsSchema');

const other = { matcher: '', hooks: [{ type: 'command', command: 'echo hi' }] };

test('add to an empty file, then remove leaves it empty', () => {
  const on = addHook({}, 47821);
  assert.deepStrictEqual(on.hooks.Stop, [{ hooks: [{ type: 'command', command: command(47821, 'stop'), timeout: 5, async: true }] }]);
  assert.match(on.hooks.Notification[0].hooks[0].command, /\/event\/notification; exit 0$/);
  assert.deepStrictEqual(removeHook(on), {});
});

test('other hooks and keys are kept, in order', () => {
  const cfg = { theme: 'dark', hooks: { Stop: [other], PreToolUse: [other] } };
  const on = addHook(cfg, 5000);
  assert.deepStrictEqual(on.hooks.Stop[0], other);
  assert.equal(on.hooks.Stop.length, 2);
  assert.deepStrictEqual(on.hooks.PreToolUse, [other]);
  assert.deepStrictEqual(removeHook(on), cfg);
  assert.deepStrictEqual(cfg.hooks.Stop, [other]); // input not mutated
});

test('only our handler leaves a shared group; re-adding on a new port replaces the old one', () => {
  const mixed = { hooks: { Stop: [{ hooks: [other.hooks[0], { type: 'command', command: command(1234, 'stop') }] }] } };
  assert.deepStrictEqual(removeHook(mixed), { hooks: { Stop: [{ hooks: [other.hooks[0]] }] } });
  const moved = addHook(addHook({}, 1234), 47821);
  assert.equal(moved.hooks.Stop.length, 1);
  assert.match(moved.hooks.Stop[0].hooks[0].command, /:47821\//);
});

test('empty lists we did not empty are left alone', () => {
  assert.deepStrictEqual(removeHook({ hooks: {} }), { hooks: {} });
  assert.deepStrictEqual(removeHook({ hooks: { Stop: [] } }), { hooks: { Stop: [] } });
});

test('unexpected shapes throw instead of being overwritten', () => {
  for (const bad of [null, [], 'x', { hooks: [] }, { hooks: 'x' }, { hooks: { Stop: {} } }]) {
    assert.throws(() => addHook(bad, 1));
    assert.throws(() => removeHook(bad));
  }
});

test('migrate: hook port must be a usable integer port', () => {
  assert.equal(migrate({ claudeHook: { enabled: true, port: 80 } }).claudeHook.port, 47821);
  assert.equal(migrate({ claudeHook: { enabled: true, port: 1.5 } }).claudeHook.port, 47821);
  assert.deepStrictEqual(migrate({ claudeHook: { enabled: true, port: 50000 } }).claudeHook, { enabled: true, port: 50000 });
});
