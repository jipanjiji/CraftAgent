// Settings Page Script
document.addEventListener('DOMContentLoaded', async () => {
  const cfgBaseUrl = document.getElementById('cfgBaseUrl');
  const cfgApiKey = document.getElementById('cfgApiKey');
  const btnToggleApiKey = document.getElementById('btnToggleApiKey');
  const cfgModel = document.getElementById('cfgModel');
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
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnResetSettings = document.getElementById('btnResetSettings');

  let currentSettings = null;

  async function loadSettings() {
    try {
      const catalog = await window.craftAgent.getModelsCatalog();
      cfgModel.innerHTML = '';
      for (const [vendor, models] of Object.entries(catalog)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = vendor;
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = `${m.name} (${m.id})`;
          optgroup.appendChild(opt);
        });
        cfgModel.appendChild(optgroup);
      }

      currentSettings = await window.craftAgent.getSettings();
      populateUI(currentSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  function populateUI(cfg) {
    if (!cfg) return;
    cfgBaseUrl.value = cfg.api.baseUrl || 'https://api.xkiro.com/v1';
    cfgApiKey.value = cfg.api.apiKey || '';
    if (cfg.api.model) cfgModel.value = cfg.api.model;
    if (cfgSecurityMode && cfg.security && cfg.security.mode) {
      cfgSecurityMode.value = cfg.security.mode;
    }
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

    const updated = {
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
        maxMessages: parseInt(cfgMaxMessages.value, 10) || 15,
        maxTokenBudget: tokenBudget
      },
      ignoredFolders: ignoredArr
    };

    const res = await window.craftAgent.saveSettings(updated);
    if (res.success) {
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings: ' + res.error);
    }
  });

  btnResetSettings.addEventListener('click', async () => {
    if (confirm('Reset to factory default settings?')) {
      const reset = await window.craftAgent.resetSettings();
      populateUI(reset);
    }
  });

  loadSettings();
});
