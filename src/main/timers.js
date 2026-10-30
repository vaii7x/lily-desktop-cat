// Countdown timer, Pomodoro focus and reminders. Pure rules in src/shared/scheduler.js; state lives in settings,
// so all of it survives a restart. Sends {type: 'timer-done'}, {type: 'focus', phase}, {type: 'reminder', kinds, text}.
const crypto = require('node:crypto');
const settings = require('./settings');
const S = require('../shared/scheduler');

let send = () => {};
let isAway = () => false;

function poll() {
  const now = Date.now();
  const s = settings.get();
  // Away when it ends: she tells you once you're back, like the reminders.
  if (S.timerDone(s.timer, now) && !isAway()) {
    settings.set({ timer: S.NO_TIMER });
    send({ type: 'timer-done' });
  }
  const f = S.advanceFocus(s.focusRun, s.focus, now);
  if (f.changed) {
    settings.set({ focusRun: f.run });
    send({ type: 'focus', phase: f.run.phase });
  }
  const r = S.dueReminders(s.reminders, now, isAway());
  if (r.fired.length) {
    settings.set({ reminders: r.list });
    const kinds = [...new Set(r.fired.map((x) => x.kind))];
    send({ type: 'reminder', kinds, text: r.fired.length === 1 ? r.fired[0].text : 'reminders!' });
  }
}

function start(sender, away) {
  send = sender;
  isAway = away;
  setInterval(poll, 1000);
}

// For the countdown over her head and the menu.
function status(now = Date.now()) {
  const s = settings.get();
  const left = S.timerLeft(s.timer, now);
  const run = s.focusRun;
  return {
    timer: left === null ? null : { left: S.fmtLeft(left), paused: s.timer.endsAt === null },
    focus: run.phase ? { phase: run.phase, left: S.fmtLeft(run.endsAt - now), cycle: run.cycle } : null,
  };
}

// A short tag above her head: the timer if one is set, else the focus phase.
function tag() {
  const st = status();
  if (st.timer) return st.timer.paused ? `${st.timer.left} ||` : st.timer.left;
  if (st.focus) return `${st.focus.phase === 'work' ? 'focus' : 'break'} ${st.focus.left}`;
  return null;
}

// Focus work phases: she sits quiet, no nudges, no meows.
const quiet = () => settings.get().focusRun.phase === 'work';

// Menu actions; arguments come from the menu window and are checked here.
const actions = {
  timerStart(min) {
    const m = S.intIn(min, 1, 600);
    if (m) settings.set({ timer: S.startTimer(m, Date.now()) });
  },
  timerPause: () => settings.set({ timer: S.pauseTimer(settings.get().timer, Date.now()) }),
  timerResume: () => settings.set({ timer: S.resumeTimer(settings.get().timer, Date.now()) }),
  timerCancel: () => settings.set({ timer: S.NO_TIMER }),
  reminderAdd(raw) {
    const r = S.makeReminder(raw, Date.now(), crypto.randomUUID());
    if (r) settings.set({ reminders: [...settings.get().reminders, r] });
  },
  reminderDelete: (id) => settings.set({ reminders: settings.get().reminders.filter((r) => r.id !== id) }),
  focusStart(raw) {
    const focus = S.focusConfig(raw, settings.get().focus);
    settings.set({ focus, focusRun: S.startFocus(focus, Date.now()) });
    send({ type: 'focus', phase: 'work' });
  },
  focusStop: () => settings.set({ focusRun: S.NO_FOCUS }),
};

module.exports = { start, status, tag, quiet, actions };
