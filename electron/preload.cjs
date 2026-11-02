// Jembatan aman antara tampilan (React) dan proses utama Electron.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('anima', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (next) => ipcRenderer.invoke('settings:save', next),
  pickFolder: (title) => ipcRenderer.invoke('dialog:pickFolder', title),
  systemInfo: () => ipcRenderer.invoke('system:info'),
  startRender: (job) => ipcRenderer.invoke('render:start', job),
  cancelRender: (jobId) => ipcRenderer.invoke('render:cancel', jobId),
  activeRenders: () => ipcRenderer.invoke('render:active'),
  onRenderEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('render:event', listener);
    return () => ipcRenderer.removeListener('render:event', listener);
  },
  detectClaude: () => ipcRenderer.invoke('claude:detect'),
  installClaude: (payload) => ipcRenderer.invoke('claude:install', payload),
  removeClaude: () => ipcRenderer.invoke('claude:remove'),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
