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
  renderQa: (jobId) => ipcRenderer.invoke('render:qa', jobId),
  runRenderQa: (payload) => ipcRenderer.invoke('render:qaRun', payload),
  onRenderEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('render:event', listener);
    return () => ipcRenderer.removeListener('render:event', listener);
  },
  vibiVoices: (opts) => ipcRenderer.invoke('vibi:voices', opts),
  voiceStatus: (slug) => ipcRenderer.invoke('voice:status', slug),
  generateVoice: (payload) => ipcRenderer.invoke('voice:generate', payload),
  voiceWords: (slug) => ipcRenderer.invoke('voice:words', slug),
  saveVoiceWords: (payload) => ipcRenderer.invoke('voice:saveWords', payload),
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
  skillCheck: (engine) => ipcRenderer.invoke('skill:check', engine),
  skillSetup: (payload) => ipcRenderer.invoke('skill:setup', payload),
  skillSamples: (engine) => ipcRenderer.invoke('skill:samples', engine),
  skillOpen: (payload) => ipcRenderer.invoke('skill:open', payload),
  skillStatus: (payload) => ipcRenderer.invoke('skill:status', payload),
  skillOpenFolder: (payload) => ipcRenderer.invoke('skill:openFolder', payload),
  skillChatHistory: (payload) => ipcRenderer.invoke('skillchat:history', payload),
  skillChatSend: (payload) => ipcRenderer.invoke('skillchat:send', payload),
  skillChatStop: (payload) => ipcRenderer.invoke('skillchat:stop', payload),
  skillChatReset: (payload) => ipcRenderer.invoke('skillchat:reset', payload),
  skillChatImage: (payload) => ipcRenderer.invoke('skillchat:image', payload),
  skillChatResolve: (payload) => ipcRenderer.invoke('skillchat:resolve', payload),
  skillChatLogs: (engines) => ipcRenderer.invoke('skillchat:logs', engines),
  skillChatLogTail: (payload) => ipcRenderer.invoke('skillchat:logtail', payload),
  onSkillChatEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('skillchat:event', listener);
    return () => ipcRenderer.removeListener('skillchat:event', listener);
  },
  onSkillEvent: (cb) => {
    const listener = (_e, event) => cb(event);
    ipcRenderer.on('skill:event', listener);
    return () => ipcRenderer.removeListener('skill:event', listener);
  },
  detectClaude: () => ipcRenderer.invoke('claude:detect'),
  installClaude: (payload) => ipcRenderer.invoke('claude:install', payload),
  removeClaude: () => ipcRenderer.invoke('claude:remove'),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
