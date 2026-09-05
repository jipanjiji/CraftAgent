const { OpenAI } = require('openai');
const { getSystemPrompt } = require('./system-prompt');
const { ArchiveInspector } = require('./tools/archive-inspector');
const { pruneToolContent } = require('./history-manager');
const { WorkspaceMemory } = require('./workspace-memory');

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
            description: "The exact block of lines to find in the file (must match verbatim including indentation)"
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

class AIEngine {
  constructor({ configManager, historyManager, fileManager, terminalExecutor, workspaceScanner, webIntelligence, archiveInspector = null }) {
    this.configManager = configManager;
    this.historyManager = historyManager;
    this.fileManager = fileManager;
    this.terminalExecutor = terminalExecutor;
    this.workspaceScanner = workspaceScanner;
    this.webIntelligence = webIntelligence;
    this.archiveInspector = archiveInspector || new ArchiveInspector();
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
  async chat({ userMessage, attachments = [], onChunk, onToolStart, onToolComplete, onStatus, onError, onFinish }) {
    this.isAborted = false;
    this.currentAbortController = new AbortController();

    // Check API Key
    const config = this.configManager.getConfig();
    if (!config.api.apiKey || config.api.apiKey.trim() === '') {
      const err = new Error("xKiro API Key is missing. Please open Settings (⚙) and enter your API Key.");
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
    const maxIterations = 20; // safety ceiling

    try {
      while (loopIterations < maxIterations) {
        if (this.isAborted) {
          if (onFinish) onFinish({ text: '', aborted: true });
          break;
        }

        loopIterations++;
        const messages = this.historyManager.getMessagesForAPI(systemPrompt);

        let stream;
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
        } catch (apiErr) {
          if (this.isAborted || apiErr.name === 'AbortError' || apiErr.name === 'APIUserAbortError') {
            console.log("xKiro request aborted by user.");
            if (onFinish) onFinish({ text: '', aborted: true });
            return;
          }
          console.error("xKiro API Error:", apiErr);
          let userMsg = apiErr.message;
          if (apiErr.status === 401) {
            userMsg = "Unauthorized (401): Invalid xKiro API Key. Check your settings.";
          } else if (apiErr.status === 404) {
            userMsg = `Model '${model}' not found on xKiro. Please select a valid model in Settings.`;
          }
          if (onError) onError(userMsg);
          return;
        }

        let fullTextContent = '';
        let fullReasoningContent = '';
        const toolCallsAccumulator = [];

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
          // 1. If model returned empty content and no tool calls (typical of reasoning models finishing internal thoughts):
          if (!fullTextContent.trim() && loopIterations < 3 && autoContinueCount === 0) {
            autoContinueCount++;
            this.historyManager.addMessage({
              role: 'user',
              content: 'Lanjutkan pembuatan file-file plugin secara langsung menggunakan tool write_file sekarang.'
            });
            continue;
          }

          // 2. If the model gave an explanation promising execution (e.g. "Tunggu sebentar", "Saya akan perbaiki", "lalu jalankan build", etc.)
          // but forgot to attach the tool calls in this turn, nudge it to continue autonomously without stopping!
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
              content: 'Lanjutkan sekarang dan panggil tool yang diperlukan (patch_file, write_file, atau execute_terminal_command) untuk mengeksekusinya langsung tanpa berhenti.'
            });
            continue;
          }

          // 3. Fallback: If fullTextContent is still empty, provide friendly response instead of blank card
          if (!fullTextContent.trim()) {
            fullTextContent = 'Saya siap melanjutkan pembuatan plugin. Silakan tentukan file atau fitur yang ingin dibuat, atau beri perintah untuk mulai menulis file.';
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
        // Record assistant message with tool_calls in history
        this.historyManager.addMessage({
          role: 'assistant',
          content: fullTextContent || null,
          tool_calls: validToolCalls
        });

        if (onStatus) {
          onStatus(`Executing ${validToolCalls.length} tool request(s)...`);
        }

        // Execute each tool call sequentially
        for (const tc of validToolCalls) {
          if (this.isAborted) break;

          const funcName = tc.function.name;
          let parsedArgs = {};
          try {
            parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch (e) {
            console.error(`Failed to parse arguments for ${funcName}:`, tc.function.arguments);
            parsedArgs = {};
          }

          const statusDesc = formatToolStatusDescription(funcName, parsedArgs);
          if (onStatus) {
            onStatus(statusDesc);
          }

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

          // Push tool response message to history with head-tail pruning (Feature 1)
          const rawToolJson = JSON.stringify(toolResult);
          const prunedToolJson = pruneToolContent(rawToolJson);
          this.historyManager.addMessage({
            role: 'tool',
            tool_call_id: tc.id,
            name: funcName,
            content: prunedToolJson
          });
        }

        if (this.isAborted) {
          if (onFinish) onFinish({ text: fullTextContent, aborted: true });
          return;
        }

        // Continue loop to give tool results back to model
      }

      if (loopIterations >= maxIterations) {
        if (onError) onError("Tool execution loop limit reached (max 20 rounds). Stopping for safety.");
      }
    } catch (err) {
      console.error("AI Engine error:", err);
      if (onError) onError(err.message);
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

      case 'update_workspace_memory':
        return this.workspaceMemory.update(args);

      default:
        return {
          success: false,
          error: `Unknown tool name: ${name}`
        };
    }
  }
}

module.exports = { AIEngine, TOOLS_SCHEMA };
