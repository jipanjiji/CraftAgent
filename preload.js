const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('craftAgent', {
  // Workspace management
  selectWorkspace: () => ipcRenderer.invoke('workspace:select'),
  setWorkspace: (path) => ipcRenderer.invoke('workspace:set', path),
  getWorkspaceStructure: () => ipcRenderer.invoke('workspace:get-structure'),

  // AI Chat & Execution
  sendMessage: (payload) => ipcRenderer.invoke('ai:send-message', payload),
  abortRequest: () => ipcRenderer.invoke('ai:abort'),
  clearChat: () => ipcRenderer.invoke('ai:clear-history'),
  setHistory: (messages) => ipcRenderer.invoke('ai:set-history', messages),
  getHistory: () => ipcRenderer.invoke('ai:get-history'),

  // Terminal Human-In-The-Loop Confirmation
  respondTerminalConfirm: (requestId, approved) => {
    ipcRenderer.send('terminal:confirm-response', { requestId, approved });
  },

  // Settings & Configuration
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (config) => ipcRenderer.invoke('settings:save', config),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  getModelsCatalog: () => ipcRenderer.invoke('settings:get-models'),

  // Event Listeners from Main to Renderer
  onStreamChunk: (callback) => {
    const handler = (_, chunk) => callback(chunk);
    ipcRenderer.on('ai:stream-chunk', handler);
    return () => ipcRenderer.removeListener('ai:stream-chunk', handler);
  },
  onToolStart: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ai:tool-start', handler);
    return () => ipcRenderer.removeListener('ai:tool-start', handler);
  },
  onToolComplete: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ai:tool-complete', handler);
    return () => ipcRenderer.removeListener('ai:tool-complete', handler);
  },
  onStatus: (callback) => {
    const handler = (_, status) => callback(status);
    ipcRenderer.on('ai:status', handler);
    return () => ipcRenderer.removeListener('ai:status', handler);
  },
  onError: (callback) => {
    const handler = (_, error) => callback(error);
    ipcRenderer.on('ai:error', handler);
    return () => ipcRenderer.removeListener('ai:error', handler);
  },
  onFinish: (callback) => {
    const handler = (_, result) => callback(result);
    ipcRenderer.on('ai:finish', handler);
    return () => ipcRenderer.removeListener('ai:finish', handler);
  },
  onTerminalConfirmRequest: (callback) => {
    const handler = (_, req) => callback(req);
    ipcRenderer.on('terminal:confirm-request', handler);
    return () => ipcRenderer.removeListener('terminal:confirm-request', handler);
  },
  onTerminalOutput: (callback) => {
    const handler = (_, out) => callback(out);
    ipcRenderer.on('terminal:output', handler);
    return () => ipcRenderer.removeListener('terminal:output', handler);
  },
  onLog: (callback) => {
    const handler = (_, logEntry) => callback(logEntry);
    ipcRenderer.on('app:log', handler);
    return () => ipcRenderer.removeListener('app:log', handler);
  }
});
