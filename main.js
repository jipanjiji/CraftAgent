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

const fs = require('fs');
const https = require('https');
const { ArchiveInspector } = require('./src/tools/archive-inspector');
const { ModrinthService } = require('./src/tools/modrinth-service');
const { DiffEngine } = require('./src/diff-engine');

// Initialize Services
let configManager;
let fileManager;
let terminalExecutor;
let workspaceScanner;
let webIntelligence;
let historyManager;
let archiveInspector;
let modrinthService;
let aiEngine;

function initServices() {
  const userDataPath = app.getPath('userData');
  configManager = new ConfigManager(userDataPath);
  const cfg = configManager.getConfig();

  fileManager = new FileManager(null, cfg.fileManager.maxReadSize);
  terminalExecutor = new TerminalExecutor(null, cfg.terminal.defaultTimeout, cfg.terminal.shell);
  workspaceScanner = new WorkspaceScanner(null, cfg.ignoredFolders);
  webIntelligence = new WebIntelligence();
  historyManager = new HistoryManager(cfg.history.maxMessages, cfg.history.maxTokenBudget || 64000);
  archiveInspector = new ArchiveInspector(null);
  modrinthService = new ModrinthService(null);

  aiEngine = new AIEngine({
    configManager,
    historyManager,
    fileManager,
    terminalExecutor,
    workspaceScanner,
    webIntelligence,
    archiveInspector,
    modrinthService
  });

  // Unified Human-In-The-Loop Approval Callback for Terminal & External Paths
  const handleApprovalRequest = (req) => {
    return new Promise((resolve) => {
      const currentCfg = configManager.getConfig();
      if (currentCfg.security && currentCfg.security.mode === 'full-access') {
        const desc = req.type === 'EXTERNAL_PATH' ? `external path "${req.path}"` : `command "${req.command}"`;
        sendToRenderer('app:log', {
          type: 'SECURITY',
          level: 'info',
          message: `Auto-approved (Full Access Mode): ${desc}`
        });
        return resolve(true);
      }

      if (currentCfg.security && currentCfg.security.mode === 'approve-for-me') {
        const isUnsafe = (req.type === 'EXTERNAL_PATH') || req.isDangerous;
        if (!isUnsafe) {
          const desc = req.command || req.path || 'action';
          sendToRenderer('app:log', {
            type: 'SECURITY',
            level: 'info',
            message: `Auto-approved safe action (Approve For Me Mode): ${desc}`
          });
          return resolve(true);
        }
      }

      if (!mainWindow || mainWindow.isDestroyed()) {
        return resolve(false);
      }

      // Auto-deny timeout after 60s for safety
      const timer = setTimeout(() => {
        if (pendingConfirmations.has(req.id)) {
          pendingConfirmations.delete(req.id);
          const desc = req.type === 'EXTERNAL_PATH' ? req.path : req.command;
          sendToRenderer('app:log', {
            type: 'SECURITY',
            level: 'warning',
            message: `Approval request for "${desc}" expired after 60s.`
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
  };

  // Wire approval callbacks across all tools
  terminalExecutor.setConfirmCallback(handleApprovalRequest);
  fileManager.setConfirmCallback(handleApprovalRequest);
  workspaceScanner.setConfirmCallback(handleApprovalRequest);
  archiveInspector.setConfirmCallback(handleApprovalRequest);

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

  // Prevent any unhandled window.open from opening blank child windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

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
  if (modrinthService) modrinthService.setWorkspaceRoot(selectedPath);

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
  if (modrinthService) modrinthService.setWorkspaceRoot(targetPath);
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
ipcMain.handle('ai:send-message', async (_, payload) => {
  let userText = '';
  let rawAttachments = [];

  if (typeof payload === 'string') {
    userText = payload;
  } else if (payload && typeof payload === 'object') {
    userText = payload.text || '';
    rawAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  }

  if (!userText.trim() && rawAttachments.length === 0) {
    return { success: false, error: 'Empty message' };
  }

  // Process attachments: save non-image files / jars to <workspace>/uploads/
  const processedAttachments = [];
  const wsRoot = aiEngine.workspaceRoot || process.cwd();
  const uploadsDir = path.join(wsRoot, 'uploads');

  for (const att of rawAttachments) {
    try {
      const isImage = att.isImage || (att.type && att.type.startsWith('image/'));
      let savedPath = null;
      let buffer = null;

      if (att.dataUrl && att.dataUrl.includes('base64,')) {
        const base64Data = att.dataUrl.split('base64,')[1];
        buffer = Buffer.from(base64Data, 'base64');
      }

      if (buffer) {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const safeName = path.basename(att.name || (isImage ? 'image.png' : 'file.bin'));
        const targetFilePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(targetFilePath, buffer);
        savedPath = path.relative(wsRoot, targetFilePath).replace(/\\/g, '/');

        sendToRenderer('app:log', {
          type: 'FILE_WRITE',
          level: 'info',
          message: `Saved uploaded attachment to workspace: ${savedPath} (${buffer.length} bytes)`
        });
      }

      // If text file under 64KB, include text snippet
      let textSnippet = null;
      if (!isImage && buffer && buffer.length <= 64 * 1024) {
        try {
          const text = buffer.toString('utf8');
          if (!/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 1000))) {
            textSnippet = text.slice(0, 4000);
          }
        } catch (e) {}
      }

      processedAttachments.push({
        name: att.name,
        type: att.type,
        size: att.size || (buffer ? buffer.length : 0),
        isImage: isImage,
        isBinary: !isImage && !textSnippet,
        dataUrl: isImage ? att.dataUrl : null,
        savedPath: savedPath || att.name,
        textSnippet: textSnippet
      });
    } catch (attErr) {
      console.error('Error saving attachment in main:', attErr);
    }
  }

  try {
    await aiEngine.chat({
      userMessage: userText,
      attachments: processedAttachments,
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
    case 'inspect_jar': return 'ARCHIVE_INSPECT';
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
    if (updated.history && updated.history.maxTokenBudget) {
      historyManager.setMaxTokenBudget(updated.history.maxTokenBudget);
    }

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
  historyManager.setMaxTokenBudget(resetConfig.history.maxTokenBudget || 64000);

  sendToRenderer('app:log', {
    type: 'SYSTEM',
    level: 'info',
    message: 'Settings reset to factory defaults.'
  });
  return resetConfig;
});

// 7. API Quota & Usage Operations
ipcMain.handle('api:get-usage', async () => {
  try {
    const cfg = configManager.getConfig();
    const apiKey = cfg.api?.apiKey;
    if (!apiKey) {
      return { success: false, error: 'No xKiro API Key configured. Please add your key in Settings.' };
    }

    return new Promise((resolve) => {
      const req = https.get('https://api.xkiro.com/v1/usage', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'CraftAgent/1.0.6'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const data = JSON.parse(body);
              resolve({ success: true, usage: data });
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}: ${body}` });
            }
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 8. Modrinth Hub & Discover Content Operations
ipcMain.handle('modrinth:search', async (_, params) => {
  try {
    const res = await modrinthService.searchProjects(params);
    return { success: true, ...res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modrinth:get-project', async (_, slugOrId) => {
  try {
    const project = await modrinthService.getProject(slugOrId);
    return { success: true, project };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modrinth:get-projects', async (_, ids) => {
  try {
    const projects = await modrinthService.getProjects(ids);
    return { success: true, projects };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modrinth:get-versions', async (_, { slugOrId, loaders, gameVersions }) => {
  try {
    const versions = await modrinthService.getProjectVersions(slugOrId, loaders, gameVersions);
    return { success: true, versions };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modrinth:download-file', async (_, params) => {
  try {
    const res = await modrinthService.downloadVersionFile(params);
    sendToRenderer('app:log', {
      type: 'MODRINTH',
      level: 'success',
      message: `Downloaded ${res.filename} (${(res.sizeBytes / 1024 / 1024).toFixed(2)} MB) to ${res.relativePath}`
    });
    return { success: true, ...res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 9. Visual Diff Operations
ipcMain.handle('diff:generate', async (_, { oldText, newText, filePath }) => {
  return DiffEngine.generateDiff(oldText, newText, filePath);
});

