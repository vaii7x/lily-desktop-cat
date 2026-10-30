# Developing Lily

A tiny pixel-art calico-tabby cat who lives on your Windows desktop. She sits where you put her, watches your
cursor, kneads a little keyboard while you type, gets tired when you work too long, and goes wild when you come
back from a break. Free, local, no telemetry, no accounts, no internet.

Windows 10/11 (x64) only.

## Install

Download one of these from the release page:

- **`Lily-Setup-<version>.exe`**: installs for your user only (no admin), adds a Start menu shortcut and an uninstaller.
- **`Lily-Portable-<version>.exe`**: one file, nothing installed; run it from anywhere.

The files are not code-signed (a certificate costs money), so Windows SmartScreen may say
"Windows protected your PC". Click **More info**, then **Run anyway**. Some antivirus tools also flag apps that
use a global keyboard hook; see Privacy below for what Lily does with it.

To uninstall: Settings > Apps > Installed apps > Lily > Uninstall. Your settings stay in `%APPDATA%\Lily`;
delete that folder too for a clean removal.

## Controls

- **Click** her to pet her. Hovering over her head works too.
- **Drag** to pick her up and put her anywhere, on any monitor. She remembers the spot.
- **Double-click or right-click** for her menu: follow mode (stay, follow, roam), a timer, reminders, focus mode
  (work and break in turns), her coat, eye colour and size, and settings.
- **Tray icon**: show or hide her, open the menu, quit.

Settings include start with Windows, always on top, perching on window tops, hiding over fullscreen apps,
reduce motion (no hops, pounces, sparkles or shaking), reacting to Claude Code, and how long counts as "away".

## Privacy

- No telemetry, no analytics, no accounts, no update checks. Lily makes no network connections.
- The only network code is an optional local server on `127.0.0.1` (off by default) that lets Claude Code tell
  her when it finishes. It accepts connections from this PC only and never reads what is sent.
- The keyboard hook **counts** key presses so she can react to typing. Which keys you press is never stored,
  logged or sent anywhere.
- Window tracking (for perching and fullscreen hiding) reads other windows' positions only, never their titles
  or contents.
- Everything Lily keeps is in `%APPDATA%\Lily`: `settings.json` and a small log of her own warnings and errors
  (`logs\lily.log`, capped at about 1 MB).

## Build from source

Requires Node.js 20+ on Windows.

```
npm install
npm start            # run from source
npm test             # unit tests
npm run dist         # dist/Lily-Setup-<version>.exe and dist/Lily-Portable-<version>.exe
```

Sprites are text grids in `assets/parts` and `assets/frames`. After editing them run `npm run sprites:build`
(writes `assets/build/sprites.json`) and `npm run sprites:preview` (writes `preview/sheet.png`).
`npm run icon:build` redraws `build/icon.ico` from her sprite.

### Release checklist

1. `npm test` passes; bump `version` in `package.json`.
2. `npm run sprites:build` and `npm run icon:build` if the art changed.
3. `npm run dist`.
4. Run `dist/win-unpacked/Lily.exe` and check `%APPDATA%\Lily\logs\lily.log` has no "unavailable" warnings
   (those mean a native module didn't make it into the package).
5. Install the setup exe on a clean Windows user: she appears, the menu opens, typing makes her knead,
   perching works, Start with Windows survives a sign-out, and uninstall removes the app.
6. Run the portable exe once and check Start with Windows points at the exe you kept.
7. Upload both exes to the release.

## License

MIT, see `LICENSE`. All art and code are original.
