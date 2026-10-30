// Tray icon (Lily's head, drawn from her own sprite) with Show/Hide, Menu and Quit. Settings live in her menu.
const { app, Tray, Menu, nativeImage } = require('electron');
const { buildColors, rasterize } = require('../shared/spriteRaster');

let tray = null; // module-level so it is not garbage-collected

function headIcon(sprites, look) {
  const rows = sprites.anims.idle_sit.frames[0].slice(5, 30).map((r) => r.slice(10, 35));
  const img = rasterize(rows, buildColors(sprites.coats[look.coat], sprites.eyes[look.eyes]));
  const bgra = Buffer.from(img.data);
  for (let i = 0; i < bgra.length; i += 4) [bgra[i], bgra[i + 2]] = [bgra[i + 2], bgra[i]];
  return nativeImage.createFromBitmap(bgra, { width: img.width, height: img.height });
}

// Built on every click, so Show/Hide is right even after she was hidden from her own menu.
function createTray(sprites, look, getWin, openMenu) {
  tray = new Tray(headIcon(sprites, look));
  tray.setToolTip('Lily');
  const popUp = () => {
    const win = getWin();
    tray.popUpContextMenu(Menu.buildFromTemplate([
      {
        label: win && win.isVisible() ? 'Hide Lily' : 'Show Lily',
        click: () => {
          if (!win) return;
          if (win.isVisible()) win.hide();
          else win.showInactive();
        },
      },
      {
        label: 'Menu...',
        click: () => {
          if (win && !win.isVisible()) win.showInactive();
          openMenu();
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  };
  tray.on('click', popUp);
  tray.on('right-click', popUp);
  return tray;
}

const setIcon = (sprites, look) => tray && tray.setImage(headIcon(sprites, look));

module.exports = { createTray, setIcon };
