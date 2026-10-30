// Menu page: fills the form from main's state once, refreshes the live parts (countdowns, reminder list) every
// second, and sends each change straight to main, which checks and saves it.
(async function () {
  'use strict';
  const api = window.lilyMenu;
  const $ = (id) => document.getElementById(id);
  const radios = (name) => [...document.querySelectorAll(`input[name="${name}"]`)];
  const checked = (name) => (radios(name).find((r) => r.checked) || {}).value;
  const NAMES = { calico_tabby: 'Calico tabby', ragdoll_seal: 'Ragdoll', orange_tabby: 'Orange tabby', black: 'Black', grey: 'Grey',
    white: 'White', yellow_green: 'Yellow-green', blue: 'Blue', amber: 'Amber', green: 'Green' };
  const KIND = { stretch: 'Stretch', water: 'Water', eyes: 'Eyes', custom: '' };
  const PHASE = { work: 'Working. She keeps quiet.', short: 'Break time! Stand up and stretch.', long: 'Long break. Go get a snack.' };
  const PRESETS = { 25: 5, 50: 10, 90: 20 }; // work min: break min; every 4th break is 3x as long

  let state = await api.state();
  let remKey = '';

  const act = async (name, arg) => {
    const next = await api.act(name, arg);
    if (next) {
      state = next;
      live();
    }
  };

  function swatch(group, name, value, colors) {
    const label = document.createElement('label');
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: group, value: name });
    input.setAttribute('aria-label', NAMES[name] || name);
    label.title = NAMES[name] || name;
    const span = document.createElement('span');
    span.style.background = colors.length > 1 ? `linear-gradient(90deg, ${colors[0]} 50%, ${colors[1]} 50% 80%, ${colors[2]} 80%)` : colors[0];
    input.checked = name === value;
    label.append(input, span);
    return label;
  }

  // Minute picker: a scroll-snapped column of lo..hi. The wheel, arrow keys or a click move it one step.
  function wheel(el, lo, hi, start) {
    const H = 22; // row height, matches menu.css
    let cur = start;
    const rows = [];
    for (let v = lo; v <= hi; v++) {
      const d = Object.assign(document.createElement('div'), { textContent: v });
      d.addEventListener('click', () => set(v));
      rows.push(d);
    }
    el.replaceChildren(...rows);
    el.tabIndex = 0;
    el.setAttribute('role', 'spinbutton');
    el.setAttribute('aria-valuemin', lo);
    el.setAttribute('aria-valuemax', hi);
    function mark() {
      rows.forEach((d, i) => d.classList.toggle('on', i === cur - lo));
      el.setAttribute('aria-valuenow', cur);
    }
    function set(v, behavior = 'smooth') {
      cur = Math.min(hi, Math.max(lo, v));
      el.scrollTo({ top: (cur - lo) * H, behavior });
      mark();
    }
    el.addEventListener('scroll', () => {
      const v = lo + Math.round(el.scrollTop / H);
      if (el.offsetParent && v !== cur) {
        cur = v;
        mark();
      }
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      set(cur + Math.sign(e.deltaY));
    }, { passive: false });
    el.addEventListener('keydown', (e) => {
      const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 }[e.key];
      if (step) {
        e.preventDefault();
        set(cur + step);
      }
    });
    mark();
    // A hidden column can't scroll: line it up again whenever it shows.
    return { get value() { return cur; }, sync: () => set(cur, 'instant') };
  }
  const timerWheel = wheel($('timerWheel'), 1, 180, 15);
  const remWheel = wheel($('remWheel'), 1, 240, 30);
  for (const d of document.querySelectorAll('details')) d.addEventListener('toggle', () => { timerWheel.sync(); remWheel.sync(); });

  // Form values: only once, so a refresh never overwrites what the user is typing.
  function fill() {
    for (const r of radios('follow')) r.checked = r.value === state.followMode;
    for (const r of radios('scale')) r.checked = Number(r.value) === state.scale;
    $('coats').replaceChildren(...Object.entries(state.coats).map(([k, c]) => swatch('coat', k, state.coat.preset, c)));
    $('eyes').replaceChildren(...Object.entries(state.eyes).map(([k, c]) => swatch('eye', k, state.coat.eyes, [c])));
    const preset = PRESETS[state.focus.workMin] ? state.focus.workMin : 25;
    for (const r of radios('focusPreset')) r.checked = Number(r.value) === preset;
    for (const k of Object.keys(state.thresholds)) $(k).value = state.thresholds[k];
    $('startWithWindows').checked = state.startWithWindows;
    $('alwaysOnTop').checked = state.alwaysOnTop;
    $('reduceMotion').checked = state.reduceMotion;
    for (const k of ['perchOnWindows', 'hideInFullscreen']) {
      $(k).checked = state[k];
      $(k).disabled = !state.tracking;
    }
    $('trackMsg').textContent = state.tracking ? '' : 'window tracking unavailable';
  }

  function reminderList() {
    const key = JSON.stringify(state.reminders.map((r) => [r.id, r.nextAt]));
    if (key === remKey) return;
    remKey = key;
    $('remList').replaceChildren(...state.reminders.map((r) => {
      const li = document.createElement('li');
      const text = Object.assign(document.createElement('span'), { textContent: r.kind === 'custom' ? r.text : KIND[r.kind] });
      const when = Object.assign(document.createElement('small'), { textContent: r.repeat ? `every ${r.everyMin}m` : `once, ${r.everyMin}m` });
      const del = Object.assign(document.createElement('button'), { textContent: 'x', title: 'Delete' });
      del.setAttribute('aria-label', `Delete reminder ${text.textContent}`);
      del.addEventListener('click', () => act('reminderDelete', r.id));
      li.append(text, when, del);
      return li;
    }));
    $('remTag').textContent = state.reminders.length ? String(state.reminders.length) : '';
  }

  // Countdowns and lists that change on their own.
  function live() {
    const t = state.timer;
    if ($('timerOff').hidden && !t) requestAnimationFrame(timerWheel.sync);
    $('timerOff').hidden = !!t;
    $('timerOn').hidden = !t;
    $('timerTag').textContent = t ? (t.paused ? `${t.left} paused` : t.left) : '';
    if (t) {
      $('timerLeft').textContent = t.left;
      $('timerPause').textContent = t.paused ? 'Resume' : 'Pause';
    }
    renderFocus();
    reminderList();
    $('claudeHook').checked = state.claudeHook.enabled;
    $('hookMsg').textContent = state.claudeHook.error || (state.claudeHook.enabled ? 'she cheers when Claude finishes' : '');
    $('status').textContent = `mood: ${state.mood}`;
  }

  function renderFocus() {
    const f = state.focusLive;
    $('focusTag').textContent = f ? f.left : '';
    $('focusOff').hidden = !!f;
    $('focusOn').hidden = !f;
    if (!f) return;
    $('focusPhase').textContent = PHASE[f.phase];
    $('focusLeft').textContent = f.left;
    $('focusCount').textContent = f.cycle ? `${f.cycle} work session${f.cycle > 1 ? 's' : ''} done` : '';
  }

  for (const r of radios('follow')) r.addEventListener('change', () => act('follow', r.value));
  $('timerOff').addEventListener('submit', (e) => {
    e.preventDefault();
    act('timerStart', timerWheel.value);
  });
  $('timerPause').addEventListener('click', () => act(state.timer && state.timer.paused ? 'timerResume' : 'timerPause'));
  $('timerCancel').addEventListener('click', () => act('timerCancel'));

  $('remForm').addEventListener('submit', (e) => {
    e.preventDefault();
    act('reminderAdd', { kind: 'custom', text: $('remText').value, repeat: checked('remRepeat') === 'repeat', min: remWheel.value });
    $('remText').value = '';
  });

  $('focusStart').addEventListener('click', () => {
    const work = Number(checked('focusPreset'));
    const rest = PRESETS[work];
    act('focusStart', { workMin: work, shortBreakMin: rest, longBreakMin: rest * 3, cyclesBeforeLong: 4 });
  });
  $('focusStop').addEventListener('click', () => act('focusStop'));

  const look = () => act('look', { coat: checked('coat'), eyes: checked('eye'), scale: Number(checked('scale')) });
  $('look').addEventListener('change', look);

  $('startWithWindows').addEventListener('change', (e) => act('startWithWindows', e.target.checked));
  $('alwaysOnTop').addEventListener('change', (e) => act('alwaysOnTop', e.target.checked));
  $('reduceMotion').addEventListener('change', (e) => act('reduceMotion', e.target.checked));
  $('perchOnWindows').addEventListener('change', (e) => act('perchOnWindows', e.target.checked));
  $('hideInFullscreen').addEventListener('change', (e) => act('hideInFullscreen', e.target.checked));
  $('claudeHook').addEventListener('change', (e) => act('claudeHook', e.target.checked));
  $('thrForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const want = Object.fromEntries(Object.keys(state.thresholds).map((k) => [k, Number($(k).value)]));
    await act('thresholds', want);
    const ok = Object.keys(want).every((k) => state.thresholds[k] === want[k]);
    $('thrMsg').textContent = ok ? 'saved' : 'needs hop < break < zoomies';
  });

  $('hide').addEventListener('click', () => act('hide'));
  $('quit').addEventListener('click', () => act('quit'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });

  // The window follows the page's height (main keeps it on her display).
  new ResizeObserver(() => api.resize(document.body.getBoundingClientRect().height)).observe(document.body);

  fill();
  live();
  document.querySelector('summary').focus();
  setInterval(async () => {
    state = await api.state();
    live();
  }, 1000);
})();
