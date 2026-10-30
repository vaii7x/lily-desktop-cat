# LILY: a desktop pixel cat for Windows

> Read this file at the start of every session. Work on ONE phase at a time. Never start the next phase until the user confirms the current one.

## 0. How to work (rules for Claude Code)

1. **Session start:** read sections 1-4, the current phase in section 6, and the Progress Log (section 9). Do not read the other phases unless needed.
2. **One phase per run.** Finish its tasks, run its tests, then STOP at the phase gate: summarize what was built (max 15 lines), list the manual test steps for the user, and wait for confirmation. Tell the user to run `/compact` or start a new session before the next phase.
3. **Update section 9 (Progress Log)** at the end of every phase: tick the box, add 1-3 lines of notes (decisions, known issues, file locations). Commit with message `phase N: <summary>`.
4. **Keep files small and modular** (aim for under 300 lines). Put pure logic in `src/shared/` so it can be unit-tested with `node --test`. Use grep and targeted reads instead of reading the whole repo.
5. **No new dependencies** beyond section 3 without asking. Pin exact versions.
6. **Privacy rules (hard):** no telemetry; no network calls except the localhost hook server (Phase 6); the keyboard hook counts key presses only and must NEVER store, log, or transmit which keys were pressed.
7. **Originality:** all art, code, and behavior are original. Do not copy code or art from Comnyang, PixelPaw, pixelcat, Warple, or any other desktop-pet project. The idea of a transparent click-through overlay is generic and fine.
8. **Windows is the only target.** You may be running on Windows (the user's PC); if not, build and unit-test what you can, and give the user precise manual steps for anything window-related.
9. **If blocked or a decision is ambiguous:** ask ONE short question. Don't guess on visual style or user-facing behavior.
10. **Verify before relying on memory:** Electron, uiohook-napi, koffi, and Claude Code hook formats change. Check the current docs/package READMEs before using an API.

## 1. Product summary

**Lily** is a free, local, no-telemetry Windows desktop pet: a tiny pixel-art calico-tabby cat who lives on your screen, follows your cursor, reacts to your typing, reflects how long you've been working through her mood, and goes wild with happiness when you come back from a break. Double-click her for a menu with timers, reminders, and settings. She can also celebrate when Claude Code finishes a task.

Lily uses no AI at runtime and zero tokens. Everything is plain code.

## 2. Decisions already made (do not re-litigate)

- Name: **Lily**. Platform: **Windows 10/11 only** for v1.
- Stack: **Electron**, plain JavaScript (no TypeScript, no bundler), HTML5 Canvas renderer, `node:test` for tests.
- **Sound: none in v1.** All feedback is visual (animations, small icon bubbles, short text bubbles).
- **Free and open**; no accounts, no internet, settings stored locally.
- Art: **48x48 px** sprites, drawn as text grids, palette-swappable. Default coat is calico-tabby (section 4).
- Lily is **not fixed to any screen position**: draggable anywhere, any monitor, position remembered.
- Interactions: single click = pet; click-hold-drag = pick up (she goes limp); double-click OR right-click = menu.
- Moods depend on continuous work time; returning from a break triggers a happy jumping burst scaled to how long you were away.
- v1 does NOT include: sound, Mac/Linux, multiple cats, skin-pack loader, weather/music reactions. (See Phase 9 for optional extras.)

## 3. Tech stack and architecture

**Dependencies (approved list):**
- `electron` (latest stable at scaffold time, pin exact), `electron-builder` (dev)
- `uiohook-napi`: global key-press counting. Must fail gracefully: if it doesn't load, typing reactions are disabled and the app continues.
- `koffi`: Win32 calls for window-edge perching and fullscreen detection (Phase 7). Must fail gracefully too.
- `pngjs` (dev): sprite preview images.
- Do NOT use `active-win` or `node-window-manager` (stale). Use `koffi` directly.

**Process layout:**
- **Main process:** windows, tray, settings store, input service, idle/power events, hook server, window tracker, autostart.
- **Renderer (cat window):** canvas, sprite player, state machine, particles, bubbles, hit-testing.
- **Menu window:** a separate small frameless window shown beside the cat; closes on blur or Esc.
- **Preload:** a narrow `contextBridge` API only. `contextIsolation: true`, `nodeIntegration: false`, strict CSP, no remote content.

**Folder structure:**
```
lily/
  LILY_PLAN.md   README.md   package.json
  reference/               (user's cat photos, see section 4)
  assets/palettes/*.json   assets/parts/*.txt   assets/frames/*.txt   assets/build/sprites.json
  tools/build-sprites.js   tools/preview-sprites.js
  src/main/    main.js windows.js tray.js settings.js input.js idle.js
               hookServer.js claudeHook.js winTracker.js autostart.js
  src/preload/ preload.js
  src/renderer/ index.html cat.js sprites.js animator.js behavior.js
               follow.js particles.js bubbles.js hitTest.js
  src/renderer/menu/ menu.html menu.js menu.css
  src/shared/  constants.js moodTiers.js awayTiers.js scheduler.js
               settingsSchema.js behaviorRules.js
  test/*.test.js
```

**Performance budget:** idle CPU under ~2%, memory under ~150 MB. Sprite animation at 8-12 fps. Logic tick 30 Hz while active, 2-5 Hz while asleep or hidden. Pause rendering when the window is hidden. Poll cursor only when follow mode needs it.

**Settings:** JSON in `app.getPath('userData')`, with `schemaVersion` and a migration function. Atomic write (temp file then rename), debounced. Defaults:
```json
{
  "schemaVersion": 1,
  "position": {"x": null, "y": null},
  "scale": 2,
  "followMode": "follow",
  "alwaysOnTop": true,
  "roam": true,
  "perchOnWindows": false,
  "hideInFullscreen": true,
  "coat": {"preset": "calico_tabby", "eyes": "yellow_green"},
  "startWithWindows": false,
  "thresholds": {"hopAwayMin": 2, "breakAwayMin": 5, "zoomiesAwayMin": 20},
  "mood": {"freshMaxMin": 30, "grooveMaxMin": 90, "tiredMaxMin": 120},
  "reminders": [],
  "focus": {"workMin": 25, "shortBreakMin": 5, "longBreakMin": 15, "cyclesBeforeLong": 4},
  "claudeHook": {"enabled": false, "port": 47821}
}
```

## 4. Lily's look and art spec

**Reference photos** (user's own cat, in `reference/`; look at them in Phase 1): `ref-1-belly-up-nap.jpg`, `ref-2-front-face.jpg`, `ref-3-sink-loaf.jpg`.
If the photos are missing, use this description: fluffy calico-tabby. Grey-brown tabby base with soft peach/orange patches (chest, cheeks, nose area). Tabby "M" stripes on the forehead. White muzzle, chin, chest bib, and mitten paws. Pink nose, long white whiskers. Big yellow-green eyes with slit pupils. Dark, bushy grey-black tail. Chunky chest ruff and fluffy cheeks.

**Style rules:**
- 48x48 frames, chunky pixels, 1px dark outline, limited palette (about 12 colors), cute proportions (big head, big eyes, rounded body).
- Draw **right-facing only**; flip horizontally at runtime for left.
- Eyes are the expressive part: wide (excited), half-lidded (tired/grumpy), squint (happy), closed (asleep).
- **Role-coded grids:** each character is a color role, recolored at draw time from a palette JSON. Roles: `.` transparent, `O` outline, `B` base fur, `S` tabby stripe, `P` peach patch, `W` white, `N` nose, `E` iris, `K` pupil, `H` eye shine, `I` inner ear, `T` tail dark, `M` whisker, `X` shadow.
- Palettes: `calico_tabby` (default), `ragdoll_seal`, `orange_tabby`, `black`, `grey`, `white`. Eye colors: `yellow_green`, `blue`, `amber`, `green`.
- Build animations from reusable parts (head variants, body, tail, paws) plus per-frame offsets where it saves effort. Fully hand-drawn frames are fine for special poses (belly-up, loaf).

**Animation set** (name: frames @ fps). The phase where each is needed is in brackets.
- `idle_sit` 4@4, tail sway and blink [1]
- `watch` 5 head-angle frames: left, right, up, down, center [1]
- `walk` 6@8 [1]
- `loaf_idle` 4@3, curled with face on paws [1]
- `nap_curled` 4@2 with zzz [1]
- ~~`nap_belly_up`~~ removed in Phase 3 (user request: no belly animations)
- `dragged_limp` 2@3, dangling and relaxed [1]
- `pet_purr` 4@6 with hearts [1]
- ~~`belly_flop`~~ removed in Phase 3 (user request). Added instead [3]: `groom` 4@4, `yawn` 6@5, `stretch` 8@4, `loaf_purr` 4@6, `curl_purr` 2@4, `watch` grown to 18 gaze frames
- `run` 4@12 and `happy_hop` 6@10 and `spin` 6@12 [3/4]
- `type_knead` and `type_fast_steam` 2 frames each (left paw presses / right paw presses), picked per real key press, not by fps; fast adds red tint, steam puffs and key shake at runtime [4]
- Typing keyboard (separate runtime layers, not in her frames): fx `keyboard` (30x8 case, three rows of keycaps with a space bar), `keyboard_l` / `keyboard_r` (the key under that paw sunk 1px), and `paw_key` (her paw standing on a key). Draw order: cat, keyboard, paws. Fixed greys (roles L/G/D) in every coat; positions in `KEYBOARD`/`PAWS` in `behaviorRules.js` [4]
- `yawn` 6@6, `slow_blink` 4@4, `idle_sit_droopy` 2@2 (tired), `loaf_grumpy` 2@2 (overworked) [4]
- `stretch_big` 8@6 (front stretch, then a back-leg stretch) for stretch reminders [5]
- Reminder icons fx `icon_water`, `icon_eyes`, `icon_stretch` (drawn inside the bubble; water uses fixed role `A`) [5]
- `alert` 2@4 (perked, "?" bubble), `celebrate` (reuse hop/spin + sparkles) [6]
- `fall` 2@6, `land` 2@6 [7]
- FX sprites: heart, zzz, steam puff, sparkle, "!", "?", small icons for water/eye/stretch [as needed]

## 5. Behavior spec (the contract Phases 3-5 implement)

**State priority (higher interrupts lower):**
1. dragged (limp)  2. celebration (welcome-back, timer end, Claude done)  3. reminder/mood nudge  4. pet reaction  5. typing reaction  6. mood idle behaviors  7. follow/roam.

**Follow modes** (menu setting):
- `follow`: walks toward the cursor, stops about 80 px away, sits and watches it.
- `stay`: never moves on her own; only her head/eyes track the cursor.
- `roam`: wanders randomly, rests, naps in corners; looks at the cursor but ignores it.
She moves in 2D on screen (flipped walk sprite for direction). No gravity or ground by default.

**Clicks:** a press that moves more than 4 px or is held over 150 ms is a drag (pick up, limp, moves with cursor, drop anywhere). A short click is a pet (purr + hearts, 2 s). Resting the cursor on (or within a few px of) her head for 0.5 s starts a continuous purr with hearts that lasts as long as the cursor stays on her (user request, Phase 2). Petting her while she lies down purrs in the same pose (`loaf_purr`, `curl_purr`). No belly-rub or 5-pet flop (removed at the user's request, Phase 3). A double-click (or right-click) opens the menu. Never confuse a drag with a click.

**Work timer and mood** (pure functions in `src/shared/`, unit-tested):
- The work session starts at the first activity after a break and resets after a break (away of `breakAwayMin` or more).
- Tiers by continuous work minutes: **Fresh** 0-30, **Groove** 30-90, **Tired** 90-120, **Overworked** 120+.
- Fresh: perky, follows eagerly (speed x1.0). Groove: calm, sits nearby, loaf idle (x0.9). Tired: droopy ears, yawns, slow (x0.7), nudges "take a break?" at 90 min then every 15 min. Overworked: sleepy and grumpy (x0.5), more insistent nudge every 10 min. Nudges are suppressed during Focus Mode work phases.

**Away and welcome-back** (idle time comes from Electron `powerMonitor.getSystemIdleTime()`; also handle lock, unlock, suspend, and resume):
- While away: after 2 min she curls up (`nap_curled`); (belly-up nap removed in Phase 3).
- On return, scaled by away duration A: **A under 2 min:** nothing. **2 min to under 5:** one small hop with hearts (no timer reset). **5 min to under 20 (a break):** 6-8 s of happy jumping; the work timer resets to Fresh. **20 min or more:** full zoomies (15-20 s of running around, jumping, spinning, hearts); the timer resets.
- All thresholds are configurable. Known limitation: someone watching a video with no input will look "away"; accept this for v1.

**Typing reactions** (needs the keyboard hook; counts only):
- Any typing within the last 1.5 s: `type_knead`. A sustained fast rate (default 8 or more keys per second over 2 s): `type_fast_steam` (red tint and steam).
- Mouse clicks and scrolling count as activity but do not trigger typing animations.

## 6. Phases

Each phase ends with a **GATE**: stop, summarize, give the manual test steps, and wait.

### Phase 0: Scaffold and transparency check
**Goal:** a working repo and proof that a transparent, click-through window works on the user's PC.
**Tasks:** `git init` and `.gitignore`. `package.json` with scripts `start`, `test` (`node --test`), `sprites:build`, `sprites:preview`, `dist`. Create the folder skeleton (section 3). Minimal Electron app: frameless, transparent, always-on-top, a 144x144 window showing a colored placeholder square on a transparent canvas, with `setIgnoreMouseEvents(true, {forward: true})` and hit-testing so only the square is clickable. Single-instance lock. Secure Electron defaults. One trivial passing test. README stub.
**Acceptance:** `npm install && npm start` shows the square floating over other windows. Clicks around the square pass through to apps beneath. The square can be clicked. `npm test` passes.
**GATE:** the user confirms transparency and click-through on their PC.

### Phase 1: Art pipeline and core sprites (STYLE GATE)
**Goal:** lock Lily's look before anything depends on it.
**Tasks:** palette JSON and the text-grid format. `tools/build-sprites.js` compiles grids and parts into `assets/build/sprites.json`. `tools/preview-sprites.js` writes a PNG contact sheet (6x scale, labeled, animation strips, plus the same cat in two palettes) to `preview/`. `src/renderer/sprites.js` renders any frame in any palette to cached offscreen canvases. Draw the Phase-1 animations from section 4 plus heart and zzz.
**Self-review loop:** after generating the preview, VIEW the PNG yourself, then fix proportions, outline, readability of the calico patches, and eye expressions. Repeat up to 4 rounds before showing the user.
**Acceptance:** the preview clearly reads as a calico-tabby cat in all 8 animations. Palette swap to `ragdoll_seal` works via recolor only. Build script has a basic test (grid dimensions, valid role characters).
**GATE:** the user approves the look. Apply their feedback; do not proceed until approved.

### Phase 2: Window shell and interaction basics
**Goal:** Lily exists on screen, can be moved anywhere, and the click types are distinguished.
**Tasks:** cat window sized from `scale` (sprite 48 x scale, plus room above for bubbles and timer). Render `idle_sit` using the sprite player. Alpha-based hit-testing: the window ignores mouse events except over opaque cat or bubble pixels (and always accepts them while dragging). Drag via IPC using screen coordinates; `dragged_limp` while held. Keep Lily fully inside a display's work area (user request; was: at least 40% visible). Handle display add/remove and mixed-DPI (use integer DIP bounds; test crossing monitors). Save and restore position. Tray icon with Show/Hide, Always on top toggle, Quit. Click vs drag vs double-click detection (section 5), with placeholder handlers: click triggers `pet_purr` with hearts; double-click and right-click open a temporary stub menu window beside her.
**Acceptance:** drag her anywhere on all monitors; position persists across restarts; clicks beside her reach other apps; click vs drag is never confused; tray works.
**Tests:** click/drag classifier (pure function), position clamping.
**GATE:** the user tests on their PC (multi-monitor if they have it).

### Phase 3: Behavior engine, following, roaming
**Goal:** Lily feels alive on her own.
**Tasks:** animator (per-animation fps, loop/one-shot, flip). Behavior state machine with the priority list (section 5). Follow modes: `follow`, `stay` (eye/head tracking via `watch`), `roam`. Random idle behavior scheduler (sit, loaf, blink, tail sway every 20-60 s). Walk movement with smooth speed, edge handling, facing flip. Pet reaction and `belly_flop` after 5 pets in 6 s (add `belly_flop` art). Particles module (hearts). Persist `followMode`.
**Acceptance:** each mode behaves as specified; she never walks off all displays; no jitter at rest; CPU within budget; behavior rules unit-tested (`behaviorRules.js`).
**GATE:** the user watches her for a few minutes and gives feel feedback (speed, distance, idle frequency).

### Phase 4: Activity, moods, typing, welcome-back
**Goal:** the signature features.
**Tasks:** `input.js` using `uiohook-napi`: key-press counter and sliding-window rate only (never store key identity); graceful failure. `idle.js` using `powerMonitor` (idle seconds, lock/unlock, suspend/resume). Pure modules `moodTiers.js` and `awayTiers.js` with unit tests at all boundaries (29/30/31 min, etc.). Work-session timer and mood effects (speed, idle animation set, nudges with bubbles). Away behavior (curl up, deep sleep). Welcome-back celebrations by tier. Typing reactions. Add art: `type_knead`, `type_fast_steam`, `yawn`, `slow_blink`, `idle_sit_droopy`, `loaf_grumpy`, `run`, `happy_hop`, `spin`, steam, sparkle, "!" and "?" bubbles. Small speech-bubble module (icon and short text, auto-dismiss).
**Acceptance:** boundary tests pass; a debug flag (`--debug-clock` or similar) lets the user fast-forward the work timer and away time to test tiers without waiting hours; typing reactions work, and the app runs normally if the hook fails; a returning user sees the correct celebration tier.
**GATE:** the user tests with the fast-forward flag and real typing.

### Phase 5: Menu, timer, reminders, focus, look, settings
**Goal:** all the controls on double-click.
**Tasks:** the menu window (pixel-styled, keyboard accessible, closes on blur/Esc, stays within the display). Sections: **Follow mode** (3 options), **Timer** (5, 10, 25 min, custom; countdown shown above her head; on finish she jumps and shows a bubble; cancel and pause supported), **Reminders** (stretch, water, eye-rest, custom text; repeating by interval or once; persisted; not fired while away, collapsed into one on return; each has an icon bubble and `stretch_big` for stretch), **Focus mode** (Pomodoro with configurable lengths; she sits quiet during work, celebrates at breaks; suppresses mood nudges during work), **Look** (coat preset, eye color, size 2x-4x), **Settings** (start with Windows, always-on-top, roam, thresholds), **Hide / Quit**. `scheduler.js` is pure and unit-tested (next-fire computation, once vs repeat, away deferral). Settings migration test. Add `stretch_big` art and reminder icons.
**Acceptance:** every menu item works and persists; timers and reminders survive restart; scheduler tests pass; menu never opens off-screen.
**GATE:** the user uses it for a normal work session.

### Phase 6: Claude Code hook (optional feature)
**Goal:** Lily celebrates when Claude Code finishes a task.
**Tasks:** `hookServer.js`: HTTP server bound to **127.0.0.1 only** on `claudeHook.port` (default 47821); endpoints `POST /event/stop` and `POST /event/notification`; ignore everything else; no data stored. `claudeHook.js`: enable/disable from the menu. Enabling merges a hook entry into the user's `~/.claude/settings.json` (create a timestamped backup first; never overwrite other hooks; remove only our entry on disable). Hook command is a fast `curl` POST to the local port that always exits 0 and has a short timeout. Events: **Stop** triggers a celebration with a "done!" bubble; **Notification** triggers `alert` with a "?" bubble. Add `alert` art.
**Before coding:** check the current Claude Code hooks documentation for the exact `settings.json` schema and which shell Windows uses to run hook commands; make the command work there. Test with a real Claude Code session.
**Acceptance:** with the hook enabled, finishing a Claude Code task makes Lily react within about 1 s; disabling removes exactly our entry; the app works fine if the port is busy (show a bubble and disable the feature); a malformed or missing settings file is handled safely.
**GATE:** the user tests with a real Claude Code run.

### Phase 7: Window perching and fullscreen awareness
**Goal:** she sits on window edges and stays out of the way.
**Tasks:** `winTracker.js` using `koffi` and user32/dwmapi: `EnumWindows`, `IsWindowVisible`, `IsIconic`, `GetWindowRect`, `DwmGetWindowAttribute` (skip cloaked windows), exclude tool windows, the desktop shell, and Lily's own windows. Convert physical pixels to DIPs (Electron `screen` helpers). Poll every 250-500 ms only when `perchOnWindows` or `roam` needs it. Perch behavior: with `perchOnWindows` enabled, gravity applies; she walks along window title-bar tops, naps on them, and when the window moves she moves with it; if it closes or minimizes she falls (`fall`, `land`) to the next surface or the taskbar top. Fullscreen awareness: if the foreground window covers a whole display, hide or pause Lily (setting `hideInFullscreen`). If `koffi` fails to load, disable perching and fullscreen detection and continue. Add `fall` and `land` art.
**Acceptance:** perching follows moving windows; never perches on cloaked or ghost windows; hides over fullscreen video; CPU within budget; geometry helpers unit-tested.
**GATE:** the user tests with several windows, multiple monitors, and a fullscreen video.

### Phase 8: Hardening, packaging, release
**Tasks:** `electron-builder` config for a per-user NSIS installer (no admin) plus a portable exe; app icon generated from the sprite; start-with-Windows via `app.setLoginItemSettings`; crash-safe settings (corrupt file falls back to defaults); simple local log with rotation (no keystroke content, ever); reduce-motion option; README (install, controls, privacy statement, the SmartScreen "More info, Run anyway" note for the unsigned installer, how to build); performance pass against the budget; release checklist. Ask the user which license to use before adding one.
**Acceptance:** installer builds; install and uninstall work on a clean Windows user; autostart works; memory and CPU within budget after 1 hour idle; all unit tests pass.
**GATE:** the user installs the built installer and runs it for a day.

### Phase 9: Optional extras (each independent; ask which to do)
Low-battery reaction. Multiple cats with different personalities. Skin/sprite pack loader (folder of grids and palette). Sound (synthesized meow/purr, off by default). Pomodoro stats. Custom hex coat editor. Mac port.

## 7. Testing strategy

- **Unit tests (`node --test`)** for all pure logic: mood tiers, away tiers, click/drag classifier, clamping, scheduler, settings migration, behavior rules, sprite grid validation.
- **Debug flags:** time fast-forward (Phase 4) and a `--debug-overlay` that draws hit areas and state names.
- **Manual checklists:** at each gate, give the user a short numbered list of things to try and what "pass" looks like.
- If a test can't run in your environment (Windows-specific), say so and put it in the user's manual list instead of faking a result.

## 8. Known risks and fallbacks

- **Mixed-DPI and multi-monitor:** Electron can misplace windows across different-scaling monitors. Use integer DIP bounds; if a bug persists, set position and size in two steps and test.
- **Fullscreen exclusive games:** a floating window can't show over them; hide instead.
- **Antivirus and SmartScreen:** global keyboard hooks and unsigned installers can trigger warnings. Keep the hook count-only, document it in the README, and note that code signing costs money.
- **Memory:** Electron is heavier than native; keep within budget by sleeping logic when idle and hiding.
- **Calico readability at 48x48:** if patches look muddy, simplify the patch shapes rather than adding colors.
- **Hook format drift:** Claude Code's settings format may change; the feature is optional and isolated in `claudeHook.js`.

## 9. Progress Log (update after every phase)

- [x] Phase 0: Scaffold and transparency check
- [x] Phase 1: Art pipeline and core sprites (style approved by user)
- [x] Phase 2: Window shell and interaction basics (tested by user)
- [x] Phase 3: Behavior engine, following, roaming (tested by user)
- [x] Phase 4: Activity, moods, typing, welcome-back (tested by user)
- [x] Phase 5: Menu, timer, reminders, focus, look, settings (tested by user)
- [x] Phase 6: Claude Code hook (tested by user)
- [x] Phase 7: Window perching and fullscreen awareness (tested by user)
- [ ] Phase 8: Hardening, packaging, release
- [ ] Phase 9: Optional extras (as chosen)

**Notes / decisions / known issues:**
- P0: Electron 45.1.0, electron-builder 26.18.0 (exact). Transparency + click-through confirmed by user. Hit-test = canvas alpha under cursor (`src/renderer/cat.js`), toggled via `lily.setIgnoreMouse` IPC.
- P0: Electron's postinstall binary download fails on the user's network (connection resets); fixed by curl-with-resume, checksum verify, unzip to `node_modules/electron/dist`, write `path.txt`.
- P0: photos moved to `reference/`. `tools/*-sprites.js` are stubs until Phase 1.
- P1: pngjs 7.0.0 (exact). Formats documented at the top of `tools/build-sprites.js`: parts are `@name [noline]` grids, frames are `anim/frame/group` placement lists. Every part gets a 1px outline ring unless `noline`; white-on-white gets no ring so the chin merges into the chest ruff.
- P1: palettes in `assets/palettes/coats.json` (all 6 coats) + `eyes.json`. Rasterizer is shared (`src/shared/spriteRaster.js`, UMD) by the renderer and the preview tool.
- P1: `nap_belly_up` is drawn top-down (head upright, paws up, legs splayed) rather than side-on; the side-on version didn't read. Heart/zzz are standalone fx sprites for the particle system, not baked into frames.
- P1: `src/renderer/sprites.js` is not wired into the window yet (Phase 2 loads sprites.json and uses it). The black coat's face detail is low-contrast; revisit in Phase 5 if it matters.
- P2: main split into `settings.js` (debounced atomic JSON, corrupt file renamed `.bad`), `windows.js` (cat + stub menu window, drag, IPC), `tray.js` (icon rasterized from her own sprite). Window = 48xscale wide, (48+20)xscale tall; the 20 sprite-px bubble room is above the cat.
- P2: drag runs in main: renderer sends the grab offset, main polls `screen.getCursorScreenPoint()` every 16 ms and `setBounds` with fixed size (mixed-DPI drift guard). Clamp (user request, replaces the 40%-visible rule): the cat rect (opaque-pixel bounds of the sit/purr/limp frames, not the 48x48 box) stays fully inside the work area nearest her centre, on every drag step, on drop and on display changes, so she never goes off-screen or under the taskbar; the bubble room may poke above the top edge (`src/shared/placement.js`). Press rules in `src/shared/pressClassifier.js`; double-click = 2 clicks within 350 ms (first click still pets).
- P2: default scale changed 3 -> 2 at the user's request (96 px cat). Multi-monitor not tested (user has one screen).
- P2: hit-test is canvas alpha (hearts count as clickable). Hover-pet: cursor on an opaque pixel in the top 28 sprite rows for 1 s starts `loving` (pet_purr + a heart every 700 ms) until the cursor leaves her pixels or a drag starts; timer checked in the draw loop since a resting cursor sends no mousemove. Renderer redraws at a fixed 12 Hz; Phase 3's animator should lower it while asleep.
- P3: behavior loop in the renderer (`behavior.js` + pure `src/shared/behaviorRules.js`); main owns position (`cat-world`/`cat-move`/`cat-pose`, clamped per pose via opaque bounds). User changes: default `followMode` is `stay`; follow/roam only walk sideways along her row (never over screen content); watch is 18 frames (3x3 eyes, +head turn past 250 DIP); own activity scheduler (sit, groom, look-around, yawn, loaf 1-3 min, stretch) and nap routine (awake 4-10 min, nap 1-3 min) independent of user input; lying down ignores cursor/typing; petting while lying purrs in place (`loaf_purr`, `curl_purr`); hover-pet 0.5 s on head with slack. All belly animations (`nap_belly_up`, `belly_flop`, belly rub) removed at the user's request.
- P3: memory ~350 MB working set vs the 150 MB budget and multi-monitor are untested/deferred to Phase 8. Wide poses at a screen edge get nudged inward by `settle`.
- P4: `uiohook-napi` 1.5.5 (exact) in `src/main/input.js`, which keeps only a press count and the last 2 s of press times, never key identity; it fails soft. `src/main/idle.js` runs the work timer and away tracker from `powerMonitor` idle time plus lock/unlock and suspend/resume; `--debug-clock=N` speeds it up N times (default 20). Pure tiers in `src/shared/moodTiers.js` and `awayTiers.js`, tested at every boundary.
- P4: typing (user request): she sits behind a small pixel keyboard with her paws on two of its keys (first drawn as two loose keys; changed at the user's request so it reads as a keyboard). Each real press moves the other paw (press count parity). The keyboard pops up in 150 ms, shakes while steaming, and fade over 300 ms once typing stops, which is 1.5 s after the last press. They vanish at once on drag and count as clickable. Typing doesn't get her up while she is lying down or napping (user's Phase 3 request). Moods swap her activity set and walking speed (fresh 1.0, groove 0.9, tired 0.7, overworked 0.5), and fresh stays her normal routine. Nudge bubbles appear at 90 min, then every 15 min, then every 10 min once overworked; Focus Mode suppression comes in Phase 5. Speech bubbles use a system font (`bubbles.js`).

- P5: menu = `src/main/menu.js` + `src/preload/menuPreload.js` + `src/renderer/menu/*` (accordion of `<details>`, radio chips and colour swatches instead of `<select>`, since a dropdown popup could blur-close the window). It resizes to its content and stays on her display. Timer, Focus and reminders are in `src/main/timers.js`, with pure rules in `src/shared/scheduler.js`. Their state lives in settings (schema v2 adds `timer` and `focusRun`), so it survives a restart. Reminders and "time's up" wait while you're away, then fire together as one bubble. Focus work keeps her still, silences nudges and meows, and she celebrates at each break.
- P5: the follow mode and always-on-top options moved from the tray into the menu; the tray now has Show/Hide, Menu and Quit. The separate `roam` setting is unused, because Roam is a follow mode. Changing look or size reloads the cat window and keeps her feet in place. In development, Start with Windows registers electron.exe with this folder. User requests: a random "meow" bubble every 20-50 min. The "away after 5-10 s" bug came from the `--debug-clock=20` test run being left on (2 min / 20 = 6 s); the real clock is unchanged.

**Definition of done for v1 (Phases 0-8):** Lily installs on a clean Windows PC, floats where the user puts her, follows or roams per setting, reacts to typing, shows mood by work time, celebrates returns from breaks, offers timers/reminders/focus from a double-click menu, optionally reacts to Claude Code, stays under the performance budget, and collects or sends nothing.
- P6: `src/main/hookServer.js` (127.0.0.1 only, `POST /event/stop|notification` -> 204, everything else 404, bodies never read, requests with an `Origin` header refused so web pages can't trigger it) and `src/main/claudeHook.js` (menu toggle "React to Claude Code" in Settings). Pure merge/remove in `src/shared/hookConfig.js`: our handlers are recognised by `127.0.0.1:<port>/event/` in the command, so other hooks are never touched; an unexpected file shape or bad JSON leaves the file alone and shows the error in the menu. A timestamped `settings.json.lily-backup-*` is written before every change.
- P6: hook command `curl.exe -s -o NUL -m 1 -X POST http://127.0.0.1:47821/event/stop; exit 0`, `timeout: 5`, `async: true`. `curl.exe` (not `curl`) so it runs in both Git Bash and PowerShell 5.1; checked in both. The plain `"type": "http"` hook was skipped because it posts the whole turn (last message, cwd) to Lily. Stop -> celebration + "done!"; Notification -> new `alert` anim (startled hop, tail up like a "?") + "?" bubble. A busy port shows "hook port busy" and turns the feature off.
- P7: `koffi` 3.3.3 (exact). `src/main/winTracker.js` lists app windows (positions only, never titles): visible, not minimized, not cloaked, no tool/no-activate/click-through styles, titled, not the shell, not our process; rect from DWM extended frame bounds, converted with `screen.screenToDipRect`. Fails soft (settings greyed out in the menu). Polling lives in `windows.js` (`watchWindows`): 250 ms, 50 ms while carrying her, 1 s when both settings are off.
- P7: pure geometry in `src/shared/perch.js`: surfaces = uncovered window tops with headroom and room for her body, inside a work area; ground = highest surface at/below her feet (her sit body's bottom), else the taskbar. Fall/land physics in `behavior.js` (gravity 3000 DIP/s^2), tested via vm in `test/fall.test.js`. Fullscreen = foreground window covering her display -> hide, show again after. New art `fall`/`land` in `assets/frames/perch.txt`. Untested: multi-monitor; packaging the koffi native module (Phase 8).
- Post-P7 polish (user requests): the menu timer and reminders use a scroll-wheel minute picker (`wheel()` in `menu.js`). Reminders are free text only (the built-in kinds still load). Focus is three presets (25/5, 50/10, 90/20; every 4th break is 3x longer). Meows come every 3-8 min in 5 variants. Sleep is cut to awake 10-20 min, naps 1-2 min, loaf 30-90 s, and 10% roam naps. New activities: `bat_paw`, `tail_watch` and `pounce` (`assets/frames/play.txt`), plus `spin` and `happy_hop`. She watches the cursor whenever she sits between activities and looks up from calm ones when it moves (the 20 s glance cooldown and `sitPose` were removed).
- P8: electron-builder config is in `package.json` `build`. It makes a per-user one-click NSIS installer (no admin) plus a portable exe, x64 only. `npmRebuild: false` because the uiohook-napi and koffi N-API prebuilds ship as-is, and `asarUnpack: **/*.node`. Do not exclude anything under `node_modules/koffi`: excluding `src/koffi/src` dropped `static.cjs` and quietly turned perching off in the build. `lily.log` caught it, so that check is in the README release checklist.
- P8: `build/icon.ico` is drawn from her head sprite by `tools/build-icon.js`. `src/main/log.js` sends console warn/error, uncaught errors and renderer crashes to `%APPDATA%\Lily\logs\lily.log` (rotates at 512 KB to `lily.old.log`). Reduce motion is a new setting (no lively activities, calm celebrations, no sparkles, steam or keyboard shake). On the portable build, Start with Windows registers `PORTABLE_EXECUTABLE_FILE`. License is MIT (user's choice) and the version is 1.0.0.
- P8: the packaged build at idle used 0.17% CPU of the machine and 157 MB private memory (340 MB working set across 4 processes, inflated by shared Chromium pages). That is about at the 150 MB budget; `disableHardwareAcceleration` was not tried. The 1-hour idle check and the clean-user install are the user's gate.
- P9 (music, user request): `src/main/audioMeter.js` reads the default speakers' peak level through Core Audio COM via koffi (IMMDeviceEnumerator -> IAudioMeterInformation.GetPeakValue). It reads that number only, never audio. It re-acquires the device every 5 s and polls at 10 Hz while the setting is on. Pure start/stop rules are in `src/shared/music.js`: on after 8 s of sound (gaps of 3 s or less allowed), off after 6 s of quiet; any sound counts, as agreed with the user. She plays `vibe` (headphones, head bob) with note particles, at priority below typing. While she types over music, the headphones are an overlay on the typing poses (`HEADPHONES` in behaviorRules, fx `headphones`). The new fixed colour role R is headphone pink. The setting is `musicReactions`, default on, shown in the menu as "Vibe to music".
