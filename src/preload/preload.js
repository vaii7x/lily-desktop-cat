const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lily', {
  init: () => ipcRenderer.invoke('cat-init'),
  world: () => ipcRenderer.invoke('cat-world'),
  move: (x, y) => ipcRenderer.send('cat-move', { x: Number(x), y: Number(y) }),
  setPose: (name) => ipcRenderer.send('cat-pose', String(name)),
  onFollowMode: (cb) => ipcRenderer.on('follow-mode', (_e, mode) => cb(mode)),
  onActivity: (cb) => ipcRenderer.on('activity', (_e, ev) => cb(ev)),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore === true),
  dragStart: (x, y) => ipcRenderer.send('drag-start', { x: Number(x), y: Number(y) }),
  dragEnd: () => ipcRenderer.send('drag-end'),
  openMenu: () => ipcRenderer.send('open-menu'),
});
