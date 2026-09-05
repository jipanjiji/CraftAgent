const { OpenAI } = require('openai');
const { getSystemPrompt } = require('./system-prompt');

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
      name: "read_file",
      description: "Read the UTF-8 text contents of a file inside the active workspace up to 500KB. Fails if outside workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative file path from workspace root"
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
      description: "Create a new file or completely overwrite an existing file. Automatically creates intermediate folders. For edits to existing code, use patch_file instead.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative file path from workspace root"
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
            description: "Relative file path from workspace root"
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
      description: "Scan the directory tree of the active workspace. Automatically respects .forgeignore, .gitignore, and common build folders.",
      parameters: {
        type: "object",
        properties: {}
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
  }
];

function formatToolStatusDescription(name, args) {
  switch (name) {
    case 'read_file':
      return `Reading file: ${args.path || '...'}`;
    case 'write_file':
      return `Writing file: ${args.path || '...'}`;
    case 'patch_file':
      return `Editing file: ${args.path || '...'}`;
    case 'download_file':
      return `Downloading: ${args.path || args.url || '...'}`;
    case 'get_workspace_structure':
      return `Scanning workspace project files...`;
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
  constructor({ configManager, historyManager, fileManager, terminalExecutor, workspaceScanner, webIntelligence }) {
    this.configManager = configManager;
    this.historyManager = historyManager;
    this.fileManager = fileManager;
    this.terminalExecutor = terminalExecutor;
    this.workspaceScanner = workspaceScanner;
    this.webIntelligence = webIntelligence;
    this.workspaceRoot = null;
    this.isAborted = false;
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
    this.fileManager.setWorkspaceRoot(root);
    this.terminalExecutor.setWorkspaceRoot(root);
    this.workspaceScanner.setWorkspaceRoot(root);
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
   * Main chat loop: handles streaming text, tool calling resolution, and recursing until completion.
   */
  async chat({ userMessage, onChunk, onToolStart, onToolComplete, onStatus, onError, onFinish }) {
    this.isAborted = false;
    this.currentAbortController = new AbortController();

    // Check API Key
    const config = this.configManager.getConfig();
    if (!config.api.apiKey || config.api.apiKey.trim() === '') {
      const err = new Error("xKiro API Key is missing. Please open Settings (⚙) and enter your API Key.");
      if (onError) onError(err.message);
      return;
    }

    // Add user message to history
    this.historyManager.addMessage({
      role: 'user',
      content: userMessage
    });

    const client = this.getOpenAIClient();
    const model = config.api.model || 'openai/gpt-5.6-terra';
    const systemPrompt = getSystemPrompt(this.workspaceRoot);

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

          // Push tool response message to history
          this.historyManager.addMessage({
            role: 'tool',
            tool_call_id: tc.id,
            name: funcName,
            content: JSON.stringify(toolResult)
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
      case 'read_file':
        return this.fileManager.readFile(args.path);

      case 'write_file':
        return this.fileManager.writeFile(args.path, args.content);

      case 'patch_file':
        return this.fileManager.patchFile(args.path, args.search_block, args.replace_block);

      case 'get_workspace_structure':
        return this.workspaceScanner.scan();

      case 'execute_terminal_command':
        return await this.terminalExecutor.executeCommand(args.command, args.timeout_seconds);

      case 'web_search':
        return await this.webIntelligence.webSearch(args.query);

      case 'scrape_webpage':
        return await this.webIntelligence.scrapeWebpage(args.url);

      case 'download_file':
        return await this.fileManager.downloadFile(args.url, args.path);

      default:
        return {
          success: false,
          error: `Unknown tool name: ${name}`
        };
    }
  }
}

module.exports = { AIEngine, TOOLS_SCHEMA };
