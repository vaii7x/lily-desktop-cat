const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lilyMenu', {
  state: () => ipcRenderer.invoke('menu-state'),
  act: (name, arg) => ipcRenderer.invoke('menu-do', String(name), arg),
  resize: (height) => ipcRenderer.send('menu-resize', Number(height)),
});
