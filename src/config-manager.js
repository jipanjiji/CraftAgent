const fs = require('fs');
const path = require('path');

// Complete catalog of 100+ xKiro models grouped by vendor
const MODELS_CATALOG = {
  "OpenAI": [
    { id: "openai/gpt-5.6-sol", name: "GPT-5.6 Sol (Flagship)" },
    { id: "openai/gpt-5.6-terra", name: "GPT-5.6 Terra (Balanced - Default)" },
    { id: "openai/gpt-5.6-luna", name: "GPT-5.6 Luna (Fast)" },
    { id: "openai/gpt-5.5", name: "GPT-5.5" },
    { id: "openai/gpt-5.4", name: "GPT-5.4" },
    { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini" },
    { id: "openai/gpt-5.3-codex-spark", name: "GPT-5.3 Codex Spark (Coding)" }
  ],
  "Anthropic": [
    { id: "anthropic/claude-fable-5", name: "Claude Fable 5" },
    { id: "anthropic/claude-opus-5", name: "Claude Opus 5" },
    { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8" },
    { id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7" },
    { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6" },
    { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5" },
    { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
    { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" }
  ],
  "Google": [
    { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
    { id: "google/gemini-3.7-flash", name: "Gemini 3.7 Flash" },
    { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash" },
    { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash" },
    { id: "google/gemini-3.1-pro", name: "Gemini 3.1 Pro" },
    { id: "google/gemini-3-flash", name: "Gemini 3 Flash" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" }
  ],
  "xAI (Grok)": [
    { id: "x-ai/grok-4.6", name: "Grok 4.6" },
    { id: "x-ai/grok-4.5", name: "Grok 4.5" },
    { id: "x-ai/grok-build-0.1", name: "Grok Build 0.1" }
  ],
  "Moonshot AI (Kimi)": [
    { id: "moonshotai/kimi-k3", name: "Kimi K3" },
    { id: "moonshotai/kimi-k2.7-code", name: "Kimi K2.7 Code" },
    { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6" },
    { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5" }
  ],
  "Mistral": [
    { id: "mistralai/mistral-large-2512", name: "Mistral Large 2512" },
    { id: "mistralai/mistral-medium-3.5", name: "Mistral Medium 3.5" },
    { id: "mistralai/mistral-small-2603", name: "Mistral Small 2603" },
    { id: "mistralai/codestral-2508", name: "Codestral 2508 (Coding)" },
    { id: "mistralai/devstral-medium", name: "Devstral Medium" },
    { id: "mistralai/ministral-14b", name: "Ministral 14B" },
    { id: "mistralai/ministral-8b", name: "Ministral 8B" },
    { id: "mistralai/ministral-3b", name: "Ministral 3B" }
  ],
  "GLM (Z.ai)": [
    { id: "z-ai/glm-5.3-flash", name: "GLM-5.3 Flash" },
    { id: "z-ai/glm-5.3", name: "GLM-5.3" },
    { id: "z-ai/glm-5.2", name: "GLM-5.2" },
    { id: "z-ai/glm-5.1", name: "GLM-5.1" },
    { id: "z-ai/glm-5-turbo", name: "GLM-5 Turbo" },
    { id: "z-ai/glm-5", name: "GLM-5" },
    { id: "z-ai/glm-4.7", name: "GLM-4.7" },
    { id: "z-ai/glm-4.6", name: "GLM-4.6" },
    { id: "z-ai/glm-4.5", name: "GLM-4.5" },
    { id: "z-ai/glm-4.5-air", name: "GLM-4.5 Air" },
    { id: "z-ai/glm-4.7-flashx", name: "GLM-4.7 FlashX" },
    { id: "z-ai/glm-4.7-flash", name: "GLM-4.7 Flash" },
    { id: "z-ai/glm-4.5-x", name: "GLM-4.5 X" },
    { id: "z-ai/glm-4.5-airx", name: "GLM-4.5 AirX" },
    { id: "z-ai/glm-4.5-flash", name: "GLM-4.5 Flash" },
    { id: "z-ai/glm-5v-turbo", name: "GLM-5V Turbo" },
    { id: "z-ai/glm-4.6v", name: "GLM-4.6V" },
    { id: "z-ai/glm-4.6v-flashx", name: "GLM-4.6V FlashX" },
    { id: "z-ai/glm-4.6v-flash", name: "GLM-4.6V Flash" },
    { id: "z-ai/glm-4.5v", name: "GLM-4.5V" }
  ],
  "MiniMax": [
    { id: "minimax/minimax-m3", name: "MiniMax M3" },
    { id: "minimax/minimax-m2.7", name: "MiniMax M2.7" },
    { id: "minimax/minimax-m2.5", name: "MiniMax M2.5" },
    { id: "minimax/minimax-m3:free", name: "MiniMax M3 (Free)" },
    { id: "minimax/minimax-m2.7:free", name: "MiniMax M2.7 (Free)" },
    { id: "minimax/minimax-m2.7-highspeed:free", name: "MiniMax M2.7 Highspeed (Free)" },
    { id: "minimax/minimax-m2.5:free", name: "MiniMax M2.5 (Free)" },
    { id: "minimax/minimax-m2.5-highspeed:free", name: "MiniMax M2.5 Highspeed (Free)" },
    { id: "minimax/minimax-m2.1:free", name: "MiniMax M2.1 (Free)" },
    { id: "minimax/minimax-m2.1-highspeed:free", name: "MiniMax M2.1 Highspeed (Free)" },
    { id: "minimax/minimax-m2:free", name: "MiniMax M2 (Free)" }
  ],
  "Xiaomi (MiMo)": [
    { id: "xiaomi/mimo-v2.5-pro", name: "MiMo v2.5 Pro" },
    { id: "xiaomi/mimo-v2.5", name: "MiMo v2.5" }
  ],
  "DeepSeek": [
    { id: "deepseek/deepseek-v4-flash-vision-exp", name: "DeepSeek V4 Flash Vision Exp" },
    { id: "deepseek/deepseek-v4-pro-0813", name: "DeepSeek V4 Pro 0813" },
    { id: "deepseek/deepseek-v4-flash-0731", name: "DeepSeek V4 Flash 0731" },
    { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2" },
    { id: "deepseek/deepseek-chat-v3.1", name: "DeepSeek Chat V3.1" }
  ],
  "Tencent": [
    { id: "tencent/hy4-preview", name: "Hunyuan 4 Preview" },
    { id: "tencent/hy3", name: "Hunyuan 3" }
  ],
  "SenseNova": [
    { id: "sensenova/sensenova-6.8-flash-lite", name: "SenseNova 6.8 Flash Lite" },
    { id: "sensenova/sensenova-6.7-flash-lite", name: "SenseNova 6.7 Flash Lite" }
  ],
  "Meta": [
    { id: "meta/muse-spark-1.2-contributor", name: "Muse Spark 1.2 Contributor" }
  ],
  "Qwen": [
    { id: "qwen/qwen3.8-max", name: "Qwen 3.8 Max" },
    { id: "qwen/qwen3.7-max", name: "Qwen 3.7 Max" },
    { id: "qwen/qwen3.7-plus", name: "Qwen 3.7 Plus" },
    { id: "qwen/qwen3.6-plus", name: "Qwen 3.6 Plus" },
    { id: "qwen/qwen3.5-plus", name: "Qwen 3.5 Plus" },
    { id: "qwen/qwen3.8-max:free", name: "Qwen 3.8 Max (Free)" },
    { id: "qwen/qwen3.7-max:free", name: "Qwen 3.7 Max (Free)" },
    { id: "qwen/qwen3.7-plus:free", name: "Qwen 3.7 Plus (Free)" },
    { id: "qwen/qwen3.6-plus:free", name: "Qwen 3.6 Plus (Free)" },
    { id: "qwen/qwen3.6-max-preview:free", name: "Qwen 3.6 Max Preview (Free)" },
    { id: "qwen/qwen3.6-27b:free", name: "Qwen 3.6 27B (Free)" },
    { id: "qwen/qwen3.5-plus:free", name: "Qwen 3.5 Plus (Free)" },
    { id: "qwen/qwen3.5-omni-plus:free", name: "Qwen 3.5 Omni Plus (Free)" },
    { id: "qwen/qwen3.6-35b-a3b:free", name: "Qwen 3.6 35B A3B (Free)" },
    { id: "qwen/qwen3.5-flash:free", name: "Qwen 3.5 Flash (Free)" },
    { id: "qwen/qwen3.5-397b-a17b:free", name: "Qwen 3.5 397B A17B (Free)" },
    { id: "qwen/qwen3.5-omni-flash:free", name: "Qwen 3.5 Omni Flash (Free)" },
    { id: "qwen/qwen3-max:free", name: "Qwen 3 Max (Free)" },
    { id: "qwen/qwen-plus-2025-07-28:free", name: "Qwen Plus 2025-07-28 (Free)" },
    { id: "qwen/qwen3-coder-plus:free", name: "Qwen 3 Coder Plus (Free)" },
    { id: "qwen/qwen3-vl-plus:free", name: "Qwen 3 VL Plus (Free)" },
    { id: "qwen/qwen3-omni-flash:free", name: "Qwen 3 Omni Flash (Free)" }
  ],
  "NVIDIA": [
    { id: "nvidia/nemotron-3-ultra", name: "Nemotron 3 Ultra" },
    { id: "nvidia/nemotron-3-super", name: "Nemotron 3 Super" },
    { id: "nvidia/nemotron-3-nano", name: "Nemotron 3 Nano" },
    { id: "nvidia/nemotron-3-nano-omni", name: "Nemotron 3 Nano Omni" }
  ]
};

const DEFAULT_CONFIG = {
  api: {
    baseUrl: "https://api.xkiro.com/v1",
    apiKey: "",
    model: "openai/gpt-5.6-terra"
  },
  security: {
    mode: "approval" // "approval" (minta izin konfirmasi) or "full-access" (otonom penuh tanpa izin)
  },
  terminal: {
    defaultTimeout: 60,
    shell: "powershell"
  },
  fileManager: {
    maxReadSize: 512000 // 500KB
  },
  history: {
    maxMessages: 35,
    maxTokenBudget: 64000
  },
  ignoredFolders: [
    "target",
    ".gradle",
    ".idea",
    ".git",
    "node_modules",
    ".vscode",
    "dist",
    ".craft"
  ]
};

class ConfigManager {
  constructor(userDataPath = null) {
    if (userDataPath) {
      this.configPath = path.join(userDataPath, 'craft-agent-config.json');
    } else {
      this.configPath = path.join(process.cwd(), 'craft-agent-config.json');
    }
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        const ignored = (parsed.ignoredFolders || [...DEFAULT_CONFIG.ignoredFolders])
          .filter(item => item !== '*.jar');

        return {
          api: { ...DEFAULT_CONFIG.api, ...(parsed.api || {}) },
          security: { ...DEFAULT_CONFIG.security, ...(parsed.security || {}) },
          terminal: { ...DEFAULT_CONFIG.terminal, ...(parsed.terminal || {}) },
          fileManager: { ...DEFAULT_CONFIG.fileManager, ...(parsed.fileManager || {}) },
          history: { ...DEFAULT_CONFIG.history, ...(parsed.history || {}) },
          ignoredFolders: ignored
        };
      }
    } catch (err) {
      console.error('Error loading config, falling back to defaults:', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  getConfig() {
    return this.config;
  }

  saveConfig(newConfig) {
    try {
      this.config = {
        api: { ...this.config.api, ...(newConfig.api || {}) },
        security: { ...this.config.security, ...(newConfig.security || {}) },
        terminal: { ...this.config.terminal, ...(newConfig.terminal || {}) },
        fileManager: { ...this.config.fileManager, ...(newConfig.fileManager || {}) },
        history: { 
          ...this.config.history, 
          ...(newConfig.history || {}),
          maxTokenBudget: newConfig.history && newConfig.history.maxTokenBudget !== undefined
            ? Math.max(8000, Math.min(1000000, parseInt(newConfig.history.maxTokenBudget, 10) || 64000))
            : (this.config.history?.maxTokenBudget || 64000)
        },
        ignoredFolders: Array.isArray(newConfig.ignoredFolders) 
          ? newConfig.ignoredFolders 
          : this.config.ignoredFolders
      };

      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      return { success: true, config: this.config };
    } catch (err) {
      console.error('Failed to save config:', err);
      return { success: false, error: err.message };
    }
  }

  resetConfig() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to reset config file:', err);
    }
    return this.config;
  }

  getModelsCatalog() {
    return MODELS_CATALOG;
  }
}

module.exports = {
  ConfigManager,
  MODELS_CATALOG,
  DEFAULT_CONFIG
};
