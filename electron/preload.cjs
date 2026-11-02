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
  vibiVoices: (opts) => ipcRenderer.invoke('vibi:voices', opts),
  voiceStatus: (slug) => ipcRenderer.invoke('voice:status', slug),
  generateVoice: (payload) => ipcRenderer.invoke('voice:generate', payload),
  onVoiceEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('voice:event', listener);
    return () => ipcRenderer.removeListener('voice:event', listener);
  },
  updateState: () => ipcRenderer.invoke('update:state'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('update:event', listener);
    return () => ipcRenderer.removeListener('update:event', listener);
  },
  setupRemotion: () => ipcRenderer.invoke('remotion:setup'),
  onSetupEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('setup:event', listener);
    return () => ipcRenderer.removeListener('setup:event', listener);
  },
  benchAuto: () => ipcRenderer.invoke('bench:auto'),
  benchList: () => ipcRenderer.invoke('bench:list'),
  benchRun: (kind) => ipcRenderer.invoke('bench:run', kind),
  benchCancel: () => ipcRenderer.invoke('bench:cancel'),
  onBenchEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('bench:event', listener);
    return () => ipcRenderer.removeListener('bench:event', listener);
  },
  pythonCheck: () => ipcRenderer.invoke('python:check'),
  pythonInstall: () => ipcRenderer.invoke('python:install'),
  generateWithClaude: (payload) => ipcRenderer.invoke('claude:generate', payload),
  cancelGenerate: () => ipcRenderer.invoke('claude:cancel'),
  onClaudeEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('claude:event', listener);
    return () => ipcRenderer.removeListener('claude:event', listener);
  },
  generateCharacter: (payload) => ipcRenderer.invoke('character:generate', payload),
  cancelCharacter: () => ipcRenderer.invoke('character:cancel'),
  onCharacterEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('character:event', listener);
    return () => ipcRenderer.removeListener('character:event', listener);
  },
  detectClaude: () => ipcRenderer.invoke('claude:detect'),
  installClaude: (payload) => ipcRenderer.invoke('claude:install', payload),
  removeClaude: () => ipcRenderer.invoke('claude:remove'),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
