const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { ConfigManager } = require('./src/config-manager');
const { FileManager } = require('./src/tools/file-manager');
const { TerminalExecutor } = require('./src/tools/terminal-executor');
const { WorkspaceScanner } = require('./src/tools/workspace-scanner');
const { WebIntelligence } = require('./src/tools/web-intelligence');
const { HistoryManager } = require('./src/history-manager');
const { AIEngine } = require('./src/ai-engine');

// Completely remove default application menu (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

let mainWindow = null;
let pendingConfirmations = new Map();

// Initialize Services
let configManager;
let fileManager;
let terminalExecutor;
let workspaceScanner;
let webIntelligence;
let historyManager;
let aiEngine;

function initServices() {
  const userDataPath = app.getPath('userData');
  configManager = new ConfigManager(userDataPath);
  const cfg = configManager.getConfig();

  fileManager = new FileManager(null, cfg.fileManager.maxReadSize);
  terminalExecutor = new TerminalExecutor(null, cfg.terminal.defaultTimeout, cfg.terminal.shell);
  workspaceScanner = new WorkspaceScanner(null, cfg.ignoredFolders);
  webIntelligence = new WebIntelligence();
  historyManager = new HistoryManager(cfg.history.maxMessages);

  aiEngine = new AIEngine({
    configManager,
    historyManager,
    fileManager,
    terminalExecutor,
    workspaceScanner,
    webIntelligence
  });

  // Wire Terminal Human-In-The-Loop Confirmation
  terminalExecutor.setConfirmCallback((req) => {
    return new Promise((resolve) => {
      // If Security Mode is configured as "full-access", auto-approve immediately without prompting!
      const currentCfg = configManager.getConfig();
      if (currentCfg.security && currentCfg.security.mode === 'full-access') {
        sendToRenderer('app:log', {
          type: 'TERMINAL',
          level: 'info',
          message: `Auto-approved command (Full Access Mode): "${req.command}"`
        });
        return resolve(true);
      }

      if (!mainWindow || mainWindow.isDestroyed()) {
        return resolve(false);
      }

      // Auto-deny timeout after 60s for safety
      const timer = setTimeout(() => {
        if (pendingConfirmations.has(req.id)) {
          pendingConfirmations.delete(req.id);
          sendToRenderer('app:log', {
            type: 'TERMINAL',
            level: 'warning',
            message: `Terminal confirmation for "${req.command}" expired after 60s.`
          });
          resolve(false);
        }
      }, 60000);

      pendingConfirmations.set(req.id, {
        resolve: (approved) => {
          clearTimeout(timer);
          resolve(approved);
        }
      });

      // Notify renderer to display confirmation modal
      mainWindow.webContents.send('terminal:confirm-request', req);
    });
  });

  // Wire real-time terminal output streaming
  terminalExecutor.setOutputCallback((out) => {
    sendToRenderer('terminal:output', out);
  });
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#181818',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'renderer', 'assets', 'logo.png'),
    title: 'Craft Agent — Autonomous Minecraft & Coding Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Reject any orphaned terminal requests
    for (const [id, item] of pendingConfirmations.entries()) {
      item.resolve(false);
    }
    pendingConfirmations.clear();
  });
}

// App Lifecycle
app.whenReady().then(() => {
  initServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// 1. Workspace Selection
ipcMain.handle('workspace:select', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Workspace'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  aiEngine.setWorkspaceRoot(selectedPath);

  // Perform initial scan
  const scanResult = workspaceScanner.scan();

  sendToRenderer('app:log', {
    type: 'WORKSPACE',
    level: 'info',
    message: `Active workspace set to: ${selectedPath} (${scanResult.totalItemsScanned || 0} items scanned)`
  });

  return {
    path: selectedPath,
    name: path.basename(selectedPath),
    structure: scanResult.tree
  };
});

// 2. Set Workspace Directly (Auto-restore on startup)
ipcMain.handle('workspace:set', async (_, targetPath) => {
  if (!targetPath) return null;
  const fs = require('fs');
  if (!fs.existsSync(targetPath)) return null;

  aiEngine.setWorkspaceRoot(targetPath);
  const scanResult = workspaceScanner.scan();

  sendToRenderer('app:log', {
    type: 'WORKSPACE',
    level: 'info',
    message: `Auto-restored active workspace: ${targetPath} (${scanResult.totalItemsScanned || 0} items scanned)`
  });

  return {
    path: targetPath,
    name: path.basename(targetPath),
    structure: scanResult.tree
  };
});

// 3. Get Workspace Structure
ipcMain.handle('workspace:get-structure', async () => {
  const scanResult = workspaceScanner.scan();
  return scanResult;
});

// 3. AI Chat Message
ipcMain.handle('ai:send-message', async (_, text) => {
  if (!text || typeof text !== 'string') return { success: false, error: 'Empty message' };

  try {
    await aiEngine.chat({
      userMessage: text,
      onChunk: (chunk) => sendToRenderer('ai:stream-chunk', chunk),
      onToolStart: (data) => {
        sendToRenderer('ai:tool-start', data);
        sendToRenderer('app:log', {
          type: getToolLogType(data.name),
          level: 'info',
          message: `Tool Call: ${data.name}`,
          details: data.args
        });
      },
      onToolComplete: (data) => {
        sendToRenderer('ai:tool-complete', data);
        const level = data.result?.success === false ? 'error' : 'success';
        sendToRenderer('app:log', {
          type: getToolLogType(data.name),
          level: level,
          message: `Tool Completed: ${data.name} [${level.toUpperCase()}]`,
          result: data.result
        });
      },
      onStatus: (status) => sendToRenderer('ai:status', status),
      onError: (err) => {
        sendToRenderer('ai:error', err);
        sendToRenderer('app:log', {
          type: 'ERROR',
          level: 'error',
          message: `AI Engine Error: ${err}`
        });
      },
      onFinish: (res) => sendToRenderer('ai:finish', res)
    });

    return { success: true };
  } catch (err) {
    sendToRenderer('ai:error', err.message);
    return { success: false, error: err.message };
  }
});

function getToolLogType(toolName) {
  switch (toolName) {
    case 'read_file': return 'FILE_READ';
    case 'write_file': return 'FILE_WRITE';
    case 'patch_file': return 'FILE_PATCH';
    case 'download_file': return 'FILE_DOWNLOAD';
    case 'get_workspace_structure': return 'WORKSPACE';
    case 'execute_terminal_command': return 'TERMINAL';
    case 'web_search': return 'WEB_SEARCH';
    case 'scrape_webpage': return 'WEB_SCRAPE';
    default: return 'TOOL';
  }
}

// 4. Abort & Clear
ipcMain.handle('ai:abort', () => {
  aiEngine.abortCurrentRequest();
  return { success: true };
});

ipcMain.handle('ai:clear-history', () => {
  historyManager.clearHistory();
  sendToRenderer('app:log', {
    type: 'SYSTEM',
    level: 'info',
    message: 'Chat history cleared.'
  });
  return { success: true };
});

ipcMain.handle('ai:set-history', (_, messages) => {
  historyManager.setHistory(messages);
  return { success: true };
});

ipcMain.handle('ai:get-history', () => {
  return historyManager.getAllMessages();
});

// 5. Terminal Confirmation Response from User
ipcMain.on('terminal:confirm-response', (_, { requestId, approved }) => {
  if (pendingConfirmations.has(requestId)) {
    const item = pendingConfirmations.get(requestId);
    pendingConfirmations.delete(requestId);
    item.resolve(approved === true);

    sendToRenderer('app:log', {
      type: 'TERMINAL',
      level: approved ? 'info' : 'warning',
      message: `User ${approved ? 'APPROVED' : 'DENIED'} terminal command execution.`
    });
  }
});

// 6. Settings Operations
ipcMain.handle('settings:get', () => {
  return configManager.getConfig();
});

ipcMain.handle('settings:get-models', () => {
  return configManager.getModelsCatalog();
});

ipcMain.handle('settings:save', (_, newConfig) => {
  const res = configManager.saveConfig(newConfig);
  if (res.success) {
    // Apply live settings updates
    const updated = res.config;
    fileManager.setMaxReadSize(updated.fileManager.maxReadSize);
    terminalExecutor.setDefaultTimeout(updated.terminal.defaultTimeout);
    terminalExecutor.setShell(updated.terminal.shell);
    workspaceScanner.setIgnoredPatterns(updated.ignoredFolders);
    historyManager.setMaxMessages(updated.history.maxMessages);

    sendToRenderer('app:log', {
      type: 'SYSTEM',
      level: 'success',
      message: 'Settings updated successfully.'
    });
  }
  return res;
});

ipcMain.handle('settings:reset', () => {
  const resetConfig = configManager.resetConfig();
  fileManager.setMaxReadSize(resetConfig.fileManager.maxReadSize);
  terminalExecutor.setDefaultTimeout(resetConfig.terminal.defaultTimeout);
  terminalExecutor.setShell(resetConfig.terminal.shell);
  workspaceScanner.setIgnoredPatterns(resetConfig.ignoredFolders);
  historyManager.setMaxMessages(resetConfig.history.maxMessages);

  sendToRenderer('app:log', {
    type: 'SYSTEM',
    level: 'info',
    message: 'Settings reset to factory defaults.'
  });
  return resetConfig;
});
