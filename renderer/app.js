// Craft Agent — Renderer Application Logic
document.addEventListener('DOMContentLoaded', async () => {
  // Navigation & Workspace
  const btnSelectWorkspace = document.getElementById('btnSelectWorkspace');
  const workspacePathLabel = document.getElementById('workspacePathLabel');
  const currentModelBadge = document.getElementById('currentModelBadge');
  const currentModelName = document.getElementById('currentModelName');
  const btnClearChat = document.getElementById('btnClearChat');
  const btnOpenSettings = document.getElementById('btnOpenSettings');

  // Sidebar & Sessions
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sessionsSidebar = document.getElementById('sessionsSidebar');
  const sessionsList = document.getElementById('sessionsList');
  const btnNewChat = document.getElementById('btnNewChat');
  const btnNewChatSidebar = document.getElementById('btnNewChatSidebar');

  // Delete Session Modal Elements
  const deleteSessionModal = document.getElementById('deleteSessionModal');
  const deleteSessionTargetTitle = document.getElementById('deleteSessionTargetTitle');
  const btnCloseDeleteSession = document.getElementById('btnCloseDeleteSession');
  const btnCancelDeleteSession = document.getElementById('btnCancelDeleteSession');
  const btnConfirmDeleteSession = document.getElementById('btnConfirmDeleteSession');
  let pendingDeleteSessionId = null;

  // Split View & Console Toggle
  const mainSplitView = document.getElementById('mainSplitView');
  const splitDivider = document.getElementById('splitDivider');
  const chatPanel = document.getElementById('chatPanel');
  const consolePanel = document.getElementById('consolePanel');
  const btnToggleConsole = document.getElementById('btnToggleConsole');
  const btnCollapseConsole = document.getElementById('btnCollapseConsole');

  // Chat Elements
  const chatMessages = document.getElementById('chatMessages');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const chatInput = document.getElementById('chatInput');
  const btnSendMessage = document.getElementById('btnSendMessage');
  const btnAttachFile = document.getElementById('btnAttachFile');
  const fileUploadInput = document.getElementById('fileUploadInput');
  const attachmentPreviewBar = document.getElementById('attachmentPreviewBar');
  const inputWrapper = document.getElementById('inputWrapper');

  function getFileIconSvg(filename) {
    if (filename.endsWith('.jar') || filename.endsWith('.zip')) {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
    }
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
  }

  // Console Elements
  const consoleLogs = document.getElementById('consoleLogs');
  const logCount = document.getElementById('logCount');
  const logFilter = document.getElementById('logFilter');
  const btnClearLog = document.getElementById('btnClearLog');

  // Terminal & External Path Confirm Modal
  const terminalConfirmModal = document.getElementById('terminalConfirmModal');
  const confirmModalBadge = document.getElementById('confirmModalBadge');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalDesc = document.getElementById('confirmModalDesc');
  const confirmModalSubtext = document.getElementById('confirmModalSubtext');
  const confirmCommandText = document.getElementById('confirmCommandText');
  const confirmCwd = document.getElementById('confirmCwd');
  const confirmTimeout = document.getElementById('confirmTimeout');
  const confirmCountdown = document.getElementById('confirmCountdown');
  const confirmDangerBanner = document.getElementById('confirmDangerBanner');
  const confirmDangerText = document.getElementById('confirmDangerText');
  const btnApproveTerminal = document.getElementById('btnApproveTerminal');
  const btnDenyTerminal = document.getElementById('btnDenyTerminal');

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCancelSettings = document.getElementById('btnCancelSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnResetSettings = document.getElementById('btnResetSettings');
  const cfgBaseUrl = document.getElementById('cfgBaseUrl');
  const cfgApiKey = document.getElementById('cfgApiKey');
  const btnToggleApiKey = document.getElementById('btnToggleApiKey');
  const cfgModel = document.getElementById('cfgModel');
  const cfgModelSearch = document.getElementById('cfgModelSearch');
  const cfgSecurityMode = document.getElementById('cfgSecurityMode');
  const cfgDefaultTimeout = document.getElementById('cfgDefaultTimeout');
  const timeoutValLabel = document.getElementById('timeoutValLabel');
  const cfgShell = document.getElementById('cfgShell');
  const cfgMaxReadSize = document.getElementById('cfgMaxReadSize');
  const readSizeLabel = document.getElementById('readSizeLabel');
  const cfgIgnoredFolders = document.getElementById('cfgIgnoredFolders');
  const cfgMaxMessages = document.getElementById('cfgMaxMessages');
  const historySizeLabel = document.getElementById('historySizeLabel');
  const cfgMaxTokenBudget = document.getElementById('cfgMaxTokenBudget');
  const tokenBudgetFormattedLabel = document.getElementById('tokenBudgetFormattedLabel');
  const tokenBudgetKBadge = document.getElementById('tokenBudgetKBadge');
  const tokenPresetsRow = document.getElementById('tokenPresetsRow');

  // Model Selector Pill & Floating Popup (Input Bar)
  const btnSelectModelInput = document.getElementById('btnSelectModelInput');
  const modelSelectPopup = document.getElementById('modelSelectPopup');
  const modelPopupSearch = document.getElementById('modelPopupSearch');
  const btnClearModelSearch = document.getElementById('btnClearModelSearch');
  const modelPopupList = document.getElementById('modelPopupList');

  // Security Mode Pill & Floating Popup (Input Bar - Photo 2)
  const btnSecurityModeInput = document.getElementById('btnSecurityModeInput');
  const securityPillIcon = document.getElementById('securityPillIcon');
  const securityPillLabel = document.getElementById('securityPillLabel');
  const securityModePopup = document.getElementById('securityModePopup');
  const secOptionApproval = document.getElementById('secOptionApproval');
  const secOptionApproveForMe = document.getElementById('secOptionApproveForMe');
  const secOptionFullAccess = document.getElementById('secOptionFullAccess');

  // Lightbox Modal
  const imageLightboxModal = document.getElementById('imageLightboxModal');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');
  const lightboxImageTitle = document.getElementById('lightboxImageTitle');
  const lightboxImageEl = document.getElementById('lightboxImageEl');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');

  // State
  let cachedModelCatalog = null;
  let activeAssistantBubble = null;
  let activeAssistantMessageDiv = null;
  let activeStepGroup = null;
  let activeWorkHeader = null;
  let hasExecutedTools = false;
  let wasStoppedByUser = false;
  let rawAssistantText = '';
  let currentRoundText = '';
  let activeTerminalRequestId = null;
  let confirmTimerInterval = null;
  let logEntries = [];
  let currentSettings = null;
  let isGenerating = false;
  let thinkingStartTime = 0;
  let thinkingInterval = null;
  let pendingAttachments = [];

  // Session Management State
  let sessions = [];
  let currentSessionId = null;
  let isDraftSession = false;

  // 1. Initialize Sessions, Settings & UI
  async function initApp() {
    try {
      const catalog = await window.craftAgent.getModelsCatalog();
      cachedModelCatalog = catalog;
      populateModelDropdown(catalog);

      currentSettings = await window.craftAgent.getSettings();
      applySettingsToUI(currentSettings);

      // Console visibility preference (default to hidden as user requested)
      const savedConsoleHidden = localStorage.getItem('craft_console_hidden');
      if (savedConsoleHidden === 'false') {
        mainSplitView.classList.remove('console-hidden');
      } else {
        mainSplitView.classList.add('console-hidden');
      }

      // Sidebar collapsed preference
      const savedSidebarCollapsed = localStorage.getItem('craft_sidebar_collapsed');
      if (savedSidebarCollapsed === 'true') {
        sessionsSidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
      }

      // Live Model Search listener
      if (cfgModelSearch) {
        cfgModelSearch.addEventListener('input', () => {
          populateModelDropdown(null, cfgModelSearch.value);
        });
      }

      // Auto-restore previous workspace if available
      const savedWorkspace = localStorage.getItem('craft_last_workspace');
      if (savedWorkspace) {
        try {
          const res = await window.craftAgent.setWorkspace(savedWorkspace);
          if (res && res.path) {
            workspacePathLabel.textContent = res.path;
            workspacePathLabel.title = res.path;
            btnSelectWorkspace.style.borderColor = 'var(--border-accent)';
            addLogEntry({
              type: 'WORKSPACE',
              level: 'success',
              time: new Date().toLocaleTimeString(),
              message: `Active workspace auto-restored: ${res.name}`,
              details: res.structure
            });
          }
        } catch (wsErr) {
          console.error('Failed to auto-restore workspace:', wsErr);
        }
      }

      // Load Sessions
      loadSessionsFromStorage();

      // Setup Quota Tracker & Live Quota
      fetchAndDisplayQuota();
      setupQuotaTracker();

      // Setup Discover Content (Modrinth Hub)
      setupDiscoverContent();

      // Setup Visual Diff Modal
      setupDiffModal();

      // Setup Input Bar Popups (Model Selector & Security Mode)
      setupInputPopups();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  // Model & Security popup icons & constants
  const SECURITY_ICONS = {
    approval: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>`,
    'approve-for-me': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
    'full-access': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
  };

  const SECURITY_LABELS = {
    approval: 'Approval',
    'approve-for-me': 'Smart',
    'full-access': 'Full Access'
  };

  function updateSecurityModeUI(mode) {
    const validMode = ['approval', 'approve-for-me', 'full-access'].includes(mode) ? mode : 'approval';
    if (securityPillLabel) {
      securityPillLabel.textContent = SECURITY_LABELS[validMode];
      if (validMode === 'full-access') {
        securityPillLabel.style.color = '#e07a5f';
      } else {
        securityPillLabel.style.color = '';
      }
    }

    if (securityPillIcon) {
      securityPillIcon.innerHTML = SECURITY_ICONS[validMode] || SECURITY_ICONS.approval;
      if (validMode === 'full-access') {
        securityPillIcon.style.color = '#e07a5f';
      } else {
        securityPillIcon.style.color = '';
      }
    }

    [secOptionApproval, secOptionApproveForMe, secOptionFullAccess].forEach(opt => {
      if (!opt) return;
      if (opt.getAttribute('data-mode') === validMode) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });

    if (cfgSecurityMode) {
      cfgSecurityMode.value = validMode;
    }
  }

  async function setSecurityMode(mode) {
    if (!currentSettings) currentSettings = await window.craftAgent.getSettings();
    if (!currentSettings.security) currentSettings.security = {};
    currentSettings.security.mode = mode;

    updateSecurityModeUI(mode);
    await window.craftAgent.saveSettings(currentSettings);

    if (securityModePopup) securityModePopup.style.display = 'none';
    if (btnSecurityModeInput) btnSecurityModeInput.classList.remove('active');

    addLogEntry({
      type: 'SECURITY',
      level: 'info',
      time: new Date().toLocaleTimeString(),
      message: `Security mode changed to: ${SECURITY_LABELS[mode] || mode}`
    });
  }

  function renderModelPopupList(filterQuery = '') {
    if (!modelPopupList || !cachedModelCatalog) return;
    modelPopupList.innerHTML = '';
    const q = (filterQuery || '').trim().toLowerCase();
    const activeModelId = (currentSettings && currentSettings.api && currentSettings.api.model)
      ? currentSettings.api.model
      : 'openai/gpt-5.6-terra';
    let totalMatches = 0;

    for (const [vendor, models] of Object.entries(cachedModelCatalog)) {
      const filtered = q
        ? models.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || vendor.toLowerCase().includes(q))
        : models;

      if (filtered.length > 0) {
        totalMatches += filtered.length;
        const vendorHeader = document.createElement('div');
        vendorHeader.className = 'model-popup-vendor-group';
        vendorHeader.textContent = vendor;
        modelPopupList.appendChild(vendorHeader);

        filtered.forEach(m => {
          const item = document.createElement('div');
          item.className = 'model-popup-item' + (m.id === activeModelId ? ' selected' : '');
          item.setAttribute('data-model-id', m.id);

          const info = document.createElement('div');
          info.className = 'model-popup-item-info';

          const nameSpan = document.createElement('span');
          nameSpan.className = 'model-item-name';
          nameSpan.textContent = m.name;

          const idSpan = document.createElement('span');
          idSpan.className = 'model-item-id';
          idSpan.textContent = m.id;

          info.appendChild(nameSpan);
          info.appendChild(idSpan);
          item.appendChild(info);

          const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          checkSvg.setAttribute('class', 'model-item-check');
          checkSvg.setAttribute('width', '16');
          checkSvg.setAttribute('height', '16');
          checkSvg.setAttribute('viewBox', '0 0 24 24');
          checkSvg.setAttribute('fill', 'none');
          checkSvg.setAttribute('stroke', 'currentColor');
          checkSvg.setAttribute('stroke-width', '2.5');
          const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
          polyline.setAttribute('points', '20 6 9 17 4 12');
          checkSvg.appendChild(polyline);
          item.appendChild(checkSvg);

          item.addEventListener('click', async () => {
            await selectModel(m.id);
          });

          modelPopupList.appendChild(item);
        });
      }
    }

    if (totalMatches === 0) {
      const empty = document.createElement('div');
      empty.className = 'model-popup-empty';
      empty.textContent = q ? `No models matching "${q}"` : 'No models available';
      modelPopupList.appendChild(empty);
    }
  }

  async function selectModel(modelId) {
    if (!currentSettings) currentSettings = await window.craftAgent.getSettings();
    if (!currentSettings.api) currentSettings.api = {};
    currentSettings.api.model = modelId;

    const modelShort = modelId.split('/')[1] || modelId;
    if (currentModelName) currentModelName.textContent = modelShort;

    await window.craftAgent.saveSettings(currentSettings);

    if (modelSelectPopup) modelSelectPopup.style.display = 'none';
    if (btnSelectModelInput) btnSelectModelInput.classList.remove('active');

    renderModelPopupList(modelPopupSearch ? modelPopupSearch.value : '');

    addLogEntry({
      type: 'SETTINGS',
      level: 'info',
      time: new Date().toLocaleTimeString(),
      message: `Model switched to: ${modelId}`
    });
  }

  function setupInputPopups() {
    // Model Selector Pill Toggle
    if (btnSelectModelInput && modelSelectPopup) {
      btnSelectModelInput.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = modelSelectPopup.style.display !== 'none';
        if (isOpen) {
          modelSelectPopup.style.display = 'none';
          btnSelectModelInput.classList.remove('active');
        } else {
          if (securityModePopup) {
            securityModePopup.style.display = 'none';
            if (btnSecurityModeInput) btnSecurityModeInput.classList.remove('active');
          }
          modelSelectPopup.style.display = 'flex';
          btnSelectModelInput.classList.add('active');
          renderModelPopupList(modelPopupSearch ? modelPopupSearch.value : '');
          if (modelPopupSearch) {
            setTimeout(() => modelPopupSearch.focus(), 50);
          }
        }
      });
    }

    // Model Popup Search input
    if (modelPopupSearch) {
      modelPopupSearch.addEventListener('input', () => {
        const val = modelPopupSearch.value;
        if (btnClearModelSearch) {
          btnClearModelSearch.style.display = val ? 'flex' : 'none';
        }
        renderModelPopupList(val);
      });
    }

    if (btnClearModelSearch) {
      btnClearModelSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modelPopupSearch) {
          modelPopupSearch.value = '';
          btnClearModelSearch.style.display = 'none';
          renderModelPopupList('');
          modelPopupSearch.focus();
        }
      });
    }

    // Security Mode Pill Toggle
    if (btnSecurityModeInput && securityModePopup) {
      btnSecurityModeInput.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = securityModePopup.style.display !== 'none';
        if (isOpen) {
          securityModePopup.style.display = 'none';
          btnSecurityModeInput.classList.remove('active');
        } else {
          if (modelSelectPopup) {
            modelSelectPopup.style.display = 'none';
            if (btnSelectModelInput) btnSelectModelInput.classList.remove('active');
          }
          securityModePopup.style.display = 'block';
          btnSecurityModeInput.classList.add('active');
          const currentMode = currentSettings?.security?.mode || 'approval';
          updateSecurityModeUI(currentMode);
        }
      });
    }

    // Options inside Security Mode Popup
    [secOptionApproval, secOptionApproveForMe, secOptionFullAccess].forEach(opt => {
      if (opt) {
        opt.addEventListener('click', async (e) => {
          e.stopPropagation();
          const mode = opt.getAttribute('data-mode');
          if (mode) {
            await setSecurityMode(mode);
          }
        });
      }
    });

    // Dismiss popups on click outside
    document.addEventListener('click', (e) => {
      if (modelSelectPopup && modelSelectPopup.style.display !== 'none') {
        if (!modelSelectPopup.contains(e.target) && !btnSelectModelInput.contains(e.target)) {
          modelSelectPopup.style.display = 'none';
          if (btnSelectModelInput) btnSelectModelInput.classList.remove('active');
        }
      }
      if (securityModePopup && securityModePopup.style.display !== 'none') {
        if (!securityModePopup.contains(e.target) && !btnSecurityModeInput.contains(e.target)) {
          securityModePopup.style.display = 'none';
          if (btnSecurityModeInput) btnSecurityModeInput.classList.remove('active');
        }
      }
    });

    // Dismiss popups on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (modelSelectPopup && modelSelectPopup.style.display !== 'none') {
          modelSelectPopup.style.display = 'none';
          if (btnSelectModelInput) btnSelectModelInput.classList.remove('active');
        }
        if (securityModePopup && securityModePopup.style.display !== 'none') {
          securityModePopup.style.display = 'none';
          if (btnSecurityModeInput) btnSecurityModeInput.classList.remove('active');
        }
      }
    });
  }

  function populateModelDropdown(catalog, filterQuery = '') {
    if (catalog) cachedModelCatalog = catalog;
    renderModelPopupList(filterQuery);

    if (!cachedModelCatalog || !cfgModel) return;

    const currentSelected = cfgModel.value;
    cfgModel.innerHTML = '';
    const q = (filterQuery || '').trim().toLowerCase();
    let totalMatches = 0;

    for (const [vendor, models] of Object.entries(cachedModelCatalog)) {
      const filtered = q
        ? models.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || vendor.toLowerCase().includes(q))
        : models;

      if (filtered.length > 0) {
        totalMatches += filtered.length;
        const optgroup = document.createElement('optgroup');
        optgroup.label = vendor;
        filtered.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = `${m.name} (${m.id})`;
          optgroup.appendChild(opt);
        });
        cfgModel.appendChild(optgroup);
      }
    }

    const searchHint = document.getElementById('modelSearchHint');
    if (searchHint) {
      if (q) {
        searchHint.textContent = `Showing ${totalMatches} matching model(s) for "${q}".`;
      } else {
        searchHint.textContent = 'Default: openai/gpt-5.6-terra (best balance of speed, cost & tool calling)';
      }
    }

    if (currentSelected) {
      const exists = Array.from(cfgModel.options).some(o => o.value === currentSelected);
      if (exists) {
        cfgModel.value = currentSelected;
      }
    }
  }

  function applySettingsToUI(cfg) {
    if (!cfg) return;
    cfgBaseUrl.value = cfg.api.baseUrl || 'https://api.xkiro.com/v1';
    cfgApiKey.value = cfg.api.apiKey || '';
    if (cfg.api && cfg.api.model) {
      if (cfgModel) cfgModel.value = cfg.api.model;
      const modelShort = cfg.api.model.split('/')[1] || cfg.api.model;
      if (currentModelName) currentModelName.textContent = modelShort;
    }
    const secMode = (cfg.security && cfg.security.mode) ? cfg.security.mode : 'approval';
    if (cfgSecurityMode) {
      cfgSecurityMode.value = secMode;
    }
    updateSecurityModeUI(secMode);
    renderModelPopupList(modelPopupSearch ? modelPopupSearch.value : '');

    cfgDefaultTimeout.value = cfg.terminal.defaultTimeout || 60;
    timeoutValLabel.textContent = `${cfgDefaultTimeout.value}s`;
    cfgShell.value = cfg.terminal.shell || 'powershell';
    
    cfgMaxReadSize.value = cfg.fileManager.maxReadSize || 512000;
    readSizeLabel.textContent = `${Math.round(cfgMaxReadSize.value / 1024)} KB`;

    cfgMaxMessages.value = cfg.history.maxMessages || 15;
    historySizeLabel.textContent = `${cfgMaxMessages.value} messages`;

    const tokenBudget = (cfg.history && cfg.history.maxTokenBudget) ? cfg.history.maxTokenBudget : 64000;
    updateTokenBudgetDisplay(tokenBudget);

    cfgIgnoredFolders.value = (cfg.ignoredFolders || []).join(', ');
  }

  function formatTokenBudget(val) {
    const num = parseInt(val, 10) || 64000;
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
    }
    return `${Math.round(num / 1000)}k`;
  }

  function updateTokenBudgetDisplay(val) {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 64000;
    num = Math.max(8000, Math.min(1000000, num));
    if (cfgMaxTokenBudget) cfgMaxTokenBudget.value = num;
    const formattedK = formatTokenBudget(num);
    if (tokenBudgetFormattedLabel) {
      tokenBudgetFormattedLabel.textContent = `${formattedK} tokens (${num.toLocaleString()})`;
    }
    if (tokenBudgetKBadge) {
      tokenBudgetKBadge.textContent = formattedK;
    }
    if (tokenPresetsRow) {
      const btns = tokenPresetsRow.querySelectorAll('.btn-token-preset');
      btns.forEach(btn => {
        const btnVal = parseInt(btn.dataset.tokens, 10);
        btn.classList.toggle('active', btnVal === num);
      });
    }
  }

  // 2. Chat Sessions Management (Lazy/Smart Session Persistence & History Sync)
  function loadSessionsFromStorage() {
    try {
      const stored = localStorage.getItem('craft_chat_sessions');
      if (stored) {
        sessions = JSON.parse(stored);
      }
    } catch (e) {
      sessions = [];
    }

    // Clean up empty/blank sessions from storage so sidebar stays clean
    sessions = (sessions || []).filter(s => s && s.html && s.html.trim() !== '');

    // AUTO-RECONSTRUCT: If any session has HTML but empty messages array,
    // reconstruct conversation dialogue so memory is never lost across app restarts!
    sessions.forEach(sess => {
      if (sess.html) {
        sess.html = sess.html.replace(/onclick="window\.open\([^"]*\)"/gi, '');
      }
      if ((!sess.messages || sess.messages.length === 0) && sess.html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sess.html;
        const reconstructed = [];
        tempDiv.querySelectorAll('.chat-message').forEach(msgEl => {
          const isUser = msgEl.classList.contains('user');
          const isAssistant = msgEl.classList.contains('assistant');
          const bubble = msgEl.querySelector('.message-bubble');
          if (bubble && (isUser || isAssistant)) {
            const text = bubble.innerText.trim();
            if (text) {
              reconstructed.push({
                role: isUser ? 'user' : 'assistant',
                content: text
              });
            }
          }
        });
        if (reconstructed.length > 0) {
          sess.messages = reconstructed;
        }
      }
    });

    saveSessionsToStorage();

    if (sessions.length > 0) {
      isDraftSession = false;
      currentSessionId = sessions[0].id;
      renderSessionsList();
      loadSessionMessages(currentSessionId);
    } else {
      openNewChatDraft();
    }
  }

  function saveSessionsToStorage() {
    try {
      localStorage.setItem('craft_chat_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to persist sessions:', e);
    }
  }

  async function openNewChatDraft() {
    // If we're already in a fresh empty draft, do not duplicate
    if (isDraftSession && !currentSessionId) {
      chatInput.focus();
      return;
    }

    // Save previous active session if it had messages
    await saveCurrentSessionState();

    isDraftSession = true;
    currentSessionId = null;

    // Clear backend history
    await window.craftAgent.clearChat();

    // Reset Chat UI to Welcome Screen
    chatMessages.innerHTML = '';
    if (welcomeScreen) {
      welcomeScreen.style.display = 'block';
      chatMessages.appendChild(welcomeScreen);
    }

    renderSessionsList();
    chatInput.focus();
  }

  async function switchSession(sessionId) {
    if (sessionId === currentSessionId && !isDraftSession) return;

    // Save current session's HTML & messages before switching
    await saveCurrentSessionState();

    isDraftSession = false;
    currentSessionId = sessionId;
    renderSessionsList();
    await loadSessionMessages(sessionId);
  }

  async function saveCurrentSessionState() {
    if (isDraftSession || !currentSessionId) return;

    const current = sessions.find(s => s.id === currentSessionId);
    if (current) {
      // Don't save welcome screen if it's the only child
      const clone = chatMessages.cloneNode(true);
      const ws = clone.querySelector('#welcomeScreen');
      if (ws && clone.children.length === 1) {
        current.html = '';
      } else {
        if (ws) ws.remove();
        current.html = clone.innerHTML.replace(/onclick="window\.open\([^"]*\)"/gi, '');
      }

      // Persist full backend conversation history!
      try {
        const msgs = await window.craftAgent.getHistory();
        if (Array.isArray(msgs) && msgs.length > 0) {
          current.messages = msgs;
        }
      } catch (err) {
        console.error('Failed to get history for session save:', err);
      }

      saveSessionsToStorage();
    }
  }

  async function loadSessionMessages(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    chatMessages.innerHTML = '';

    if (session.html && session.html.trim() !== '') {
      chatMessages.innerHTML = session.html;
      // Re-attach copy buttons and step accordions
      chatMessages.querySelectorAll('.agent-step-header').forEach(hdr => {
        hdr.onclick = () => {
          hdr.parentElement.classList.toggle('expanded');
        };
      });
      // Re-attach work header open/close toggles
      chatMessages.querySelectorAll('.agent-work-header.completed').forEach(hdr => {
        const group = hdr.parentElement ? hdr.parentElement.querySelector('.agent-step-group') : null;
        if (group) {
          hdr.onclick = () => {
            hdr.classList.toggle('steps-collapsed');
            group.classList.toggle('collapsed');
          };
        }
      });
      addCopyButtons(chatMessages);
      scrollChatBottom();
    } else {
      if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
        chatMessages.appendChild(welcomeScreen);
      }
    }

    // Sync history with backend: restore the full conversation array
    if (session.messages && session.messages.length > 0) {
      await window.craftAgent.setHistory(session.messages);
    } else {
      await window.craftAgent.clearChat();
    }
  }

  function requestDeleteSession(sessionId, e) {
    if (e) e.stopPropagation();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    pendingDeleteSessionId = sessionId;
    if (deleteSessionTargetTitle) {
      deleteSessionTargetTitle.textContent = session.title || 'Untitled Session';
    }
    if (deleteSessionModal) {
      deleteSessionModal.style.display = 'flex';
    }
  }

  function closeDeleteSessionModal() {
    pendingDeleteSessionId = null;
    if (deleteSessionModal) {
      deleteSessionModal.style.display = 'none';
    }
  }

  function confirmDeleteSession() {
    if (!pendingDeleteSessionId) return;
    const sessionId = pendingDeleteSessionId;
    closeDeleteSessionModal();

    sessions = sessions.filter(s => s.id !== sessionId);
    saveSessionsToStorage();

    if (currentSessionId === sessionId) {
      if (sessions.length > 0) {
        currentSessionId = sessions[0].id;
        isDraftSession = false;
        loadSessionMessages(currentSessionId);
      } else {
        openNewChatDraft();
      }
    }
    renderSessionsList();
  }

  if (btnCloseDeleteSession) btnCloseDeleteSession.onclick = closeDeleteSessionModal;
  if (btnCancelDeleteSession) btnCancelDeleteSession.onclick = closeDeleteSessionModal;
  if (btnConfirmDeleteSession) btnConfirmDeleteSession.onclick = confirmDeleteSession;

  function renderSessionsList() {
    sessionsList.innerHTML = '';
    if (sessions.length === 0) {
      sessionsList.innerHTML = '<div style="padding: 16px 12px; font-size: 11px; color: var(--text-muted); text-align: center;">No saved chats yet</div>';
      return;
    }

    sessions.forEach(sess => {
      const isAudit = sess.type === 'analysis';
      const item = document.createElement('div');
      item.className = `session-item ${(!isDraftSession && sess.id === currentSessionId) ? 'active' : ''} ${isAudit ? 'session-audit' : ''}`;
      const badge = isAudit ? '<span style="font-size: 9.5px; padding: 1px 5px; background: rgba(139,92,246,0.2); color: #c4b5fd; border-radius: 4px; font-weight: 700; margin-right: 4px;">AUDIT</span>' : '';
      item.innerHTML = `
        <span class="session-item-title" title="${escapeHtml(sess.title)}">${badge}${escapeHtml(sess.title)}</span>
        <button class="session-delete-btn" title="Delete Session">&times;</button>
      `;

      item.onclick = () => {
        closeDiscoverView();
        switchSession(sess.id);
      };
      item.querySelector('.session-delete-btn').onclick = (e) => requestDeleteSession(sess.id, e);

      sessionsList.appendChild(item);
    });
  }

  if (btnNewChat) btnNewChat.addEventListener('click', () => openNewChatDraft());
  if (btnNewChatSidebar) btnNewChatSidebar.addEventListener('click', () => openNewChatDraft());

  btnToggleSidebar.addEventListener('click', () => {
    sessionsSidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', sessionsSidebar.classList.contains('collapsed'));
    localStorage.setItem('craft_sidebar_collapsed', sessionsSidebar.classList.contains('collapsed'));
  });

  // 3. Console Activity Log Toggle (Hide / Show)
  function toggleConsoleVisibility() {
    const isHidden = mainSplitView.classList.toggle('console-hidden');
    localStorage.setItem('craft_console_hidden', isHidden);
  }

  if (btnToggleConsole) btnToggleConsole.addEventListener('click', toggleConsoleVisibility);
  if (btnCollapseConsole) btnCollapseConsole.addEventListener('click', toggleConsoleVisibility);

  // 4. Split Resizer Dragging
  let isDragging = false;
  splitDivider.addEventListener('mousedown', (e) => {
    isDragging = true;
    splitDivider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || mainSplitView.classList.contains('console-hidden')) return;
    const containerWidth = mainSplitView.offsetWidth;
    const newChatWidth = Math.max(340, Math.min(containerWidth - 300, e.clientX - sessionsSidebar.offsetWidth));
    const percent = (newChatWidth / containerWidth) * 100;
    chatPanel.style.flex = `0 0 ${percent}%`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      splitDivider.classList.remove('dragging');
      document.body.style.cursor = 'default';
    }
  });

  // 5. Workspace Selection
  btnSelectWorkspace.addEventListener('click', async () => {
    try {
      const result = await window.craftAgent.selectWorkspace();
      if (result) {
        workspacePathLabel.textContent = result.path;
        workspacePathLabel.title = result.path;
        btnSelectWorkspace.style.borderColor = 'var(--border-accent)';
        localStorage.setItem('craft_last_workspace', result.path);

        addLogEntry({
          type: 'WORKSPACE',
          level: 'success',
          time: new Date().toLocaleTimeString(),
          message: `Workspace connected: ${result.name}`,
          details: result.structure
        });
      }
    } catch (err) {
      console.error('Failed to select workspace:', err);
    }
  });

  // 6. Quick Prompt Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        chatInput.value = prompt;
        sendMessage();
      }
    });
  });

  // Helper: Format Bytes
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Render Staged Attachment Preview Bar
  function renderAttachmentPreview() {
    if (!attachmentPreviewBar) return;
    if (pendingAttachments.length === 0) {
      attachmentPreviewBar.style.display = 'none';
      attachmentPreviewBar.innerHTML = '';
      return;
    }

    attachmentPreviewBar.style.display = 'flex';
    attachmentPreviewBar.innerHTML = '';

    pendingAttachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      if (att.isImage) {
        chip.innerHTML = `
          <img class="attachment-chip-thumb" src="${att.dataUrl}" alt="" />
          <div class="attachment-chip-info">
            <span class="attachment-chip-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
            <span class="attachment-chip-size">${formatBytes(att.size)}</span>
          </div>
          <button class="attachment-chip-remove" title="Remove attachment">&times;</button>
        `;
      } else {
        const icon = getFileIconSvg(att.name);
        chip.innerHTML = `
          <span class="attachment-chip-icon">${icon}</span>
          <div class="attachment-chip-info">
            <span class="attachment-chip-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
            <span class="attachment-chip-size">${formatBytes(att.size)}</span>
          </div>
          <button class="attachment-chip-remove" title="Remove attachment">&times;</button>
        `;
      }

      chip.querySelector('.attachment-chip-remove').onclick = () => {
        pendingAttachments.splice(idx, 1);
        renderAttachmentPreview();
      };
      attachmentPreviewBar.appendChild(chip);
    });
  }

  function addFilesToAttachments(fileList) {
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        pendingAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          isImage: file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name),
          dataUrl: reader.result
        });
        renderAttachmentPreview();
      };
      reader.readAsDataURL(file);
    });
  }

  // Attach button & file input listeners
  if (btnAttachFile && fileUploadInput) {
    btnAttachFile.addEventListener('click', () => {
      fileUploadInput.click();
    });

    fileUploadInput.addEventListener('change', (e) => {
      addFilesToAttachments(e.target.files);
      fileUploadInput.value = '';
    });
  }

  // Clipboard Paste (Ctrl+V) for screenshots and files
  document.addEventListener('paste', (e) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const files = Array.from(e.clipboardData.files);
      if (files.some(f => f.type.startsWith('image/') || f.size > 0)) {
        e.preventDefault();
        addFilesToAttachments(files);
      }
    }
  });

  // Drag and drop into chat area
  const dropTargets = [chatPanel, inputWrapper, chatMessages].filter(Boolean);
  dropTargets.forEach(target => {
    target.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (inputWrapper) inputWrapper.classList.add('drag-over');
    });
    target.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (inputWrapper) inputWrapper.classList.remove('drag-over');
    });
    target.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (inputWrapper) inputWrapper.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFilesToAttachments(e.dataTransfer.files);
      }
    });
  });

  // 7. Send Chat Message
  async function sendMessage() {
    const text = chatInput.value.trim();
    if ((!text && pendingAttachments.length === 0) || isGenerating) return;

    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }

    const titleCandidate = text || (pendingAttachments.length > 0 ? `Upload: ${pendingAttachments[0].name}` : 'New Message');

    // Lazy commit: Only create & persist session when the first message is sent!
    if (isDraftSession || !currentSessionId) {
      const newSession = {
        id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: titleCandidate.length > 28 ? titleCandidate.slice(0, 26) + '...' : titleCandidate,
        createdAt: Date.now(),
        html: '',
        messages: []
      };
      sessions.unshift(newSession);
      currentSessionId = newSession.id;
      isDraftSession = false;
      renderSessionsList();
      saveSessionsToStorage();
    } else {
      // Auto-update session title if it's still default "New Chat" or "Session 1"
      const curr = sessions.find(s => s.id === currentSessionId);
      if (curr && (curr.title === 'New Chat' || curr.title.startsWith('Session '))) {
        curr.title = titleCandidate.length > 28 ? titleCandidate.slice(0, 26) + '...' : titleCandidate,
        renderSessionsList();
        saveSessionsToStorage();
      }
    }

    const attachmentsToSend = [...pendingAttachments];
    pendingAttachments = [];
    renderAttachmentPreview();

    // Append User Message with attachment badges
    appendUserMessage(text, attachmentsToSend);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    isGenerating = true;
    updateSendButtonState(true);

    // Track Work / Thought
    thinkingStartTime = Date.now();
    hasExecutedTools = false;
    wasStoppedByUser = false;

    // Prepare Assistant Bubble & Step Container with live in-message Work Header (Screenshot 3)
    rawAssistantText = '';
    currentRoundText = '';
    const assistantMsg = createAssistantMessage();
    activeAssistantMessageDiv = assistantMsg.msgDiv;
    activeStepGroup = assistantMsg.stepGroup;
    activeAssistantBubble = assistantMsg.bubble;
    activeWorkHeader = assistantMsg.workHeader;

    if (thinkingInterval) clearInterval(thinkingInterval);
    thinkingInterval = setInterval(() => {
      if (!isGenerating || !activeWorkHeader) return;
      const elapsedSec = Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000));
      const timerEl = activeWorkHeader.querySelector('.work-timer');
      if (timerEl) {
        timerEl.textContent = `${elapsedSec}s`;
      }
    }, 1000);

    try {
      await window.craftAgent.sendMessage({
        text: text,
        attachments: attachmentsToSend
      });
    } catch (err) {
      appendErrorMessage(err.message || 'An unknown error occurred');
      await finishGeneration();
    }
  }

  function updateSendButtonState(generating) {
    const iconSend = document.getElementById('iconSend');
    const iconStop = document.getElementById('iconStop');
    if (generating) {
      btnSendMessage.title = 'Stop Generating (Esc)';
      if (iconSend) iconSend.style.display = 'none';
      if (iconStop) iconStop.style.display = 'block';
    } else {
      btnSendMessage.title = 'Send Message (Enter)';
      if (iconSend) iconSend.style.display = 'block';
      if (iconStop) iconStop.style.display = 'none';
    }
  }

  async function stopGeneration() {
    if (!isGenerating) return;
    wasStoppedByUser = true;
    try {
      await window.craftAgent.abortRequest();
    } catch (err) {
      console.warn('Abort error:', err);
    }
    await finishGeneration();
  }

  btnSendMessage.addEventListener('click', async () => {
    if (isGenerating) {
      await stopGeneration();
    } else {
      sendMessage();
    }
  });

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      if (imageLightboxModal && imageLightboxModal.style.display === 'flex') {
        e.preventDefault();
        closeImageLightbox();
        return;
      }
      if (isGenerating) {
        e.preventDefault();
        await stopGeneration();
      }
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
  });

  if (btnClearChat) {
    btnClearChat.addEventListener('click', async () => {
      if (confirm('Clear messages in this chat session?')) {
        await window.craftAgent.clearChat();
        chatMessages.innerHTML = '';
        if (welcomeScreen) {
          welcomeScreen.style.display = 'block';
          chatMessages.appendChild(welcomeScreen);
        }
        const curr = sessions.find(s => s.id === currentSessionId);
        if (curr) {
          curr.html = '';
          curr.messages = [];
          saveSessionsToStorage();
        }
      }
    });
  }

  // 8. UI Rendering Helpers
  function appendUserMessage(text, attachments = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message user';

    let attachmentsHtml = '';
    if (Array.isArray(attachments) && attachments.length > 0) {
      const images = attachments.filter(a => a.isImage || (a.type && a.type.startsWith('image/')));
      const files = attachments.filter(a => !a.isImage && (!a.type || !a.type.startsWith('image/')));

      let imgHtml = '';
      if (images.length > 0) {
        imgHtml = `<div class="message-image-gallery">` +
          images.map(img => `<img class="message-img-thumb" src="${img.dataUrl}" alt="${escapeHtml(img.name)}" title="${escapeHtml(img.name)} (Click to view full size)" data-img-name="${escapeHtml(img.name)}" style="cursor: pointer;" />`).join('') +
          `</div>`;
      }

      let fileHtml = '';
      if (files.length > 0) {
        fileHtml = `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">` +
          files.map(f => {
            const icon = getFileIconSvg(f.name);
            return `<div class="message-file-badge">
              <span class="file-badge-icon">${icon}</span>
              <span>${escapeHtml(f.name)}</span>
              <span class="file-badge-size">(${formatBytes(f.size)})</span>
            </div>`;
          }).join('') +
          `</div>`;
      }

      attachmentsHtml = `<div class="message-attachments">${imgHtml}${fileHtml}</div>`;
    }

    const textHtml = text ? `<div>${escapeHtml(text)}</div>` : '';

    msgDiv.innerHTML = `
      <div class="message-meta">
        <span>You</span>
        <span>•</span>
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="message-bubble">
        ${attachmentsHtml}
        ${textHtml}
      </div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollChatBottom(true);
  }

  function createAssistantMessage() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message assistant';
    msgDiv.innerHTML = `
      <div class="message-meta">
        <span style="color: var(--accent-hover); font-weight: 600;">Craft Agent</span>
        <span>•</span>
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="agent-work-header in-progress">
        <span class="work-spinner"></span>
        <span class="work-action-title">Thinking...</span>
        <span class="work-timer">0s</span>
        <span class="work-detail-text"></span>
      </div>
      <div class="agent-step-group"></div>
      <div class="message-bubble streaming-content"></div>
    `;

    chatMessages.appendChild(msgDiv);
    scrollChatBottom(true);

    return {
      msgDiv: msgDiv,
      workHeader: msgDiv.querySelector('.agent-work-header'),
      stepGroup: msgDiv.querySelector('.agent-step-group'),
      bubble: msgDiv.querySelector('.message-bubble')
    };
  }

  function appendErrorMessage(errorMsg) {
    const errDiv = document.createElement('div');
    errDiv.className = 'chat-message assistant';
    errDiv.innerHTML = `
      <div class="message-meta">
        <span style="color: var(--danger); font-weight: 600;">Error</span>
      </div>
      <div class="message-bubble" style="color: var(--danger); font-weight: 500; display: flex; align-items: center; gap: 6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>${escapeHtml(errorMsg)}</span>
      </div>
    `;
    chatMessages.appendChild(errDiv);
    scrollChatBottom(true);
  }

  // Smart Auto-Scroll: Detect when user deliberately scrolls up to read earlier text
  let isUserScrolledUp = false;
  const btnScrollBottom = document.getElementById('btnScrollBottom');

  chatMessages.addEventListener('scroll', () => {
    const distanceFromBottom = chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop;
    // Buffer of 80px
    isUserScrolledUp = distanceFromBottom > 80;
    if (btnScrollBottom) {
      btnScrollBottom.style.display = isUserScrolledUp ? 'flex' : 'none';
    }
  });

  if (btnScrollBottom) {
    btnScrollBottom.addEventListener('click', () => {
      scrollChatBottom(true);
    });
  }

  function scrollChatBottom(force = false) {
    if (force) {
      isUserScrolledUp = false;
      if (btnScrollBottom) btnScrollBottom.style.display = 'none';
      chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    } else if (!isUserScrolledUp) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function formatDuration(totalSeconds) {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  async function finishGeneration() {
    if (!isGenerating && !activeWorkHeader && !activeAssistantBubble && !activeAssistantMessageDiv) return;
    isGenerating = false;
    updateSendButtonState(false);

    if (thinkingInterval) {
      clearInterval(thinkingInterval);
      thinkingInterval = null;
    }

    // Convert in-progress work header to completed "Worked for..." / "Thought for..."
    if (activeWorkHeader) {
      const elapsedSec = Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000));
      const formatted = formatDuration(elapsedSec);
      const title = hasExecutedTools ? `Worked for ${formatted}` : `Thought for ${formatted}`;

      // Auto-collapse steps group so steps are hidden automatically upon completion!
      activeWorkHeader.className = 'agent-work-header completed steps-collapsed';
      activeWorkHeader.innerHTML = `
        <span class="step-chevron">›</span>
        <span class="work-action-title">${title}</span>
      `;

      if (activeStepGroup) {
        const spinners = activeStepGroup.querySelectorAll('.step-active-spinner');
        spinners.forEach(s => s.remove());
        activeStepGroup.classList.add('collapsed');
      }

      // Clicking header toggles collapsing the steps list (open / close)
      const groupToToggle = activeStepGroup;
      const headerToToggle = activeWorkHeader;
      headerToToggle.onclick = () => {
        if (groupToToggle) {
          headerToToggle.classList.toggle('steps-collapsed');
          groupToToggle.classList.toggle('collapsed');
        }
      };

      activeWorkHeader = null;
    }

    if (activeAssistantBubble) {
      activeAssistantBubble.classList.remove('streaming-content');
      // If stopped by user while working and currentRoundText was a partial working thought:
      if (wasStoppedByUser && currentRoundText.trim() && activeStepGroup && hasExecutedTools) {
        const thoughtItem = document.createElement('div');
        thoughtItem.className = 'agent-thought-item';
        thoughtItem.innerHTML = formatMarkdown(currentRoundText.trim());
        activeStepGroup.appendChild(thoughtItem);
        currentRoundText = '';
      }

      // If no final response text was outputted, keep bubble empty & hidden
      if (!currentRoundText || !currentRoundText.trim()) {
        activeAssistantBubble.innerHTML = '';
      } else {
        activeAssistantBubble.innerHTML = formatMarkdown(currentRoundText.trim());
        addCopyButtons(activeAssistantBubble);
      }
      activeAssistantBubble = null;
    }

    // If stopped by user, render "Stopped by user" below the assistant message
    if (wasStoppedByUser && activeAssistantMessageDiv) {
      if (!activeAssistantMessageDiv.querySelector('.stopped-by-user-notice')) {
        const stoppedNotice = document.createElement('div');
        stoppedNotice.className = 'stopped-by-user-notice';
        stoppedNotice.innerHTML = `
          <span class="stop-dot"></span>
          <span>Stopped by user</span>
        `;
        activeAssistantMessageDiv.appendChild(stoppedNotice);
        scrollChatBottom();
      }
    }

    wasStoppedByUser = false;
    activeAssistantMessageDiv = null;
    activeStepGroup = null;

    // Save session HTML and backend conversation history!
    await saveCurrentSessionState();
    chatInput.focus();
  }

  // 9. Agentic Step Rows Generator (Matching User's Screenshot)
  function getFileExtensionBadge(filePath) {
    if (!filePath) return '';
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
      'js': 'badge-js',
      'ts': 'badge-ts',
      'java': 'badge-java',
      'kt': 'badge-java',
      'yml': 'badge-yml',
      'yaml': 'badge-yaml',
      'xml': 'badge-xml',
      'json': 'badge-json',
      'md': 'badge-md',
      'html': 'badge-xml',
      'bat': 'badge-sh',
      'sh': 'badge-sh',
      'ps1': 'badge-sh'
    };
    const badgeClass = map[ext] || 'badge-generic';
    return `<span class="step-file-badge ${badgeClass}">${ext.toUpperCase()}</span>`;
  }

  function getStepPresentation(toolName, args) {
    let verb = 'Executed';
    let target = toolName;
    let badgeHtml = '';
    let diffHtml = '';

    switch (toolName) {
      case 'read_file':
        verb = 'Explored';
        target = args.path ? args.path.split('/').pop().split('\\').pop() : '1 file';
        badgeHtml = getFileExtensionBadge(args.path);
        break;

      case 'get_workspace_structure':
        verb = 'Explored';
        target = 'workspace project tree';
        badgeHtml = '<span class="step-file-badge badge-xml">TREE</span>';
        break;

      case 'write_file':
        verb = 'Edited';
        target = args.path ? args.path.split('/').pop().split('\\').pop() : 'file';
        badgeHtml = getFileExtensionBadge(args.path);
        const linesWritten = args.content ? args.content.split('\n').length : 0;
        diffHtml = `<span class="step-diff-plus">+${linesWritten}</span>`;
        break;

      case 'patch_file':
        verb = 'Edited';
        target = args.path ? args.path.split('/').pop().split('\\').pop() : 'file';
        badgeHtml = getFileExtensionBadge(args.path);
        const addLines = args.replace_block ? args.replace_block.split('\n').length : 0;
        const subLines = args.search_block ? args.search_block.split('\n').length : 0;
        diffHtml = `<span class="step-diff-plus">+${addLines}</span> <span class="step-diff-minus">-${subLines}</span>`;
        break;

      case 'execute_terminal_command':
        verb = 'Ran command';
        target = args.command || 'terminal';
        badgeHtml = '<span class="step-file-badge badge-sh">SH</span>';
        break;

      case 'web_search':
        verb = 'Searched web';
        target = `"${args.query || 'query'}"`;
        badgeHtml = '<span class="step-file-badge badge-json">WEB</span>';
        break;

      case 'scrape_webpage':
        verb = 'Read webpage';
        target = args.url ? new URL(args.url).hostname : 'webpage';
        badgeHtml = '<span class="step-file-badge badge-xml">URL</span>';
        break;

      case 'download_file':
        verb = 'Downloaded';
        target = args.path ? args.path.split('/').pop().split('\\').pop() : 'file';
        badgeHtml = getFileExtensionBadge(args.path);
        break;
    }

    return { verb, target, badgeHtml, diffHtml };
  }

  // 10. IPC Stream Listeners
  window.craftAgent.onStreamChunk((chunk) => {
    currentRoundText += chunk;
    rawAssistantText += chunk;
    if (activeAssistantBubble) {
      activeAssistantBubble.innerHTML = formatMarkdown(currentRoundText);
      scrollChatBottom();
    }
  });

  window.craftAgent.onToolStart((data) => {
    hasExecutedTools = true;

    // Switch in-message header from "Thinking..." to "Working..."
    if (activeWorkHeader) {
      const titleEl = activeWorkHeader.querySelector('.work-action-title');
      const detailEl = activeWorkHeader.querySelector('.work-detail-text');
      if (titleEl) titleEl.textContent = 'Working...';
      if (detailEl && data.statusDescription) {
        detailEl.textContent = data.statusDescription;
      }
    }

    // If there was thought/explanation text streamed in this round before this tool,
    // append it into activeStepGroup in exact chronological order!
    if (currentRoundText.trim() && activeStepGroup) {
      const thoughtItem = document.createElement('div');
      thoughtItem.className = 'agent-thought-item';
      thoughtItem.innerHTML = formatMarkdown(currentRoundText.trim());
      activeStepGroup.appendChild(thoughtItem);

      // Clear the live bubble so this working text doesn't show in the final response bubble!
      currentRoundText = '';
      if (activeAssistantBubble) {
        activeAssistantBubble.innerHTML = '';
      }
    }

    // Add inline step row to assistant message
    if (activeStepGroup) {
      const pres = getStepPresentation(data.name, data.args);
      const stepItem = document.createElement('div');
      stepItem.className = 'agent-step-item';
      stepItem.id = `step-${data.id}`;

      stepItem.innerHTML = `
        <div class="agent-step-header">
          <span class="step-chevron">›</span>
          <span class="step-action-verb">${pres.verb}</span>
          ${pres.badgeHtml}
          <span class="step-target-name">${escapeHtml(pres.target)}</span>
          <span class="step-diff-badge">${pres.diffHtml}</span>
          <span class="step-active-spinner"></span>
        </div>
        <div class="agent-step-body">${escapeHtml(JSON.stringify(data.args, null, 2))}</div>
      `;

      stepItem.querySelector('.agent-step-header').onclick = () => {
        stepItem.classList.toggle('expanded');
      };

      activeStepGroup.appendChild(stepItem);
      scrollChatBottom();
    }
  });

  window.craftAgent.onToolComplete((data) => {
    // Clear in-flight tool status text in header
    if (activeWorkHeader) {
      const detailEl = activeWorkHeader.querySelector('.work-detail-text');
      if (detailEl) detailEl.textContent = '';
    }

    const stepItem = document.getElementById(`step-${data.id}`);
    if (stepItem) {
      // Remove spinner
      const spinner = stepItem.querySelector('.step-active-spinner');
      if (spinner) spinner.remove();

      // Update body with result
      const body = stepItem.querySelector('.agent-step-body');
      if (body && data.result) {
        if (data.result.diffData && data.result.diffData.lines && data.result.diffData.lines.length > 0) {
          body.innerHTML = '';
          const inlineDiff = createInlineDiffElement(data.result.diffData);
          body.appendChild(inlineDiff);
        } else {
          let text = '';
          if (data.result.content) text = data.result.content;
          else if (data.result.tree) text = data.result.tree;
          else if (data.result.stdout || data.result.stderr) text = (data.result.stdout || '') + '\n' + (data.result.stderr || '');
          else if (data.result.results) text = JSON.stringify(data.result.results, null, 2);
          else text = JSON.stringify(data.result, null, 2);

          body.textContent = text;
        }
      }
    }
  });

  window.craftAgent.onStatus((status) => {
    if (activeWorkHeader) {
      if (!status) return;
      const lower = status.toLowerCase();
      if (lower.includes('connecting to xkiro') || lower.includes('processing ai response')) return;
      const detailEl = activeWorkHeader.querySelector('.work-detail-text');
      if (detailEl) {
        detailEl.textContent = status;
      }
    }
  });

  window.craftAgent.onError(async (err) => {
    appendErrorMessage(err);
    await finishGeneration();
  });

  window.craftAgent.onFinish(async (res) => {
    if (res && res.aborted) {
      wasStoppedByUser = true;
    }
    await finishGeneration();
    fetchAndDisplayQuota();
  });

  // 11. Human-In-The-Loop Approval (Terminal & External Path)
  window.craftAgent.onTerminalConfirmRequest((req) => {
    activeTerminalRequestId = req.id;

    if (req.type === 'EXTERNAL_PATH') {
      if (confirmDangerBanner) confirmDangerBanner.style.display = 'none';
      if (confirmModalTitle) confirmModalTitle.textContent = 'External Path Access Approval';
      if (confirmModalDesc) confirmModalDesc.textContent = `Craft Agent requests permission to ${req.action.replace('_', ' ')} on a file or folder outside your active workspace:`;
      if (confirmModalSubtext) confirmModalSubtext.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px; color: var(--warning);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><strong>Visual Safety Aid:</strong> This file/folder is outside your active workspace. Only approve if you explicitly asked Craft Agent to access it.';
      confirmCommandText.textContent = req.path;
      confirmCwd.textContent = req.action.toUpperCase();
      confirmTimeout.textContent = req.description || 'External Path Access';
    } else {
      if (confirmModalTitle) confirmModalTitle.textContent = 'Terminal Command Approval';
      if (confirmModalDesc) confirmModalDesc.textContent = 'Craft Agent requests permission to execute the following shell command in your workspace directory:';
      
      if (req.isDangerous) {
        if (confirmDangerBanner) {
          confirmDangerBanner.style.display = 'flex';
          if (confirmDangerText) {
            confirmDangerText.textContent = `Pattern: ${req.dangerReason || 'Destructive file, git, or system command'}`;
          }
        }
        if (confirmModalSubtext) {
          confirmModalSubtext.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px; color: var(--danger);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><strong>Visual Safety Aid:</strong> Destructive pattern detected. <em>Note: Regex pattern matching cannot detect every disguised script or alias.</em> Always review the command thoroughly before approving — execution runs with your local user permissions.';
        }
      } else {
        if (confirmDangerBanner) confirmDangerBanner.style.display = 'none';
        if (confirmModalSubtext) {
          confirmModalSubtext.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px; color: var(--warning);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><strong>Visual Safety Aid:</strong> Only approve commands you recognize. Always review commands before approving — execution runs with your local user permissions.';
        }
      }

      confirmCommandText.textContent = req.command;
      confirmCwd.textContent = req.workingDir || 'Workspace Root';
      confirmTimeout.textContent = `Timeout: ${req.timeoutSeconds || 60}s`;
    }

    let secondsLeft = 60;
    confirmCountdown.textContent = `${secondsLeft}s`;
    terminalConfirmModal.style.display = 'flex';

    if (confirmTimerInterval) clearInterval(confirmTimerInterval);
    confirmTimerInterval = setInterval(() => {
      secondsLeft--;
      confirmCountdown.textContent = `${secondsLeft}s`;
      if (secondsLeft <= 0) {
        clearInterval(confirmTimerInterval);
        handleTerminalDecision(false);
      }
    }, 1000);
  });

  function handleTerminalDecision(approved) {
    if (confirmTimerInterval) {
      clearInterval(confirmTimerInterval);
      confirmTimerInterval = null;
    }
    if (confirmDangerBanner) {
      confirmDangerBanner.style.display = 'none';
    }
    terminalConfirmModal.style.display = 'none';
    if (activeTerminalRequestId) {
      window.craftAgent.respondTerminalConfirm(activeTerminalRequestId, approved);
      activeTerminalRequestId = null;
    }
  }

  btnApproveTerminal.addEventListener('click', () => handleTerminalDecision(true));
  btnDenyTerminal.addEventListener('click', () => handleTerminalDecision(false));

  // 12. Console Activity Log
  window.craftAgent.onLog((entry) => {
    addLogEntry(entry);
  });

  function addLogEntry(entry) {
    const formatted = {
      id: Date.now() + Math.random(),
      type: entry.type || 'SYSTEM',
      level: entry.level || 'info',
      time: entry.time || new Date().toLocaleTimeString(),
      message: entry.message || '',
      details: entry.details || entry.result || null
    };

    logEntries.push(formatted);
    renderLogs();
  }

  function renderLogs() {
    const filter = logFilter.value;
    const filtered = logEntries.filter(entry => {
      if (filter === 'ALL') return true;
      if (filter === 'FILE') return entry.type.startsWith('FILE');
      if (filter === 'TERMINAL') return entry.type === 'TERMINAL';
      if (filter === 'WEB') return entry.type.startsWith('WEB');
      if (filter === 'WORKSPACE') return entry.type === 'WORKSPACE';
      return true;
    });

    logCount.textContent = `${logEntries.length} events`;

    if (filtered.length === 0) {
      consoleLogs.innerHTML = `<div class="console-empty"><span>No events match filter '${filter}'</span></div>`;
      return;
    }

    consoleLogs.innerHTML = '';
    filtered.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'log-item';
      
      let detailsHtml = '';
      if (entry.details) {
        const text = typeof entry.details === 'string' 
          ? entry.details 
          : JSON.stringify(entry.details, null, 2);
        detailsHtml = `<div class="log-detail-box">${escapeHtml(text)}</div>`;
      }

      item.innerHTML = `
        <div class="log-top">
          <span class="log-type-tag tag-${entry.type}">${entry.type}</span>
          <span class="log-time">${entry.time}</span>
        </div>
        <div class="log-message">${escapeHtml(entry.message)}</div>
        ${detailsHtml}
      `;
      consoleLogs.appendChild(item);
    });

    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  logFilter.addEventListener('change', renderLogs);
  btnClearLog.addEventListener('click', () => {
    logEntries = [];
    renderLogs();
  });

  // Terminal Realtime Stream into Log
  window.craftAgent.onTerminalOutput((data) => {
    let streamBox = document.getElementById('activeTerminalStreamBox');
    if (!streamBox) {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <div class="log-top">
          <span class="log-type-tag tag-TERMINAL">TERMINAL OUTPUT</span>
          <span class="log-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="terminal-stream-box" id="activeTerminalStreamBox"></div>
      `;
      consoleLogs.appendChild(item);
      streamBox = item.querySelector('#activeTerminalStreamBox');
    }
    streamBox.textContent += data.text;
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  });

  // 13. Settings Modal Handlers
  btnOpenSettings.addEventListener('click', () => {
    applySettingsToUI(currentSettings);
    settingsModal.style.display = 'flex';
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  btnCancelSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  btnToggleApiKey.addEventListener('click', () => {
    if (cfgApiKey.type === 'password') {
      cfgApiKey.type = 'text';
      btnToggleApiKey.textContent = 'Hide';
    } else {
      cfgApiKey.type = 'password';
      btnToggleApiKey.textContent = 'Show';
    }
  });

  cfgDefaultTimeout.addEventListener('input', () => {
    timeoutValLabel.textContent = `${cfgDefaultTimeout.value}s`;
  });

  cfgMaxReadSize.addEventListener('input', () => {
    readSizeLabel.textContent = `${Math.round(cfgMaxReadSize.value / 1024)} KB`;
  });

  cfgMaxMessages.addEventListener('input', () => {
    historySizeLabel.textContent = `${cfgMaxMessages.value} messages`;
  });

  if (cfgMaxTokenBudget) {
    cfgMaxTokenBudget.addEventListener('input', () => {
      updateTokenBudgetDisplay(cfgMaxTokenBudget.value);
    });
    cfgMaxTokenBudget.addEventListener('change', () => {
      let val = parseInt(cfgMaxTokenBudget.value, 10);
      if (isNaN(val)) val = 64000;
      val = Math.max(8000, Math.min(1000000, val));
      cfgMaxTokenBudget.value = val;
      updateTokenBudgetDisplay(val);
    });
  }

  if (tokenPresetsRow) {
    tokenPresetsRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-token-preset');
      if (!btn) return;
      const tokens = parseInt(btn.dataset.tokens, 10);
      if (tokens) {
        updateTokenBudgetDisplay(tokens);
      }
    });
  }

  btnSaveSettings.addEventListener('click', async () => {
    const ignoredArr = cfgIgnoredFolders.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    let tokenBudget = cfgMaxTokenBudget ? parseInt(cfgMaxTokenBudget.value, 10) : 64000;
    if (isNaN(tokenBudget)) tokenBudget = 64000;
    tokenBudget = Math.max(8000, Math.min(1000000, tokenBudget));

    const updatedConfig = {
      api: {
        baseUrl: cfgBaseUrl.value.trim() || 'https://api.xkiro.com/v1',
        apiKey: cfgApiKey.value.trim(),
        model: (cfgModel && cfgModel.value)
          ? cfgModel.value
          : ((currentSettings && currentSettings.api && currentSettings.api.model) ? currentSettings.api.model : 'openai/gpt-5.6-terra')
      },
      security: {
        mode: cfgSecurityMode ? cfgSecurityMode.value : ((currentSettings && currentSettings.security && currentSettings.security.mode) ? currentSettings.security.mode : 'approval')
      },
      terminal: {
        defaultTimeout: parseInt(cfgDefaultTimeout.value, 10) || 60,
        shell: cfgShell.value
      },
      fileManager: {
        maxReadSize: parseInt(cfgMaxReadSize.value, 10) || 512000
      },
      history: {
        maxMessages: parseInt(cfgMaxMessages.value, 10) || 15,
        maxTokenBudget: tokenBudget
      },
      ignoredFolders: ignoredArr
    };

    const res = await window.craftAgent.saveSettings(updatedConfig);
    if (res.success) {
      currentSettings = res.config;
      applySettingsToUI(currentSettings);
      settingsModal.style.display = 'none';
    } else {
      alert('Failed to save settings: ' + res.error);
    }
  });

  btnResetSettings.addEventListener('click', async () => {
    if (confirm('Reset all settings to default values?')) {
      const reset = await window.craftAgent.resetSettings();
      currentSettings = reset;
      applySettingsToUI(currentSettings);
    }
  });

  // 14. Image Lightbox Handlers
  function openImageLightbox(src, title = 'Image Preview') {
    if (!imageLightboxModal || !lightboxImageEl) return;
    lightboxImageEl.src = src;
    if (lightboxImageTitle) lightboxImageTitle.textContent = title;
    imageLightboxModal.style.display = 'flex';
  }

  function closeImageLightbox() {
    if (!imageLightboxModal) return;
    imageLightboxModal.style.display = 'none';
    if (lightboxImageEl) lightboxImageEl.src = '';
  }

  if (btnCloseLightbox) {
    btnCloseLightbox.addEventListener('click', closeImageLightbox);
  }
  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', closeImageLightbox);
  }

  // Delegated click on chat images to open in lightbox instead of blank window
  if (chatMessages) {
    chatMessages.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (img && img.src && (img.classList.contains('message-img-thumb') || img.closest('.message-image-gallery') || img.closest('.chat-message'))) {
        e.preventDefault();
        e.stopPropagation();
        openImageLightbox(img.src, img.getAttribute('data-img-name') || img.alt || 'Image Preview');
      }
    });
  }

  // ==========================================================================
  // Visual Diff Preview Handlers
  // ==========================================================================
  let currentActiveDiffData = null;
  let currentDiffViewMode = 'unified'; // 'unified' or 'split'

  function createInlineDiffElement(diffData) {
    const container = document.createElement('div');
    container.className = 'step-inline-diff-container';

    const header = document.createElement('div');
    header.className = 'step-inline-diff-header';
    header.innerHTML = `
      <span>Diff: <span class="diff-stat-plus">+${diffData.stats.additions}</span> <span class="diff-stat-minus">-${diffData.stats.deletions}</span></span>
      <button class="btn-open-full-diff" type="button"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>Fullscreen Diff</button>
    `;

    header.querySelector('.btn-open-full-diff').onclick = (e) => {
      e.stopPropagation();
      openFullDiffModal(diffData);
    };

    const table = document.createElement('table');
    table.className = 'diff-table';
    const tbody = document.createElement('tbody');

    const displayLines = (diffData.lines || []).slice(0, 35);
    displayLines.forEach(l => {
      const tr = document.createElement('tr');
      tr.className = `diff-${l.type}`;
      const marker = l.type === 'addition' ? '+' : (l.type === 'deletion' ? '-' : ' ');
      tr.innerHTML = `
        <td class="diff-gutter-old">${l.oldLineNo || ''}</td>
        <td class="diff-gutter-new">${l.newLineNo || ''}</td>
        <td class="diff-marker">${marker}</td>
        <td class="diff-code">${escapeHtml(l.content)}</td>
      `;
      tbody.appendChild(tr);
    });

    if (diffData.lines && diffData.lines.length > 35) {
      const trMore = document.createElement('tr');
      trMore.innerHTML = `
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 8px; font-style: italic; background: rgba(0,0,0,0.3);">
          ... and ${diffData.lines.length - 35} more lines (Click 'Fullscreen Diff' to inspect complete file changes)
        </td>
      `;
      tbody.appendChild(trMore);
    }

    table.appendChild(tbody);
    container.appendChild(header);
    container.appendChild(table);
    return container;
  }

  function openFullDiffModal(diffData) {
    currentActiveDiffData = diffData;
    const diffModal = document.getElementById('diffModal');
    const diffModalFilePath = document.getElementById('diffModalFilePath');
    const diffModalStats = document.getElementById('diffModalStats');

    if (diffModalFilePath) diffModalFilePath.textContent = diffData.filePath || 'File Diff';
    if (diffModalStats && diffData.stats) {
      diffModalStats.innerHTML = `
        <span class="diff-stat-plus">+${diffData.stats.additions} lines</span>
        <span class="diff-stat-minus">-${diffData.stats.deletions} lines</span>
      `;
    }

    renderFullDiffTable();
    if (diffModal) diffModal.style.display = 'flex';
  }

  function renderFullDiffTable() {
    if (!currentActiveDiffData) return;
    const wrapper = document.getElementById('diffViewerWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'diff-table';
    const tbody = document.createElement('tbody');

    if (currentDiffViewMode === 'split') {
      currentActiveDiffData.lines.forEach(l => {
        const tr = document.createElement('tr');
        if (l.type === 'addition') {
          tr.innerHTML = `
            <td class="diff-gutter-old" style="width: 40px;"></td>
            <td style="width: 50%; background: rgba(0,0,0,0.2); border-right: 1px solid rgba(255,255,255,0.08);"></td>
            <td class="diff-gutter-new" style="width: 40px;">${l.newLineNo || ''}</td>
            <td class="diff-code diff-addition" style="width: 50%;"><span class="diff-marker">+</span> ${escapeHtml(l.content)}</td>
          `;
        } else if (l.type === 'deletion') {
          tr.innerHTML = `
            <td class="diff-gutter-old" style="width: 40px;">${l.oldLineNo || ''}</td>
            <td class="diff-code diff-deletion" style="width: 50%; border-right: 1px solid rgba(255,255,255,0.08);"><span class="diff-marker">-</span> ${escapeHtml(l.content)}</td>
            <td class="diff-gutter-new" style="width: 40px;"></td>
            <td style="width: 50%; background: rgba(0,0,0,0.2);"></td>
          `;
        } else {
          tr.innerHTML = `
            <td class="diff-gutter-old" style="width: 40px;">${l.oldLineNo || ''}</td>
            <td class="diff-code diff-context" style="width: 50%; border-right: 1px solid rgba(255,255,255,0.08);">${escapeHtml(l.content)}</td>
            <td class="diff-gutter-new" style="width: 40px;">${l.newLineNo || ''}</td>
            <td class="diff-code diff-context" style="width: 50%;">${escapeHtml(l.content)}</td>
          `;
        }
        tbody.appendChild(tr);
      });
    } else {
      currentActiveDiffData.lines.forEach(l => {
        const tr = document.createElement('tr');
        tr.className = `diff-${l.type}`;
        const marker = l.type === 'addition' ? '+' : (l.type === 'deletion' ? '-' : ' ');
        tr.innerHTML = `
          <td class="diff-gutter-old">${l.oldLineNo || ''}</td>
          <td class="diff-gutter-new">${l.newLineNo || ''}</td>
          <td class="diff-marker">${marker}</td>
          <td class="diff-code">${escapeHtml(l.content)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
  }

  function setupDiffModal() {
    const diffModal = document.getElementById('diffModal');
    const btnCloseDiff = document.getElementById('btnCloseDiff');
    const btnCloseDiffBottom = document.getElementById('btnCloseDiffBottom');
    const btnDiffUnified = document.getElementById('btnDiffUnified');
    const btnDiffSplit = document.getElementById('btnDiffSplit');
    const btnCopyDiffContent = document.getElementById('btnCopyDiffContent');

    const closeDiff = () => {
      if (diffModal) diffModal.style.display = 'none';
      currentActiveDiffData = null;
    };

    if (btnCloseDiff) btnCloseDiff.onclick = closeDiff;
    if (btnCloseDiffBottom) btnCloseDiffBottom.onclick = closeDiff;

    if (btnDiffUnified) {
      btnDiffUnified.onclick = () => {
        currentDiffViewMode = 'unified';
        btnDiffUnified.classList.add('active');
        if (btnDiffSplit) btnDiffSplit.classList.remove('active');
        renderFullDiffTable();
      };
    }

    if (btnDiffSplit) {
      btnDiffSplit.onclick = () => {
        currentDiffViewMode = 'split';
        btnDiffSplit.classList.add('active');
        if (btnDiffUnified) btnDiffUnified.classList.remove('active');
        renderFullDiffTable();
      };
    }

    if (btnCopyDiffContent) {
      btnCopyDiffContent.onclick = () => {
        if (!currentActiveDiffData || !currentActiveDiffData.lines) return;
        const raw = currentActiveDiffData.lines.map(l => {
          const marker = l.type === 'addition' ? '+' : (l.type === 'deletion' ? '-' : ' ');
          return `${marker} ${l.content}`;
        }).join('\n');
        navigator.clipboard.writeText(raw);
        btnCopyDiffContent.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';
        setTimeout(() => {
          btnCopyDiffContent.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>Copy Diff</span>';
        }, 1500);
      };
    }
  }

  // ==========================================================================
  // xKiro Quota & Balance Tracker Handlers
  // ==========================================================================
  async function fetchAndDisplayQuota() {
    try {
      const res = await window.craftAgent.getApiUsage();
      const badgeText = document.getElementById('xkiroQuotaText');
      const sidebarPctEl = document.getElementById('sidebarQuotaPct');
      const sidebarFillEl = document.getElementById('sidebarQuotaProgressFill');
      const quotaCard = document.getElementById('xkiroQuotaBadge');

      if (!res || !res.success || !res.usage) {
        if (badgeText) badgeText.textContent = 'Check Limit';
        if (sidebarPctEl) sidebarPctEl.textContent = '--';
        if (sidebarFillEl) sidebarFillEl.style.width = '0%';
        return;
      }

      const u = res.usage;
      const freeTokens = u.free_tokens || {};
      const wallet = u.wallet || {};

      const remaining = freeTokens.remaining || 0;
      const limit = freeTokens.limit_per_day || 5000000;
      const used = freeTokens.used_today || 0;
      const remainingM = (remaining / 1000000).toFixed(2);
      const limitM = (limit / 1000000).toFixed(1);
      const pct = Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));

      if (badgeText) {
        badgeText.textContent = `${remainingM}M / ${limitM}M Free`;
      }
      if (quotaCard) {
        quotaCard.title = `xKiro Free Tokens: ${remaining.toLocaleString()} remaining / ${limit.toLocaleString()} limit (Click to view details)`;
      }
      if (sidebarPctEl) {
        sidebarPctEl.textContent = `${pct}%`;
        if (pct <= 15) {
          sidebarPctEl.style.color = '#ef4444';
          sidebarPctEl.style.background = 'rgba(239, 68, 68, 0.12)';
        } else if (pct <= 35) {
          sidebarPctEl.style.color = '#f59e0b';
          sidebarPctEl.style.background = 'rgba(245, 158, 11, 0.12)';
        } else {
          sidebarPctEl.style.color = '#10b981';
          sidebarPctEl.style.background = 'rgba(16, 185, 129, 0.12)';
        }
      }
      if (sidebarFillEl) {
        sidebarFillEl.style.width = `${pct}%`;
        if (pct <= 15) {
          sidebarFillEl.style.background = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
        } else if (pct <= 35) {
          sidebarFillEl.style.background = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
        } else {
          sidebarFillEl.style.background = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
        }
      }
      const pctEl = document.getElementById('quotaTokensPercentage');
      const fillEl = document.getElementById('quotaProgressFill');
      const usedEl = document.getElementById('quotaTokensUsed');
      const limitEl = document.getElementById('quotaTokensLimit');
      const remEl = document.getElementById('quotaTokensRemaining');
      const balEl = document.getElementById('quotaWalletBalance');
      const heldEl = document.getElementById('quotaWalletHeld');
      const planEl = document.getElementById('quotaAccountPlan');

      if (pctEl) pctEl.textContent = `${pct}% Remaining`;
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (usedEl) usedEl.textContent = used.toLocaleString();
      if (limitEl) limitEl.textContent = limit.toLocaleString();
      if (remEl) remEl.textContent = remaining.toLocaleString();
      if (balEl) balEl.textContent = `$${parseFloat(wallet.balance_usd || 0).toFixed(2)} USD`;
      if (heldEl) heldEl.textContent = `$${parseFloat(wallet.held_usd || 0).toFixed(2)} USD`;
      if (planEl) planEl.textContent = u.plan ? String(u.plan).toUpperCase() : 'Free Tier';
    } catch (err) {
      console.warn('Failed to fetch xKiro quota:', err);
    }
  }

  function setupQuotaTracker() {
    const xkiroQuotaBadge = document.getElementById('xkiroQuotaBadge');
    const quotaModal = document.getElementById('quotaModal');
    const btnCloseQuota = document.getElementById('btnCloseQuota');
    const btnCloseQuotaBottom = document.getElementById('btnCloseQuotaBottom');
    const btnRefreshQuota = document.getElementById('btnRefreshQuota');

    if (xkiroQuotaBadge) {
      xkiroQuotaBadge.onclick = () => {
        fetchAndDisplayQuota();
        if (quotaModal) quotaModal.style.display = 'flex';
      };
    }

    const closeQuota = () => {
      if (quotaModal) quotaModal.style.display = 'none';
    };

    if (btnCloseQuota) btnCloseQuota.onclick = closeQuota;
    if (btnCloseQuotaBottom) btnCloseQuotaBottom.onclick = closeQuota;

    if (btnRefreshQuota) {
      btnRefreshQuota.onclick = async () => {
        btnRefreshQuota.disabled = true;
        btnRefreshQuota.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> <span>Refreshing...</span>';
        await fetchAndDisplayQuota();
        btnRefreshQuota.disabled = false;
        btnRefreshQuota.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> <span>Refresh Live Quota</span>';
      };
    }
  }

  // ==========================================================================
  // Discover Content (Modrinth Hub) Handlers
  // ==========================================================================
  let currentDiscoverType = 'plugin';
  let discoverSearchTimer = null;
  let discoverOffset = 0;
  const discoverLimit = 24;
  let isDiscoverLoading = false;
  let allLoadedHits = [];
  let currentDetailProject = null;
  const knownVersionsSet = new Set(['1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5']);
  const knownLoadersSet = new Set(['paper', 'spigot', 'purpur', 'bukkit', 'fabric', 'forge', 'neoforge', 'quilt']);

  function openDiscoverView() {
    const chatPanel = document.getElementById('chatPanel');
    const discoverPanel = document.getElementById('discoverPanel');
    const splitDivider = document.getElementById('splitDivider');
    const consolePanel = document.getElementById('consolePanel');
    if (chatPanel && discoverPanel) {
      chatPanel.style.display = 'none';
      if (splitDivider) splitDivider.style.display = 'none';
      if (consolePanel) consolePanel.style.display = 'none';
      discoverPanel.style.display = 'flex';
      if (allLoadedHits.length === 0) {
        fetchModrinthProjects(true);
      }
    }
  }

  function closeDiscoverView() {
    const chatPanel = document.getElementById('chatPanel');
    const discoverPanel = document.getElementById('discoverPanel');
    if (chatPanel && discoverPanel) {
      discoverPanel.style.display = 'none';
      chatPanel.style.display = 'flex';
    }
  }

  async function fetchModrinthProjects(reset = false) {
    if (isDiscoverLoading) return;
    isDiscoverLoading = true;

    if (reset) {
      discoverOffset = 0;
      allLoadedHits = [];
      const grid = document.getElementById('modrinthGrid');
      if (grid) grid.innerHTML = '';
    }

    const discoverLoading = document.getElementById('discoverLoading');
    const discoverLoadMoreWrap = document.getElementById('discoverLoadMoreWrap');
    const discoverResultCount = document.getElementById('discoverResultCount');
    const searchInput = document.getElementById('modrinthSearchInput');
    const versionSelect = document.getElementById('modrinthVersionSelect');
    const platformSelect = document.getElementById('modrinthPlatformSelect');
    const sortSelect = document.getElementById('modrinthSortSelect');

    if (discoverLoading) discoverLoading.style.display = 'flex';
    if (discoverLoadMoreWrap) discoverLoadMoreWrap.style.display = 'none';

    try {
      const query = searchInput ? searchInput.value.trim() : '';
      const gameVersion = versionSelect ? versionSelect.value : 'all';
      const loader = platformSelect ? platformSelect.value : 'all';
      const sortBy = sortSelect ? sortSelect.value : 'downloads';

      const res = await window.craftAgent.modrinth.search({
        query,
        projectType: currentDiscoverType,
        loader,
        gameVersion,
        sortBy,
        limit: discoverLimit,
        offset: discoverOffset
      });

      if (res && res.success) {
        const hits = res.hits || [];
        allLoadedHits = allLoadedHits.concat(hits);

        // Populate dynamic filters from Modrinth API response
        hits.forEach(h => {
          if (Array.isArray(h.versions)) {
            h.versions.forEach(v => {
              if (typeof v === 'string' && /^\d+(\.\d+)*$/.test(v.trim())) knownVersionsSet.add(v.trim());
            });
          }
          if (Array.isArray(h.categories)) {
            h.categories.forEach(c => {
              if (typeof c === 'string') knownLoadersSet.add(c.toLowerCase());
            });
          }
        });
        updateFilterDropdowns();

        renderModrinthGrid(hits, !reset);

        if (discoverResultCount) {
          const typeLabel = currentDiscoverType.charAt(0).toUpperCase() + currentDiscoverType.slice(1) + 's';
          discoverResultCount.textContent = `Found ${res.totalHits.toLocaleString()} ${typeLabel} on Modrinth (Showing ${allLoadedHits.length})`;
        }

        if (discoverLoadMoreWrap) {
          discoverLoadMoreWrap.style.display = (allLoadedHits.length < res.totalHits) ? 'flex' : 'none';
        }

        discoverOffset += hits.length;
      }
    } catch (err) {
      console.error('Failed to fetch from Modrinth:', err);
      if (discoverResultCount) discoverResultCount.textContent = 'Error loading results. Check internet connection.';
    } finally {
      isDiscoverLoading = false;
      if (discoverLoading) discoverLoading.style.display = 'none';
    }
  }

  function updateFilterDropdowns() {
    const versionSelect = document.getElementById('modrinthVersionSelect');
    const platformSelect = document.getElementById('modrinthPlatformSelect');

    if (versionSelect) {
      const current = versionSelect.value;
      const sortedVersions = Array.from(knownVersionsSet)
        .filter(v => /^\d+(\.\d+)*$/.test(v.trim()))
        .sort(compareMinecraftVersions);
      let vHtml = '<option value="all">All Versions</option>';
      sortedVersions.slice(0, 30).forEach(v => {
        vHtml += `<option value="${v}" ${current === v ? 'selected' : ''}>${v}</option>`;
      });
      versionSelect.innerHTML = vHtml;
    }

    if (platformSelect) {
      const current = platformSelect.value;
      const sortedLoaders = Array.from(knownLoadersSet).sort();
      let lHtml = '<option value="all">All Platforms</option>';
      sortedLoaders.forEach(l => {
        const display = l.charAt(0).toUpperCase() + l.slice(1);
        lHtml += `<option value="${l}" ${current === l ? 'selected' : ''}>${display}</option>`;
      });
      platformSelect.innerHTML = lHtml;
    }
  }

  function formatMetricNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return String(num);
  }

  function renderModrinthGrid(hits, append = false) {
    const grid = document.getElementById('modrinthGrid');
    if (!grid) return;
    if (!append) grid.innerHTML = '';

    if (hits.length === 0 && !append) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No projects found matching your search. Try adjusting filters or search term.</div>';
      return;
    }

    hits.forEach(h => {
      const card = document.createElement('div');
      card.className = 'modrinth-card';
      const iconUrl = h.icon_url || 'assets/logo.png';
      const downloadsFormatted = formatMetricNumber(h.downloads);
      const followsFormatted = formatMetricNumber(h.follows);

      const loadersBadges = (h.categories || []).slice(0, 3).map(c => `<span class="meta-pill pill-loader">${escapeHtml(c)}</span>`).join('');

      card.innerHTML = `
        <div>
          <div class="card-top">
            <img class="card-icon" src="${escapeHtml(iconUrl)}" onerror="this.src='assets/logo.png'" alt="icon" />
            <div class="card-title-area">
              <div class="card-title" title="${escapeHtml(h.title)}">${escapeHtml(h.title)}</div>
              <div class="card-author">by <strong>${escapeHtml(h.author)}</strong></div>
            </div>
          </div>
          <div class="card-desc" title="${escapeHtml(h.description)}">${escapeHtml(h.description)}</div>
          <div class="card-meta-row">
            <span class="meta-pill pill-downloads"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> <span>${downloadsFormatted} dl</span></span>
            <span class="meta-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> <span>${followsFormatted}</span></span>
            ${loadersBadges}
          </div>
        </div>
        <div class="card-actions-row">
          <button class="btn-card-action btn-card-download" type="button" title="View versions & download file">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>View & Download</span>
          </button>
          <button class="btn-card-action btn-card-analyze" type="button" title="Analyze safety & features with Craft Agent AI in a dedicated chat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span>Analyze with AI</span>
          </button>
        </div>
      `;

      card.querySelector('.card-title').onclick = () => openModrinthDetailModal(h);
      card.querySelector('.btn-card-download').onclick = () => openModrinthDetailModal(h);
      card.querySelector('.btn-card-analyze').onclick = (e) => {
        e.stopPropagation();
        triggerAiAnalysis(h);
      };

      grid.appendChild(card);
    });
  }

  let currentProjectVersions = [];
  let dependencyProjectsCache = {};

  function formatLoaderName(loader) {
    if (!loader) return 'All';
    const map = {
      'fabric': 'Fabric',
      'forge': 'Forge',
      'neoforge': 'NeoForge',
      'paper': 'Paper',
      'purpur': 'Purpur',
      'spigot': 'Spigot',
      'bukkit': 'Bukkit',
      'folia': 'Folia',
      'datapack': 'Data Pack',
      'quilt': 'Quilt',
      'sponge': 'Sponge',
      'bungeecord': 'BungeeCord',
      'velocity': 'Velocity',
      'waterfall': 'Waterfall',
      'iris': 'Iris',
      'optifine': 'OptiFine'
    };
    return map[loader.toLowerCase()] || (loader.charAt(0).toUpperCase() + loader.slice(1));
  }

  function compareMinecraftVersions(a, b) {
    const pa = String(a).trim().split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).trim().split('.').map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(pa.length, pb.length);
    for (let i = 0; i < maxLen; i++) {
      const na = pa[i] !== undefined ? pa[i] : 0;
      const nb = pb[i] !== undefined ? pb[i] : 0;
      if (na !== nb) return nb - na; // Descending: newest to oldest
    }
    return 0;
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      const diffWeek = Math.floor(diffDay / 7);
      const diffMonth = Math.floor(diffDay / 30);
      const diffYear = Math.floor(diffDay / 365);

      if (diffYear >= 1) return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
      if (diffMonth >= 1) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
      if (diffWeek >= 1) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
      if (diffDay >= 1) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
      if (diffHour >= 1) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
      if (diffMin >= 1) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
      return 'just now';
    } catch {
      return '';
    }
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function openModrinthDetailModal(project) {
    currentDetailProject = project;
    currentProjectVersions = [];
    const modal = document.getElementById('modrinthDetailModal');
    const icon = document.getElementById('detailProjectIcon');
    const title = document.getElementById('detailProjectTitle');
    const btnQuickInstall = document.getElementById('btnQuickInstallWorkspace');
    const selectGameVer = document.getElementById('selectDlGameVersion');
    const selectPlatform = document.getElementById('selectDlPlatform');
    const releaseDisplay = document.getElementById('modrinthReleaseDisplay');

    if (icon) icon.src = project.icon_url || 'assets/logo.png';
    if (title) title.textContent = project.title;

    if (btnQuickInstall) {
      btnQuickInstall.disabled = false;
      btnQuickInstall.innerHTML = `
        <svg class="modrinth-app-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="m8 12 3 3 5-5"></path>
        </svg>
        <span>Install to Workspace</span>
      `;
    }

    if (selectGameVer) selectGameVer.innerHTML = '<option value="">Select game version</option>';
    if (selectPlatform) selectPlatform.innerHTML = '<option value="">Select platform</option>';
    if (releaseDisplay) {
      releaseDisplay.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted);">
          <div style="margin-bottom: 8px;">Fetching available releases from Modrinth...</div>
        </div>
      `;
    }

    if (modal) modal.style.display = 'flex';

    try {
      const vRes = await window.craftAgent.modrinth.getVersions(project.slug || project.project_id);
      if (vRes && vRes.success && Array.isArray(vRes.versions) && vRes.versions.length > 0) {
        currentProjectVersions = vRes.versions;

        // 1. Unique official game versions only (strictly numbers & dots, exclude beta / snapshots with letters)
        const gameVersionsSet = new Set();
        currentProjectVersions.forEach(v => {
          (v.game_versions || []).forEach(gv => {
            const trimmed = String(gv).trim();
            // Official release versions have ONLY numbers and dots (e.g. 26.2, 1.21.1)
            // Filter out snapshot/beta versions that contain letters (e.g. 26.3-pre-2, 24w14a)
            if (/^\d+(\.\d+)*$/.test(trimmed)) {
              gameVersionsSet.add(trimmed);
            }
          });
        });
        // Sort descending from newest to oldest
        const gameVersionsList = Array.from(gameVersionsSet).sort(compareMinecraftVersions);

        // 2. Unique platforms / loaders
        const platformsSet = new Set();
        currentProjectVersions.forEach(v => {
          (v.loaders || []).forEach(l => platformsSet.add(l.toLowerCase()));
        });
        const platformsList = Array.from(platformsSet);

        // Populate Game Versions dropdown
        if (selectGameVer) {
          selectGameVer.innerHTML = '<option value="">Select game version</option>';
          gameVersionsList.forEach(gv => {
            const opt = document.createElement('option');
            opt.value = gv;
            opt.textContent = gv;
            selectGameVer.appendChild(opt);
          });
        }

        // Populate Platforms dropdown
        if (selectPlatform) {
          selectPlatform.innerHTML = '<option value="">Select platform</option>';
          platformsList.forEach(plat => {
            const opt = document.createElement('option');
            opt.value = plat;
            opt.textContent = formatLoaderName(plat);
            selectPlatform.appendChild(opt);
          });
        }

        // Auto-select latest official version & platform
        let defaultVer = gameVersionsList[0] || '';
        let defaultPlat = '';

        for (const v of currentProjectVersions) {
          const matchedOfficial = (v.game_versions || []).find(gv => gameVersionsList.includes(gv));
          if (matchedOfficial) {
            defaultVer = matchedOfficial;
            defaultPlat = (v.loaders && v.loaders[0]?.toLowerCase()) || platformsList[0] || '';
            break;
          }
        }
        if (!defaultPlat) defaultPlat = platformsList[0] || '';

        if (selectGameVer) selectGameVer.value = defaultVer;
        if (selectPlatform) selectPlatform.value = defaultPlat;

        // Wire dropdown change events
        selectGameVer.onchange = () => renderSelectedRelease(selectGameVer.value, selectPlatform.value);
        selectPlatform.onchange = () => renderSelectedRelease(selectGameVer.value, selectPlatform.value);

        // Wire Quick Install button
        if (btnQuickInstall) {
          btnQuickInstall.onclick = async () => {
            const targetVersion = getMatchedRelease(selectGameVer.value, selectPlatform.value) || currentProjectVersions[0];
            if (!targetVersion) return;
            const primaryFile = (targetVersion.files && targetVersion.files.length > 0)
              ? (targetVersion.files.find(f => f.primary) || targetVersion.files[0])
              : null;
            if (!primaryFile) return;

            btnQuickInstall.disabled = true;
            btnQuickInstall.innerHTML = '<span>Installing to workspace...</span>';

            try {
              const dlRes = await window.craftAgent.modrinth.downloadFile({
                fileUrl: primaryFile.url,
                targetFilename: primaryFile.filename,
                projectType: currentDetailProject.project_type || currentDiscoverType
              });
              if (dlRes && dlRes.success) {
                btnQuickInstall.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Installed to ${escapeHtml(dlRes.relativePath)}</span>
                `;
              } else {
                btnQuickInstall.innerHTML = '<span>Installation failed</span>';
                setTimeout(() => {
                  btnQuickInstall.disabled = false;
                  btnQuickInstall.innerHTML = '<span>Install to Workspace</span>';
                }, 2500);
              }
            } catch (dlErr) {
              btnQuickInstall.innerHTML = '<span>Error installing</span>';
            }
          };
        }

        // Render current selection
        await renderSelectedRelease(defaultVer, defaultPlat);
      } else {
        if (releaseDisplay) {
          releaseDisplay.innerHTML = `
            <div class="modrinth-empty-state">
              <div style="font-weight: 600; color: #f0f6fc; margin-bottom: 4px;">No Releases Available</div>
              <span>No published files found for this project on Modrinth.</span>
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('Failed to get versions:', err);
      if (releaseDisplay) {
        releaseDisplay.innerHTML = `
          <div class="modrinth-empty-state" style="border-color: rgba(248, 81, 73, 0.4);">
            <div style="font-weight: 600; color: #f85149; margin-bottom: 4px;">Error Loading Releases</div>
            <span>${escapeHtml(err.message || 'Network error occurred while fetching versions.')}</span>
          </div>
        `;
      }
    }
  }

  function getMatchedRelease(gameVer, platform) {
    if (!currentProjectVersions || currentProjectVersions.length === 0) return null;
    return currentProjectVersions.find(v => {
      const matchVer = !gameVer || (v.game_versions || []).includes(gameVer);
      const matchPlat = !platform || (v.loaders || []).map(l => l.toLowerCase()).includes(platform.toLowerCase());
      return matchVer && matchPlat;
    });
  }

  async function renderSelectedRelease(gameVer, platform) {
    const container = document.getElementById('modrinthReleaseDisplay');
    if (!container) return;

    if (!gameVer || !platform) {
      container.innerHTML = `
        <div class="modrinth-empty-state">
          <span>Select both game version and platform above to view downloadable files.</span>
        </div>
      `;
      return;
    }

    const matched = getMatchedRelease(gameVer, platform);
    if (!matched) {
      container.innerHTML = `
        <div class="modrinth-empty-state">
          <div style="font-weight: 600; color: #f0f6fc; margin-bottom: 4px;">No Compatible Release Found</div>
          <span>No release found for Minecraft <strong>${escapeHtml(gameVer)}</strong> on <strong>${escapeHtml(formatLoaderName(platform))}</strong>.<br>Please select a different version or platform.</span>
        </div>
      `;
      return;
    }

    const primaryFile = (matched.files && matched.files.length > 0)
      ? (matched.files.find(f => f.primary) || matched.files[0])
      : null;

    if (!primaryFile) {
      container.innerHTML = `
        <div class="modrinth-empty-state">
          <span>No downloadable files attached to release ${escapeHtml(matched.version_number)}.</span>
        </div>
      `;
      return;
    }

    const badgeClass = matched.version_type === 'beta' ? 'badge-beta' : (matched.version_type === 'alpha' ? 'badge-alpha' : 'badge-release');
    const timeAgo = formatRelativeTime(matched.date_published);
    const fileSize = formatFileSize(primaryFile.size);

    // Check dependencies
    const validDeps = Array.isArray(matched.dependencies) ? matched.dependencies.filter(d => d.project_id) : [];
    const hasDeps = validDeps.length > 0;

    // Pre-resolve dependency project names/icons if not cached
    const missingDepIds = validDeps.filter(d => !dependencyProjectsCache[d.project_id]).map(d => d.project_id);
    if (missingDepIds.length > 0) {
      try {
        const depRes = await window.craftAgent.modrinth.getProjects(missingDepIds);
        if (depRes && depRes.success && Array.isArray(depRes.projects)) {
          depRes.projects.forEach(p => {
            dependencyProjectsCache[p.id] = p;
          });
        }
      } catch (depErr) {
        console.warn('Failed to resolve dependency projects:', depErr);
      }
    }

    let depsHtml = '';
    if (hasDeps) {
      let depItemsHtml = '';
      validDeps.forEach(dep => {
        const depProject = dependencyProjectsCache[dep.project_id];
        const depTitle = depProject ? depProject.title : (dep.file_name || 'Required Mod');
        const depIcon = depProject?.icon_url || 'assets/logo.png';
        const depTypeLabel = dep.dependency_type === 'optional' ? 'Optional' : 'Any compatible';

        depItemsHtml += `
          <div class="modrinth-dep-item" data-dep-id="${dep.project_id}">
            <div class="modrinth-dep-left">
              <img src="${escapeHtml(depIcon)}" alt="dep" class="modrinth-dep-icon" />
              <div class="modrinth-dep-name">${escapeHtml(depTitle)}</div>
              <div class="modrinth-dep-badge">${escapeHtml(depTypeLabel)}</div>
            </div>
            <button class="btn-modrinth-icon-dl btn-dep-dl" data-dep-id="${dep.project_id}" data-dep-title="${escapeHtml(depTitle)}" title="Download ${escapeHtml(depTitle)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>
        `;
      });

      depsHtml = `
        <div class="modrinth-deps-section">
          <div class="modrinth-deps-title">Dependencies</div>
          <div class="modrinth-deps-list">
            ${depItemsHtml}
          </div>
        </div>
      `;
    }

    // Build the complete card and actions
    const fileExt = primaryFile.filename.split('.').pop() || 'jar';

    container.innerHTML = `
      <!-- Main Release Card -->
      <div class="modrinth-release-card">
        <div class="modrinth-release-left">
          <div class="modrinth-release-title-row">
            <span class="modrinth-release-version-name">${escapeHtml(matched.version_number || matched.name)}</span>
            <span class="modrinth-release-badge ${badgeClass}">${escapeHtml(matched.version_type || 'Release')}</span>
          </div>
          <div class="modrinth-release-meta">
            <span>${escapeHtml(timeAgo)} • ${escapeHtml(fileSize)}</span>
          </div>
        </div>
        <button id="btnDlCardIcon" class="btn-modrinth-icon-dl" title="Download ${escapeHtml(primaryFile.filename)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>

      <!-- Dependencies -->
      ${depsHtml}

      <!-- Bottom Actions -->
      <div class="modrinth-dl-bottom-row">
        <button id="btnDetailAnalyzeRelease" class="btn-dl-ai-audit" title="Audit this specific version with AI">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>Analyze with AI</span>
        </button>

        <button id="btnDlPrimaryFile" class="btn-dl-secondary" title="Download ${escapeHtml(primaryFile.filename)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download (.${escapeHtml(fileExt)})</span>
        </button>

        ${hasDeps ? `
          <button id="btnDlWithDeps" class="btn-dl-deps-primary" title="Download mod and all required dependencies">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download with deps</span>
          </button>
        ` : ''}
      </div>
    `;

    // Wire individual release download button (card icon)
    const btnCardIcon = container.querySelector('#btnDlCardIcon');
    if (btnCardIcon) {
      btnCardIcon.onclick = () => handleDownloadPrimaryFile(matched, primaryFile, btnCardIcon);
    }

    // Wire bottom download button
    const btnDlPrimary = container.querySelector('#btnDlPrimaryFile');
    if (btnDlPrimary) {
      btnDlPrimary.onclick = () => handleDownloadPrimaryFile(matched, primaryFile, btnDlPrimary);
    }

    // Wire AI audit button
    const btnAudit = container.querySelector('#btnDetailAnalyzeRelease');
    if (btnAudit) {
      btnAudit.onclick = () => {
        closeModrinthDetailModal();
        triggerAiAnalysis(currentDetailProject, matched);
      };
    }

    // Wire Download with deps button
    const btnDlDeps = container.querySelector('#btnDlWithDeps');
    if (btnDlDeps) {
      btnDlDeps.onclick = () => handleDownloadWithDeps(matched, primaryFile, validDeps, gameVer, platform, btnDlDeps);
    }

    // Wire individual dependency download buttons
    container.querySelectorAll('.btn-dep-dl').forEach(depBtn => {
      depBtn.onclick = async () => {
        const depId = depBtn.getAttribute('data-dep-id');
        const depTitle = depBtn.getAttribute('data-dep-title');
        await handleDownloadSingleDependency(depId, depTitle, gameVer, platform, depBtn);
      };
    });
  }

  async function handleDownloadPrimaryFile(version, file, btn) {
    if (!file) return;
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    if (btn.tagName === 'BUTTON' && btn.classList.contains('btn-modrinth-icon-dl')) {
      btn.innerHTML = '<span style="font-size: 11px;">...</span>';
    } else {
      btn.innerHTML = '<span>Downloading...</span>';
    }

    try {
      const dlRes = await window.craftAgent.modrinth.downloadFile({
        fileUrl: file.url,
        targetFilename: file.filename,
        projectType: currentDetailProject?.project_type || currentDiscoverType
      });

      if (dlRes && dlRes.success) {
        if (btn.classList.contains('btn-modrinth-icon-dl')) {
          btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Downloaded</span>';
          btn.style.color = '#22c55e';
          btn.style.borderColor = '#22c55e';
        }
      } else {
        btn.innerHTML = '<span>Failed</span>';
        setTimeout(() => { btn.disabled = false; btn.innerHTML = origHtml; }, 2000);
      }
    } catch (err) {
      console.error('Download error:', err);
      btn.innerHTML = '<span>Error</span>';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = origHtml; }, 2000);
    }
  }

  async function handleDownloadSingleDependency(depProjectId, depTitle, gameVer, platform, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="font-size: 10px;">...</span>';

    try {
      // Find compatible release for this dependency
      const depVersionsRes = await window.craftAgent.modrinth.getVersions(depProjectId, [platform], [gameVer]);
      const depVersions = (depVersionsRes && depVersionsRes.success) ? depVersionsRes.versions : [];
      const match = depVersions[0] || null;
      const file = match?.files?.find(f => f.primary) || match?.files?.[0];

      if (file) {
        const dlRes = await window.craftAgent.modrinth.downloadFile({
          fileUrl: file.url,
          targetFilename: file.filename,
          projectType: 'mod'
        });

        if (dlRes && dlRes.success) {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else {
          btn.innerHTML = '<span style="font-size: 10px;">!</span>';
        }
      } else {
        btn.innerHTML = '<span style="font-size: 10px;">N/A</span>';
      }
    } catch (err) {
      console.error('Failed to download dependency:', err);
      btn.innerHTML = '<span style="font-size: 10px;">Err</span>';
    }
  }

  async function handleDownloadWithDeps(version, primaryFile, deps, gameVer, platform, btn) {
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Downloading with deps...</span>';

    try {
      // 1. Download primary file
      await window.craftAgent.modrinth.downloadFile({
        fileUrl: primaryFile.url,
        targetFilename: primaryFile.filename,
        projectType: currentDetailProject?.project_type || currentDiscoverType
      });

      // 2. Download all required dependencies
      for (const dep of deps) {
        try {
          const depVersionsRes = await window.craftAgent.modrinth.getVersions(dep.project_id, [platform], [gameVer]);
          const depVersions = (depVersionsRes && depVersionsRes.success) ? depVersionsRes.versions : [];
          const match = depVersions[0] || null;
          const file = match?.files?.find(f => f.primary) || match?.files?.[0];
          if (file) {
            await window.craftAgent.modrinth.downloadFile({
              fileUrl: file.url,
              targetFilename: file.filename,
              projectType: 'mod'
            });
          }
        } catch (depErr) {
          console.warn('Dependency download error:', dep.project_id, depErr);
        }
      }

      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Downloaded with deps!</span>
      `;
    } catch (err) {
      console.error('Download with deps failed:', err);
      btn.innerHTML = '<span>Download failed</span>';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = origHtml; }, 2500);
    }
  }

  function closeModrinthDetailModal() {
    const modal = document.getElementById('modrinthDetailModal');
    if (modal) modal.style.display = 'none';
    currentDetailProject = null;
    currentProjectVersions = [];
  }

  async function triggerAiAnalysis(project, selectedVersion = null) {
    // 1. Create dedicated analysis session isolated from main coding chat
    const analysisTitle = `[Audit] ${project.title}`;
    const newSessionId = `session_audit_${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: analysisTitle,
      type: 'analysis',
      projectSlug: project.slug,
      messages: [],
      createdAt: Date.now()
    };

    sessions.unshift(newSession);
    saveSessionsToStorage();
    renderSessionsList();
    await switchSession(newSessionId);

    // 2. Return to chat interface
    closeDiscoverView();

    // 3. Formulate /analyze command prompt with Modrinth URL
    const projectType = project.project_type || currentDiscoverType || 'plugin';
    let projectUrl = `https://modrinth.com/${projectType}/${project.slug}`;
    if (selectedVersion && selectedVersion.version_number) {
      projectUrl += `/version/${selectedVersion.version_number}`;
    }

    const promptText = `/analyze ${projectUrl}`;

    // 4. Send directly to AI
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.value = promptText;
      sendMessage();
    }
  }

  function setupDiscoverContent() {
    const btnDiscoverContent = document.getElementById('btnDiscoverContent');
    const btnBackToChat = document.getElementById('btnBackToChat');
    const searchInput = document.getElementById('modrinthSearchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');
    const versionSelect = document.getElementById('modrinthVersionSelect');
    const platformSelect = document.getElementById('modrinthPlatformSelect');
    const sortSelect = document.getElementById('modrinthSortSelect');
    const pillTabs = document.getElementById('modrinthPillTabs');
    const btnLoadMore = document.getElementById('btnModrinthLoadMore');
    const btnCloseDetail = document.getElementById('btnCloseModrinthDetail');
    const btnCloseDetailBottom = document.getElementById('btnCloseModrinthDetailBottom');

    if (btnDiscoverContent) {
      btnDiscoverContent.onclick = openDiscoverView;
    }
    if (btnBackToChat) {
      btnBackToChat.onclick = closeDiscoverView;
    }

    if (btnCloseDetail) btnCloseDetail.onclick = closeModrinthDetailModal;
    if (btnCloseDetailBottom) btnCloseDetailBottom.onclick = closeModrinthDetailModal;

    // Pill Tab Switching (Mods, Resource Packs, Data Packs, Shaders, Modpacks, Plugins)
    if (pillTabs) {
      pillTabs.querySelectorAll('.modrinth-pill-btn').forEach(btn => {
        btn.onclick = () => {
          pillTabs.querySelectorAll('.modrinth-pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentDiscoverType = btn.getAttribute('data-type');
          fetchModrinthProjects(true);
        };
      });
    }

    // Debounced search input
    if (searchInput) {
      searchInput.oninput = () => {
        if (btnClearSearch) btnClearSearch.style.display = searchInput.value ? 'block' : 'none';
        clearTimeout(discoverSearchTimer);
        discoverSearchTimer = setTimeout(() => {
          fetchModrinthProjects(true);
        }, 350);
      };
    }

    if (btnClearSearch && searchInput) {
      btnClearSearch.onclick = () => {
        searchInput.value = '';
        btnClearSearch.style.display = 'none';
        fetchModrinthProjects(true);
      };
    }

    if (versionSelect) {
      versionSelect.onchange = () => fetchModrinthProjects(true);
    }
    if (platformSelect) {
      platformSelect.onchange = () => fetchModrinthProjects(true);
    }
    if (sortSelect) {
      sortSelect.onchange = () => fetchModrinthProjects(true);
    }

    if (btnLoadMore) {
      btnLoadMore.onclick = () => fetchModrinthProjects(false);
    }
  }
  function formatMarkdown(text) {
    if (!text) return '';

    // 1. Stash Code blocks
    const codeBlocks = [];
    let processed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      const escaped = escapeHtml(code.trim());
      const langLabel = lang ? `<span style="position: absolute; top: 6px; left: 12px; font-size: 10px; color: var(--text-muted); text-transform: uppercase;">${lang}</span>` : '';
      codeBlocks.push(`<pre>${langLabel}<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 1500)">Copy</button><code>${escaped}</code></pre>`);
      return `@@BLOCK_CODE_${idx}@@`;
    });

    // 2. Stash Inline code
    const inlineCodes = [];
    processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
      return `@@INLINE_CODE_${idx}@@`;
    });

    // 3. Headers
    processed = processed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    processed = processed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    processed = processed.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 4. Bold and Italic
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Structure into paragraphs, lists, and headers
    const rawBlocks = processed.split(/\n{2,}/);
    const resultBlocks = [];

    for (const rawBlock of rawBlocks) {
      const trimmed = rawBlock.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('@@BLOCK_CODE_') || trimmed.startsWith('<h1') || trimmed.startsWith('<h2') || trimmed.startsWith('<h3')) {
        resultBlocks.push(trimmed);
        continue;
      }

      const lines = trimmed.split('\n');
      const isUnordered = lines.every(l => /^\s*[-*•]\s+/.test(l));
      const isOrdered = lines.every(l => /^\s*\d+\.\s+/.test(l));

      if (isUnordered) {
        const listItems = lines.map(l => {
          const content = l.replace(/^\s*[-*•]\s+/, '').trim();
          return `<li>${content}</li>`;
        }).join('');
        resultBlocks.push(`<ul>${listItems}</ul>`);
      } else if (isOrdered) {
        const listItems = lines.map(l => {
          const content = l.replace(/^\s*\d+\.\s+/, '').trim();
          return `<li>${content}</li>`;
        }).join('');
        resultBlocks.push(`<ol>${listItems}</ol>`);
      } else {
        // Mixed text or standard paragraphs with embedded list items
        let inUl = false;
        let inOl = false;
        let currentP = [];
        let subHtml = '';

        const flushP = () => {
          if (currentP.length > 0) {
            subHtml += `<p>${currentP.join('<br>')}</p>`;
            currentP = [];
          }
        };

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (/^[-*•]\s+/.test(trimmedLine)) {
            flushP();
            if (inOl) { subHtml += '</ol>'; inOl = false; }
            if (!inUl) { subHtml += '<ul>'; inUl = true; }
            subHtml += `<li>${trimmedLine.replace(/^[-*•]\s+/, '')}</li>`;
          } else if (/^\d+\.\s+/.test(trimmedLine)) {
            flushP();
            if (inUl) { subHtml += '</ul>'; inUl = false; }
            if (!inOl) { subHtml += '<ol>'; inOl = true; }
            subHtml += `<li>${trimmedLine.replace(/^\d+\.\s+/, '')}</li>`;
          } else {
            if (inUl) { subHtml += '</ul>'; inUl = false; }
            if (inOl) { subHtml += '</ol>'; inOl = false; }
            currentP.push(trimmedLine);
          }
        }
        flushP();
        if (inUl) subHtml += '</ul>';
        if (inOl) subHtml += '</ol>';

        resultBlocks.push(subHtml);
      }
    }

    // Merge adjacent <ul>...</ul> or <ol>...</ol> blocks so they form a single tight list
    let html = resultBlocks.join('')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/<\/ol>\s*<ol>/g, '');

    // 6. Restore code blocks & inline code
    html = html.replace(/@@BLOCK_CODE_(\d+)@@/g, (_, idx) => codeBlocks[idx] || '');
    html = html.replace(/@@INLINE_CODE_(\d+)@@/g, (_, idx) => inlineCodes[idx] || '');

    return html;
  }

  function addCopyButtons(container) {
    container.querySelectorAll('pre').forEach(pre => {
      if (!pre.querySelector('.code-copy-btn')) {
        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.textContent = 'Copy';
        btn.onclick = () => {
          const code = pre.querySelector('code')?.innerText || '';
          navigator.clipboard.writeText(code);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        };
        pre.appendChild(btn);
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run initial setup
  initApp();
});
