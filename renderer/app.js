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
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  function populateModelDropdown(catalog, filterQuery = '') {
    if (catalog) cachedModelCatalog = catalog;
    if (!cachedModelCatalog) return;

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

    // Preserve previously selected value if present in filtered list
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
    if (cfg.api.model) {
      cfgModel.value = cfg.api.model;
      const modelShort = cfg.api.model.split('/')[1] || cfg.api.model;
      currentModelName.textContent = modelShort;
    }
    if (cfgSecurityMode) {
      cfgSecurityMode.value = (cfg.security && cfg.security.mode) ? cfg.security.mode : 'approval';
    }
    cfgDefaultTimeout.value = cfg.terminal.defaultTimeout || 60;
    timeoutValLabel.textContent = `${cfgDefaultTimeout.value}s`;
    cfgShell.value = cfg.terminal.shell || 'powershell';
    
    cfgMaxReadSize.value = cfg.fileManager.maxReadSize || 512000;
    readSizeLabel.textContent = `${Math.round(cfgMaxReadSize.value / 1024)} KB`;

    cfgMaxMessages.value = cfg.history.maxMessages || 15;
    historySizeLabel.textContent = `${cfgMaxMessages.value} messages`;

    cfgIgnoredFolders.value = (cfg.ignoredFolders || []).join(', ');
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

  function deleteSession(sessionId, e) {
    if (e) e.stopPropagation();

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

  function renderSessionsList() {
    sessionsList.innerHTML = '';
    if (sessions.length === 0) {
      sessionsList.innerHTML = '<div style="padding: 16px 12px; font-size: 11px; color: var(--text-muted); text-align: center;">No saved chats yet</div>';
      return;
    }

    sessions.forEach(sess => {
      const item = document.createElement('div');
      item.className = `session-item ${(!isDraftSession && sess.id === currentSessionId) ? 'active' : ''}`;
      item.innerHTML = `
        <span class="session-item-title" title="${escapeHtml(sess.title)}">${escapeHtml(sess.title)}</span>
        <button class="session-delete-btn" title="Delete Session">&times;</button>
      `;

      item.onclick = () => switchSession(sess.id);
      item.querySelector('.session-delete-btn').onclick = (e) => deleteSession(sess.id, e);

      sessionsList.appendChild(item);
    });
  }

  btnNewChat.addEventListener('click', () => openNewChatDraft());
  btnNewChatSidebar.addEventListener('click', () => openNewChatDraft());

  btnToggleSidebar.addEventListener('click', () => {
    sessionsSidebar.classList.toggle('collapsed');
    localStorage.setItem('craft_sidebar_collapsed', sessionsSidebar.classList.contains('collapsed'));
  });

  // 3. Console Activity Log Toggle (Hide / Show)
  function toggleConsoleVisibility() {
    const isHidden = mainSplitView.classList.toggle('console-hidden');
    localStorage.setItem('craft_console_hidden', isHidden);
  }

  btnToggleConsole.addEventListener('click', toggleConsoleVisibility);
  btnCollapseConsole.addEventListener('click', toggleConsoleVisibility);

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
        const icon = att.name.endsWith('.jar') ? '☕' : (att.name.endsWith('.zip') ? '📦' : '📄');
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
            const icon = f.name.endsWith('.jar') ? '☕' : (f.name.endsWith('.zip') ? '📦' : '📄');
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
    scrollChatBottom();
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
    scrollChatBottom();

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
      <div class="message-bubble" style="color: var(--danger); font-weight: 500;">
        ⚠️ ${escapeHtml(errorMsg)}
      </div>
    `;
    chatMessages.appendChild(errDiv);
    scrollChatBottom();
  }

  function scrollChatBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
        let text = '';
        if (data.result.content) text = data.result.content;
        else if (data.result.tree) text = data.result.tree;
        else if (data.result.stdout || data.result.stderr) text = (data.result.stdout || '') + '\n' + (data.result.stderr || '');
        else if (data.result.results) text = JSON.stringify(data.result.results, null, 2);
        else text = JSON.stringify(data.result, null, 2);

        body.textContent = text;
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
  });

  // 11. Human-In-The-Loop Approval (Terminal & External Path)
  window.craftAgent.onTerminalConfirmRequest((req) => {
    activeTerminalRequestId = req.id;

    if (req.type === 'EXTERNAL_PATH') {
      if (confirmModalTitle) confirmModalTitle.textContent = 'External Path Access Approval';
      if (confirmModalDesc) confirmModalDesc.textContent = `Craft Agent requests permission to ${req.action.replace('_', ' ')} on a file or folder outside your active workspace:`;
      if (confirmModalSubtext) confirmModalSubtext.textContent = '⚠️ This file/folder is outside your active workspace. Only approve if you explicitly asked Craft Agent to access it.';
      confirmCommandText.textContent = req.path;
      confirmCwd.textContent = req.action.toUpperCase();
      confirmTimeout.textContent = req.description || 'External Path Access';
    } else {
      if (confirmModalTitle) confirmModalTitle.textContent = 'Terminal Command Approval';
      if (confirmModalDesc) confirmModalDesc.textContent = 'Craft Agent requests permission to execute the following shell command in your workspace directory:';
      if (confirmModalSubtext) confirmModalSubtext.textContent = '⚠️ Only approve commands you trust. Execution runs on your local machine.';
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

  btnSaveSettings.addEventListener('click', async () => {
    const ignoredArr = cfgIgnoredFolders.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const updatedConfig = {
      api: {
        baseUrl: cfgBaseUrl.value.trim() || 'https://api.xkiro.com/v1',
        apiKey: cfgApiKey.value.trim(),
        model: cfgModel.value
      },
      security: {
        mode: cfgSecurityMode ? cfgSecurityMode.value : 'approval'
      },
      terminal: {
        defaultTimeout: parseInt(cfgDefaultTimeout.value, 10) || 60,
        shell: cfgShell.value
      },
      fileManager: {
        maxReadSize: parseInt(cfgMaxReadSize.value, 10) || 512000
      },
      history: {
        maxMessages: parseInt(cfgMaxMessages.value, 10) || 15
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

  // Markdown Formatter (Robust, tight lists, clean paragraph spacing)
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
