const { OpenAI } = require('openai');
const { getSystemPrompt } = require('./system-prompt');
const { ArchiveInspector } = require('./tools/archive-inspector');
const { pruneToolContent } = require('./history-manager');
const { WorkspaceMemory } = require('./workspace-memory');
const { ModrinthService } = require('./tools/modrinth-service');

const TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "execute_terminal_command",
      description: "Run a shell command in the workspace directory. Requires user confirmation in the desktop UI. You can specify timeout_seconds if the task is expected to take longer than 60s (e.g. long builds, downloading large libraries, or large file transfers).",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute"
          },
          timeout_seconds: {
            type: "integer",
            description: "Override timeout in seconds. Default is 60. Increase for operations like large file transfers, heavy compilations, or dependency downloads.",
            default: 60
          }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "inspect_jar",
      description: "Inspect the contents of a .jar or .zip Minecraft plugin/mod archive. Lists internal files or extracts text from files like plugin.yml, fabric.mod.json, or config files. Works instantly on local or external jars.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path or absolute file path to the .jar or .zip file"
          },
          internal_file: {
            type: "string",
            description: "Optional internal file path inside the jar to read (e.g. 'plugin.yml', 'paper-plugin.yml', 'fabric.mod.json', 'META-INF/MANIFEST.MF', 'config.yml')"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the UTF-8 text contents of a file inside the active workspace (or external path if explicitly requested by user) up to 500KB.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative file path from workspace root, or absolute path to external file requested by user"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create a new file or completely overwrite an existing file in the active workspace (or external path if explicitly requested by user). Automatically creates intermediate folders.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative file path from workspace root, or absolute path requested by user"
          },
          content: {
            type: "string",
            description: "Complete file contents to write"
          }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description: "TOKEN EFFICIENT: Update an existing file by finding an exact matching block and replacing it. Highly recommended over write_file for code modifications.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative file path from workspace root, or absolute path requested by user"
          },
          search_block: {
            type: "string",
            description: "The block of lines to find in the file (matches verbatim or whitespace/indentation variations automatically)"
          },
          replace_block: {
            type: "string",
            description: "The replacement block of code"
          }
        },
        required: ["path", "search_block", "replace_block"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workspace_structure",
      description: "Scan the directory tree of the active workspace or an external folder requested by the user. Automatically respects .forgeignore, .gitignore, and common build folders.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Optional folder path to scan if user specifically requests scanning an external directory or other workspace. Defaults to active workspace."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web via DuckDuckGo for documentation, APIs, error solutions, or Minecraft plugin libraries.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query string"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "scrape_webpage",
      description: "Fetch and extract clean text from a web page URL (stripping navigation, ads, and scripts).",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "HTTP or HTTPS webpage URL to scrape"
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "download_file",
      description: "Download a file from an HTTP/HTTPS URL directly to a relative destination path inside the workspace (e.g. downloading jar files, zip archives, wrappers, or assets).",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The direct HTTP/HTTPS URL of the file to download"
          },
          path: {
            type: "string",
            description: "The relative destination file path in the workspace where the file should be saved"
          }
        },
        required: ["url", "path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_workspace_memory",
      description: "PERSISTENT MEMORY: Update the workspace scratchpad (.craft/memory.json) to store discovered project facts (Java version, build tool, server platform), active goals checklist, or persistent notes that must be remembered across sessions.",
      parameters: {
        type: "object",
        properties: {
          project_facts: {
            type: "object",
            description: "Object containing key project facts, e.g. { javaVersion: 'Java 21', buildTool: 'Gradle', serverPlatform: 'Paper 1.20.4', name: 'MyPlugin' }"
          },
          active_goals: {
            type: "array",
            items: { type: "string" },
            description: "Updated list of remaining tasks or goals to finish"
          },
          completed_goals: {
            type: "array",
            items: { type: "string" },
            description: "List of goals or milestones just completed"
          },
          add_notes: {
            type: "string",
            description: "Any persistent note or user preference about the workspace to remember"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "fetch_modrinth_artifact",
      description: "Download a Minecraft mod, plugin, or datapack .jar/.zip artifact directly from Modrinth using a Modrinth URL (e.g. 'https://modrinth.com/plugin/provanish' or 'https://modrinth.com/mod/sodium') or slug to a temporary directory (.craft/temp/) for inspection and auditing.",
      parameters: {
        type: "object",
        properties: {
          url_or_slug: {
            type: "string",
            description: "The Modrinth project URL (e.g. 'https://modrinth.com/plugin/provanish') or slug (e.g. 'provanish')"
          },
          version_number: {
            type: "string",
            description: "Optional specific version number to download. If omitted, downloads the latest release version."
          }
        },
        required: ["url_or_slug"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a temporary file in '.craft/temp/' after an audit, or a file when explicitly instructed by the user. CRITICAL SAFETY: NEVER use this tool on existing workspace files, plugins, mods, or uploads unless the user explicitly requested file deletion. For analyzing local/existing jar files, ONLY use inspect_jar and never delete them.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path inside workspace (or external path) of the file to delete"
          }
        },
        required: ["path"]
      }
    }
  }
];

function formatToolStatusDescription(name, args) {
  switch (name) {
    case 'update_workspace_memory':
      return 'Updating workspace memory (.craft/memory.json)...';
    case 'inspect_jar':
      return args.internal_file
        ? `Reading "${args.internal_file}" from archive: ${args.path || '...'}`
        : `Inspecting archive contents: ${args.path || '...'}`;
    case 'read_file':
      return `Reading file: ${args.path || '...'}`;
    case 'write_file':
      return `Writing file: ${args.path || '...'}`;
    case 'patch_file':
      return `Editing file: ${args.path || '...'}`;
    case 'download_file':
      return `Downloading: ${args.path || args.url || '...'}`;
    case 'fetch_modrinth_artifact':
      return `Downloading Modrinth artifact: ${args.url_or_slug || '...'}`;
    case 'delete_file':
      return `Deleting file: ${args.path || '...'}`;
    case 'get_workspace_structure':
      return args.path ? `Scanning folder structure: ${args.path}...` : `Scanning workspace project files...`;
    case 'execute_terminal_command':
      return `Running command: ${args.command || '...'}`;
    case 'web_search':
      return `Searching web: "${args.query || '...'}"`;
    case 'scrape_webpage':
      return `Reading webpage: ${args.url || '...'}`;
    default:
      return `Executing tool: ${name}`;
  }
}

const READ_ONLY_TOOLS = new Set([
  'read_file',
  'inspect_jar',
  'get_workspace_structure',
  'web_search',
  'scrape_webpage'
]);

/**
 * Hybrid Two-Tier Transient Error Detector (Item 7):
 * Layer 1: Structured fields inspection (status, code, name, type)
 * Layer 2: Resilient string matching fallback (for multi-provider gateways like xKiro)
 */
function isTransientError(err) {
  if (!err) return false;

  // Layer 1: Structured fields
  const status = err.status || err.statusCode || err.response?.status;
  const code = err.code || err.error?.code;
  const name = err.name;

  // Explicit non-transient errors (never retry)
  if (status === 401 || status === 403 || status === 404 || name === 'AuthenticationError' || name === 'NotFoundError') {
    return false;
  }
  if (name === 'AbortError' || name === 'APIUserAbortError') {
    return false;
  }

  // Structured transient indicators
  if (status === 429 || (status >= 500 && status <= 504)) {
    return true;
  }
  if (code === 'ERR_STREAM_PREMATURE_CLOSE' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ESOCKETTIMEDOUT') {
    return true;
  }
  if (name === 'RateLimitError' || name === 'InternalServerError' || name === 'APIConnectionError' || name === 'APIConnectionTimeoutError') {
    return true;
  }

  // Layer 2: String fallback inspection
  const errMsg = ((err.message || '') + ' ' + (err.stack || '')).toLowerCase();

  if (errMsg.includes('invalid api key') || errMsg.includes('unauthorized') || errMsg.includes('model not found')) {
    return false;
  }

  return errMsg.includes('rate limit') ||
         errMsg.includes('too many requests') ||
         errMsg.includes('premature close') ||
         errMsg.includes('socket hang up') ||
         errMsg.includes('econnreset') ||
         errMsg.includes('etimedout') ||
         errMsg.includes('gateway timeout') ||
         errMsg.includes('bad gateway') ||
         errMsg.includes('internal server error') ||
         /\b(429|500|502|503|504)\b/.test(errMsg);
}

class AIEngine {
  constructor({ configManager, historyManager, fileManager, terminalExecutor, workspaceScanner, webIntelligence, archiveInspector = null, modrinthService = null }) {
    this.configManager = configManager;
    this.historyManager = historyManager;
    this.fileManager = fileManager;
    this.terminalExecutor = terminalExecutor;
    this.workspaceScanner = workspaceScanner;
    this.webIntelligence = webIntelligence;
    this.archiveInspector = archiveInspector || new ArchiveInspector();
    this.modrinthService = modrinthService || new ModrinthService();
    this.workspaceMemory = new WorkspaceMemory(null);
    this.workspaceRoot = null;
    this.isAborted = false;
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
    this.workspaceMemory.setWorkspaceRoot(root);
    this.fileManager.setWorkspaceRoot(root);
    this.terminalExecutor.setWorkspaceRoot(root);
    this.workspaceScanner.setWorkspaceRoot(root);
    if (this.archiveInspector) {
      this.archiveInspector.setWorkspaceRoot(root);
    }
    if (this.modrinthService) {
      this.modrinthService.setWorkspaceRoot(root);
    }
  }

  getOpenAIClient() {
    const config = this.configManager.getConfig();
    const apiKey = config.api.apiKey ? config.api.apiKey.trim() : 'dummy-key';
    const baseURL = config.api.baseUrl ? config.api.baseUrl.trim() : 'https://api.xkiro.com/v1';

    return new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      dangerouslyAllowBrowser: false
    });
  }

  abortCurrentRequest() {
    this.isAborted = true;
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch (e) {
        // ignore
      }
    }
    this.terminalExecutor.cancelAll();
  }

  /**
   * Abort-aware sleep helper: resolves immediately if user aborts during waiting delay.
   */
  async abortableSleep(ms) {
    if (this.isAborted) return;
    return new Promise((resolve) => {
      const signal = this.currentAbortController?.signal;
      if (signal?.aborted) return resolve();

      let timer = null;
      const onAbort = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
    });
  }

  /**
   * Two-stage Vision Pipeline:
   * Sends image(s) to mistralai/mistral-large-2512 to transcribe visible text,
   * error stacktraces, console logs, code snippets, and Minecraft GUI/visual elements.
   */
  async extractImageContentWithVision(images, onStatus) {
    if (!Array.isArray(images) || images.length === 0) return null;

    const validImages = images.filter(img => img && (img.dataUrl || typeof img === 'string'));
    if (validImages.length === 0) return null;

    if (onStatus) {
      onStatus("Analyzing Image...");
    }

    try {
      const client = this.getOpenAIClient();
      const visionModel = "mistralai/mistral-large-2512";

      const contentParts = [
        {
          type: "text",
          text: "Transcribe all visible text, console logs, stack traces, code snippets, and UI labels verbatim from the image. If there are code errors or Minecraft exceptions, copy the exact lines. Then provide a concise description of the visual scene or GUI."
        }
      ];

      for (const img of validImages) {
        const url = img.dataUrl || (typeof img === 'string' ? img : '');
        if (url) {
          contentParts.push({
            type: "image_url",
            image_url: { url: url }
          });
        }
      }

      const response = await client.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: "system",
            content: "You are an expert OCR and visual inspection AI. Transcribe all text, code snippets, stack traces, console logs, error lines, and UI elements verbatim from the provided image. Then summarize the visual layout or Minecraft context concisely."
          },
          {
            role: "user",
            content: contentParts
          }
        ]
      }, {
        signal: this.currentAbortController?.signal
      });

      const transcript = response.choices[0]?.message?.content || '';
      return transcript.trim();
    } catch (err) {
      console.warn("Mistral vision extraction failed or unavailable:", err.message);
      return `[Note: Mistral vision transcription returned: ${err.message}. Image attached: ${validImages.map(i => i.name || 'image').join(', ')}]`;
    }
  }

  /**
   * Main chat loop: handles streaming text, tool calling resolution, and recursing until completion.
   */
  async chat({ userMessage, attachments = [], options = {}, onChunk, onToolStart, onToolComplete, onStatus, onError, onFinish }) {
    this.isAborted = false;
    this.currentAbortController = new AbortController();

    // Check API Key
    const config = this.configManager.getConfig();
    if (!config.api.apiKey || config.api.apiKey.trim() === '') {
      const err = new Error("xKiro API Key is missing. Please open Settings and enter your API Key.");
      if (onError) onError(err.message);
      return;
    }

    let processedUserMessage = userMessage || '';

    // Handle attachments (Images & Files)
    if (Array.isArray(attachments) && attachments.length > 0) {
      const images = attachments.filter(a => a.isImage || (a.type && a.type.startsWith('image/')));
      const nonImages = attachments.filter(a => !a.isImage && (!a.type || !a.type.startsWith('image/')));

      if (images.length > 0) {
        const visionText = await this.extractImageContentWithVision(images, onStatus);
        if (visionText) {
          processedUserMessage = `[Image Analysis]:\n${visionText}\n\n${processedUserMessage}`;
        }
      }

      if (nonImages.length > 0) {
        const fileNotices = nonImages.map(f => {
          const sizeStr = f.size ? `${(f.size / 1024).toFixed(1)} KB` : 'unknown size';
          const loc = f.savedPath || f.name;
          let notice = `[User Attached File: ${loc} (${sizeStr})]`;
          if (f.isBinary || f.name.endsWith('.jar') || f.name.endsWith('.zip')) {
            notice += `\n(Saved to workspace at "${loc}". You can inspect its internal files using the "inspect_jar" tool.)`;
          } else if (f.textSnippet) {
            notice += `\n--- Content Preview ---\n${f.textSnippet}\n-----------------------`;
          }
          return notice;
        }).join('\n\n');

        processedUserMessage = `${fileNotices}\n\n${processedUserMessage}`;
      }
    }

    // Add user message to history
    this.historyManager.addMessage({
      role: 'user',
      content: processedUserMessage
    });

    const client = this.getOpenAIClient();
    const model = config.api.model || 'openai/gpt-5.6-terra';
    let systemPrompt = getSystemPrompt(this.workspaceRoot);
    const memorySnippet = this.workspaceMemory.getFormattedPrompt();
    if (memorySnippet) {
      systemPrompt += `\n\n${memorySnippet}`;
    }

    let loopIterations = 0;
    let autoContinueCount = 0;
    const maxIterations = (options && options.maxIterations) || (config.agent && config.agent.maxIterations) || 30;

    try {
      while (loopIterations < maxIterations) {
        if (this.isAborted) {
          if (onFinish) onFinish({ text: '', aborted: true });
          break;
        }

        loopIterations++;
        if (loopIterations === maxIterations - 4) {
          if (onStatus) onStatus(`Peringatan: Pengerjaan telah mencapai putaran ${loopIterations}/${maxIterations}. Bersiap merangkum hasil...`);
        }

        const messages = this.historyManager.getMessagesForAPI(systemPrompt);

        // Initial API Call with Exponential Backoff Retry (Item 1 & Item 7)
        let stream = null;
        let apiAttempts = 0;
        const maxApiAttempts = 3;

        while (apiAttempts < maxApiAttempts) {
          apiAttempts++;
          try {
            stream = await client.chat.completions.create({
              model: model,
              messages: messages,
              tools: TOOLS_SCHEMA,
              tool_choice: "auto",
              stream: true
            }, {
              signal: this.currentAbortController.signal
            });
            break; // Request succeeded!
          } catch (apiErr) {
            if (this.isAborted || apiErr.name === 'AbortError' || apiErr.name === 'APIUserAbortError') {
              console.log("xKiro request aborted by user.");
              if (onFinish) onFinish({ text: '', aborted: true });
              return;
            }

            const transient = isTransientError(apiErr);
            if (transient && apiAttempts < maxApiAttempts && !this.isAborted) {
              const delay = Math.min(4000, 1000 * Math.pow(2, apiAttempts - 1)) + Math.floor(Math.random() * 400);
              const statusReason = apiErr.status || apiErr.code || 'rate limit / server busy';
              console.warn(`Transient API error (${statusReason}). Retrying in ${delay}ms (attempt ${apiAttempts}/${maxApiAttempts})...`);
              if (onStatus) {
                onStatus(`Koneksi terganggu / rate limit (${statusReason}). Mencoba ulang dalam ${(delay / 1000).toFixed(1)}s (percobaan ${apiAttempts}/${maxApiAttempts})...`);
              }
              await this.abortableSleep(delay);
              if (this.isAborted) {
                console.log("xKiro request aborted by user during retry backoff delay.");
                if (onFinish) onFinish({ text: '', aborted: true });
                return;
              }
              continue;
            }

            console.error("xKiro API Error:", apiErr);
            let userMsg = apiErr.message;
            if (apiErr.status === 401 || /(unauthorized|invalid api key)/i.test(apiErr.message)) {
              userMsg = "Unauthorized (401): Invalid xKiro API Key. Check your settings.";
            } else if (apiErr.status === 404 || /model not found/i.test(apiErr.message)) {
              userMsg = `Model '${model}' not found on xKiro. Please select a valid model in Settings.`;
            }
            if (onError) onError(userMsg);
            return;
          }
        }

        let fullTextContent = '';
        let fullReasoningContent = '';
        const toolCallsAccumulator = [];

        try {
          for await (const chunk of stream) {
            if (this.isAborted) break;

            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            // Capture reasoning from DeepSeek / reasoning models
            const reasoningChunk = delta.reasoning_content || delta.reasoning;
            if (reasoningChunk) {
              fullReasoningContent += reasoningChunk;
            }

            // Stream text content
            if (delta.content) {
              fullTextContent += delta.content;
              if (onChunk) onChunk(delta.content);
            }

            // Accumulate tool calls
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = (tc.index !== undefined && tc.index !== null)
                  ? tc.index
                  : (toolCallsAccumulator.length > 0 ? toolCallsAccumulator.length - 1 : 0);

                if (!toolCallsAccumulator[idx]) {
                  toolCallsAccumulator[idx] = {
                    id: tc.id || '',
                    type: 'function',
                    function: {
                      name: tc.function?.name || '',
                      arguments: tc.function?.arguments || ''
                    }
                  };
                } else {
                  if (tc.id) toolCallsAccumulator[idx].id += tc.id;
                  if (tc.function?.name) toolCallsAccumulator[idx].function.name += tc.function.name;
                  if (tc.function?.arguments) toolCallsAccumulator[idx].function.arguments += tc.function.arguments;
                }
              }
            }
          }
        } catch (streamErr) {
          console.warn("AI Engine stream interrupted:", streamErr);
          const isNetworkDrop = isTransientError(streamErr);

          if (isNetworkDrop && !this.isAborted) {
            // If the model had already streamed significant content to the user, preserve it gracefully
            if (fullTextContent && fullTextContent.trim().length > 30) {
              const notice = '\n\n*(Catatan: Koneksi streaming terputus dari server. Ketik "lanjut" untuk melanjutkan respons jika belum tuntas.)*';
              fullTextContent += notice;
              if (onChunk) onChunk(notice);

              this.historyManager.addMessage({
                role: 'assistant',
                content: fullTextContent
              });
              if (onFinish) onFinish({ text: fullTextContent });
              return;
            } else if (loopIterations <= 2 && autoContinueCount === 0) {
              // Retry once for transient initial drop
              console.log("Transient stream drop, retrying iteration...");
              autoContinueCount++;
              loopIterations--;
              if (onStatus) onStatus("Streaming terputus sejenak, mencoba menyambung kembali...");
              await this.abortableSleep(1200);
              if (this.isAborted) {
                console.log("xKiro request aborted by user during stream drop retry.");
                if (onFinish) onFinish({ text: fullTextContent, aborted: true });
                return;
              }
              continue;
            }
          }
          throw streamErr;
        }

        if (this.isAborted) {
          if (fullTextContent && fullTextContent.trim()) {
            this.historyManager.addMessage({
              role: 'assistant',
              content: fullTextContent + "\n\n*(Generation stopped by user)*"
            });
          } else {
            this.historyManager.addMessage({
              role: 'assistant',
              content: "(Generation stopped by user)"
            });
          }
          if (onFinish) onFinish({ text: fullTextContent, aborted: true });
          return;
        }

        // Filter valid tool calls
        const validToolCalls = toolCallsAccumulator.filter(tc => tc && tc.function && tc.function.name);

        if (validToolCalls.length === 0) {
          // 1. If model returned empty content and no tool calls:
          if (!fullTextContent.trim() && loopIterations < 3 && autoContinueCount === 0) {
            autoContinueCount++;
            this.historyManager.addMessage({
              role: 'user',
              content: 'Lanjutkan untuk merespons dan menyelesaikan instruksi user.'
            });
            continue;
          }

          // 2. If the model gave an explanation promising execution but forgot to attach tool calls:
          const isPromiseToExecute = /(tunggu sebentar|tunggu sejenak|sebentar ya|wait a moment|one moment|hang on|langsung saya (eksekusi|perbaiki|buat|kerjakan)|akan saya (eksekusi|perbaiki|ubah|ganti|edit|update|jalankan|build|buat|bikin|kerjakan)|saya akan (perbaiki|ubah|ganti|edit|update|benahi|jalankan|build|kompilasi|buat|bikin|buatkan|eksekusi|lanjutkan|mulai|tulis|selesaikan)|lalu jalankan (build|kompilasi|perintah|command)|sedang saya (perbaiki|proses|kerjakan|buat)|mari saya (perbaiki|ubah|buat|jalankan)|i will (now |)(fix|update|modify|change|patch|run|execute|build|compile|create|make|implement|proceed)|let me (now |)(fix|update|modify|change|patch|run|execute|build|compile|create|make)|i'll (now |)(fix|update|modify|change|patch|run|execute|build|compile|create|make))/i.test(fullTextContent);

          if (isPromiseToExecute && loopIterations < 5 && autoContinueCount < 2) {
            autoContinueCount++;
            if (fullTextContent) {
              this.historyManager.addMessage({
                role: 'assistant',
                content: fullTextContent
              });
            }
            this.historyManager.addMessage({
              role: 'user',
              content: 'Lanjutkan sekarang dan jalankan tindakan atau berikan penjelasan yang diperlukan untuk menyelesaikannya.'
            });
            continue;
          }

          // 3. Fallback: If fullTextContent is still empty:
          if (!fullTextContent.trim()) {
            fullTextContent = 'Saya siap membantu. Silakan beri tahu file apa yang ingin diperiksa atau fitur apa yang ingin dibuat.';
            if (onChunk) onChunk(fullTextContent);
          }

          // No tool calls — final response reached!
          if (fullTextContent) {
            this.historyManager.addMessage({
              role: 'assistant',
              content: fullTextContent
            });
          }
          if (onFinish) onFinish({ text: fullTextContent });
          return;
        }

        // Model requested tool calls
        this.historyManager.addMessage({
          role: 'assistant',
          content: fullTextContent || null,
          tool_calls: validToolCalls
        });

        if (onStatus) {
          onStatus(`Executing ${validToolCalls.length} tool request(s)...`);
        }

        // Helper to execute single tool call and trigger memory sniffing
        const executeSingleTool = async (tc) => {
          const funcName = tc.function.name;
          let parsedArgs = {};
          try {
            parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch (e) {
            console.error(`Failed to parse arguments for ${funcName}:`, tc.function.arguments);
            parsedArgs = {};
          }

          const statusDesc = formatToolStatusDescription(funcName, parsedArgs);
          if (onStatus) onStatus(statusDesc);

          if (onToolStart) {
            onToolStart({
              id: tc.id,
              name: funcName,
              args: parsedArgs,
              statusDescription: statusDesc
            });
          }

          let toolResult;
          try {
            toolResult = await this.dispatchTool(funcName, parsedArgs);
          } catch (execErr) {
            toolResult = {
              success: false,
              error: `Tool execution failed: ${execErr.message}`
            };
          }

          if (onToolComplete) {
            onToolComplete({
              id: tc.id,
              name: funcName,
              args: parsedArgs,
              result: toolResult
            });
          }

          // Sniff project context & milestones (Item 6)
          this.sniffAndCaptureMemory(funcName, parsedArgs, toolResult);

          return {
            tc,
            funcName,
            toolResult
          };
        };

        // Chunk validToolCalls into consecutive runs of read-only vs mutating
        // (PRESERVES original relative order across chunks!)
        const chunks = [];
        let currentChunk = [];
        let currentIsReadOnly = null;

        for (const tc of validToolCalls) {
          const isReadOnly = READ_ONLY_TOOLS.has(tc.function.name);
          if (currentIsReadOnly === null) {
            currentIsReadOnly = isReadOnly;
            currentChunk.push(tc);
          } else if (currentIsReadOnly && isReadOnly) {
            currentChunk.push(tc);
          } else {
            chunks.push({ isReadOnly: currentIsReadOnly, items: currentChunk });
            currentChunk = [tc];
            currentIsReadOnly = isReadOnly;
          }
        }
        if (currentChunk.length > 0) {
          chunks.push({ isReadOnly: currentIsReadOnly, items: currentChunk });
        }

        // Execute chunks in strict sequence to preserve model's intended causality
        for (const chunk of chunks) {
          if (this.isAborted) break;

          let chunkResults = [];
          if (chunk.isReadOnly && chunk.items.length > 1) {
            // Parallel concurrent execution for contiguous read-only tools
            chunkResults = await Promise.all(chunk.items.map(tc => executeSingleTool(tc)));
          } else {
            // Sequential execution for mutating tools or single items
            for (const tc of chunk.items) {
              if (this.isAborted) break;
              const res = await executeSingleTool(tc);
              chunkResults.push(res);
            }
          }

          // Push tool response messages to history in exact original order
          for (const r of chunkResults) {
            const rawToolJson = JSON.stringify(r.toolResult);
            const prunedToolJson = pruneToolContent(rawToolJson);
            this.historyManager.addMessage({
              role: 'tool',
              tool_call_id: r.tc.id,
              name: r.funcName,
              content: prunedToolJson
            });
          }
        }

        if (this.isAborted) {
          if (onFinish) onFinish({ text: fullTextContent, aborted: true });
          return;
        }
      }

      if (loopIterations >= maxIterations) {
        const limitNotice = `\n\n*(Batas pengerjaan otomatis tercapai: ${maxIterations} putaran. Ketik 'lanjut' untuk melanjutkan pengerjaan berikutnya.)*`;
        if (onChunk) onChunk(limitNotice);
        this.historyManager.addMessage({
          role: 'assistant',
          content: (fullTextContent || 'Pengerjaan putaran selesai.') + limitNotice
        });
        if (onFinish) onFinish({ text: (fullTextContent || '') + limitNotice });
      }
    } catch (err) {
      console.error("AI Engine error:", err);
      let userFriendlyErr = err.message;
      if (/premature close/i.test(err.message)) {
        userFriendlyErr = "Koneksi streaming ke AI server terputus di tengah jalan (Premature close). Anda bisa mengetik 'lanjutkan' untuk melanjutkan proses.";
      }
      if (onError) onError(userFriendlyErr);
    }
  }

  /**
   * Dispatches function call to local tools
   */
  async dispatchTool(name, args) {
    switch (name) {
      case 'inspect_jar':
        if (args.internal_file) {
          return await this.archiveInspector.readEntry(args.path, args.internal_file);
        } else {
          return await this.archiveInspector.listEntries(args.path);
        }

      case 'read_file':
        return await this.fileManager.readFile(args.path);

      case 'write_file':
        return await this.fileManager.writeFile(args.path, args.content);

      case 'patch_file':
        return await this.fileManager.patchFile(args.path, args.search_block, args.replace_block);

      case 'get_workspace_structure':
        return await this.workspaceScanner.scan(args.path);

      case 'execute_terminal_command':
        return await this.terminalExecutor.executeCommand(args.command, args.timeout_seconds);

      case 'web_search':
        return await this.webIntelligence.webSearch(args.query);

      case 'scrape_webpage':
        return await this.webIntelligence.scrapeWebpage(args.url);

      case 'download_file':
        return await this.fileManager.downloadFile(args.url, args.path);

      case 'delete_file':
        return await this.fileManager.deleteFile(args.path);

      case 'fetch_modrinth_artifact':
        return await this.modrinthService.fetchArtifactForAnalysis(args.url_or_slug, args.version_number);

      case 'update_workspace_memory':
        return this.workspaceMemory.update(args);

      default:
        return {
          success: false,
          error: `Unknown tool name: ${name}`
        };
    }
  }

  /**
   * Autonomous Multi-Touchpoint Memory Sniffing (Item 6):
   * Proactively captures project context, platforms, and completed milestones into .craft/memory.json
   */
  sniffAndCaptureMemory(funcName, parsedArgs, toolResult) {
    if (!this.workspaceMemory || !toolResult || toolResult.success === false) return;

    try {
      // 1. Sniff on write_file or patch_file
      if (funcName === 'write_file' || funcName === 'patch_file') {
        const filePath = (parsedArgs.path || '').toLowerCase();
        const content = parsedArgs.content || parsedArgs.replace_block || '';

        // build.gradle / pom.xml
        if (filePath.endsWith('build.gradle') || filePath.endsWith('build.gradle.kts') || filePath.endsWith('pom.xml')) {
          const facts = {};
          if (filePath.includes('gradle')) facts.buildTool = 'Gradle';
          if (filePath.includes('pom.xml')) facts.buildTool = 'Maven';

          // Sniff Java version
          const javaMatch = content.match(/(?:sourceCompatibility|targetCompatibility)\s*=\s*['"]?(\d+)['"]?/i) ||
                            content.match(/JavaLanguageVersion\.of\((\d+)\)/i) ||
                            content.match(/<java\.version>(\d+)<\/java\.version>/i) ||
                            content.match(/jvmTarget\s*=\s*['"]?(\d+)['"]?/i);
          if (javaMatch) {
            facts.javaVersion = `Java ${javaMatch[1]}`;
          }

          // Sniff server platform dependencies
          if (/paper-api|io\.papermc\.paper/i.test(content)) {
            facts.serverPlatform = 'Paper';
          } else if (/purpur-api|org\.purpurmc\.purpur/i.test(content)) {
            facts.serverPlatform = 'Purpur';
          } else if (/spigot-api|org\.spigotmc/i.test(content)) {
            facts.serverPlatform = 'Spigot';
          } else if (/fabric-loader|net\.fabricmc/i.test(content)) {
            facts.serverPlatform = 'Fabric';
          }

          if (Object.keys(facts).length > 0) {
            this.workspaceMemory.update({ project_facts: facts });
          }
        }

        // plugin.yml / paper-plugin.yml / fabric.mod.json
        if (filePath.endsWith('plugin.yml') || filePath.endsWith('paper-plugin.yml') || filePath.endsWith('fabric.mod.json')) {
          const facts = {};
          const nameMatch = content.match(/^name:\s*['"]?([a-zA-Z0-9_-]+)['"]?/m) || content.match(/"id":\s*"([^"]+)"/);
          if (nameMatch) facts.name = nameMatch[1];

          const versionMatch = content.match(/^version:\s*['"]?([a-zA-Z0-9_.-]+)['"]?/m) || content.match(/"version":\s*"([^"]+)"/);
          if (versionMatch) facts.version = versionMatch[1];

          const mainMatch = content.match(/^main:\s*['"]?([a-zA-Z0-9_.]+)['"]?/m);
          if (mainMatch) facts.mainClass = mainMatch[1];

          const apiVerMatch = content.match(/^api-version:\s*['"]?([0-9.]+)['"]?/m);
          if (apiVerMatch) facts.apiVersion = apiVerMatch[1];

          if (Object.keys(facts).length > 0) {
            this.workspaceMemory.update({ project_facts: facts });
          }
        }
      }

      // 2. Sniff on read_file (Server configs & platforms)
      if (funcName === 'read_file') {
        const filePath = (parsedArgs.path || '').toLowerCase();
        const content = toolResult.content || '';

        const facts = {};
        if (filePath.endsWith('paper-global.yml') || filePath.endsWith('paper-world-defaults.yml')) {
          facts.serverPlatform = 'Paper';
        } else if (filePath.endsWith('purpur.yml')) {
          facts.serverPlatform = 'Purpur';
        } else if (filePath.endsWith('spigot.yml')) {
          facts.serverPlatform = 'Spigot';
        } else if (filePath.endsWith('velocity.toml') || filePath.endsWith('velocity-plugin.json')) {
          facts.serverPlatform = 'Velocity';
        } else if (filePath.endsWith('bungee.yml')) {
          facts.serverPlatform = 'BungeeCord';
        } else if (filePath.endsWith('server.properties')) {
          const verMatch = content.match(/#Minecraft server properties\s+#([^\r\n]+)/i);
          if (verMatch) facts.serverProperties = verMatch[1].trim();
        }

        if (Object.keys(facts).length > 0) {
          this.workspaceMemory.update({ project_facts: facts });
        }
      }

      // 3. Sniff on inspect_jar
      if (funcName === 'inspect_jar' && toolResult.manifestData) {
        const facts = {};
        if (toolResult.manifestData.name) facts.name = toolResult.manifestData.name;
        if (toolResult.manifestData.version) facts.version = toolResult.manifestData.version;
        if (toolResult.manifestData.platform) facts.serverPlatform = toolResult.manifestData.platform;
        if (Object.keys(facts).length > 0) {
          this.workspaceMemory.update({ project_facts: facts });
        }
      }

      // 4. Milestone Auto-Sync for successful build commands
      if (funcName === 'execute_terminal_command' && toolResult.success) {
        const cmd = (parsedArgs.command || '').toLowerCase();
        if (cmd.includes('gradlew') && (cmd.includes('build') || cmd.includes('assemble'))) {
          this.workspaceMemory.update({ completed_goals: ['Successfully built and compiled project with Gradle'] });
        }
      }
    } catch (sniffErr) {
      console.warn('Memory sniffing skipped on error:', sniffErr.message);
    }
  }
}

module.exports = { AIEngine, TOOLS_SCHEMA };
