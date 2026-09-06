const { spawn } = require('child_process');
const path = require('path');

/**
 * Scans a shell command or chain of commands for dangerous/destructive patterns.
 * Decomposes chained commands (&&, ||, ;, |, newline) to analyze sub-commands.
 * NOTE: This is a visual heuristic / safety aid to warn users, not a security sandbox guarantee.
 */
function isDestructiveCommand(command) {
  if (!command || typeof command !== 'string') return { isDangerous: false };

  // Split by chaining operators: &&, ||, ;, |, and newlines
  const subCommands = command.split(/&&|\|\||;|\||\r?\n/).map(c => c.trim()).filter(Boolean);

  const patterns = [
    // Windows file/folder deletion
    { regex: /\bdel\b.*\s+(\/[sS]|\/q|\/f|-Force|-Recurse)/i, reason: 'Recursive or forced file deletion (del /s /q)' },
    { regex: /\b(rmdir|rd)\b.*\s+\/[sS]/i, reason: 'Recursive directory deletion (rmdir /s)' },
    { regex: /\bRemove-Item\b.*(-Recurse|-Force)/i, reason: 'PowerShell recursive file/folder removal (Remove-Item -Recurse)' },
    
    // Unix/Linux file/folder deletion
    { regex: /\brm\b\s+.*(-[a-zA-Z]*[rf]|--recursive|--force)/i, reason: 'Recursive or forced deletion (rm -rf)' },
    { regex: /\bfind\b.*-delete\b/i, reason: 'Command-line automated mass file deletion (find -delete)' },

    // Destructive Git commands
    { regex: /\bgit\b\s+push\b.*(--force|-f\b|\+.*:)/i, reason: 'Forced Git push overwriting remote history (git push --force)' },
    { regex: /\bgit\b\s+reset\b.*--hard/i, reason: 'Hard Git reset discarding all uncommitted changes (git reset --hard)' },
    { regex: /\bgit\b\s+clean\b.*-[a-zA-Z]*f/i, reason: 'Forced untracked file deletion (git clean -f)' },
    { regex: /\bgit\b\s+(restore|checkout)\b.*(\.|\s+--\s+\.)/i, reason: 'Discards all working tree modifications' },

    // Disk & System destruction
    { regex: /\bformat\b\s+[a-zA-Z]:/i, reason: 'Disk partition format command (format C:)' },
    { regex: /\bdiskpart\b/i, reason: 'Disk partition management utility' },
    { regex: /\breg\b\s+delete\b/i, reason: 'Windows Registry deletion (reg delete)' },
    { regex: /\b(shutdown|reboot|init\s+0)\b/i, reason: 'System shutdown or reboot command' },

    // Database drops
    { regex: /\bdrop\b\s+(database|table|schema)\b/i, reason: 'Destructive SQL database/table drop' },
    { regex: /\btruncate\b\s+table\b/i, reason: 'Destructive SQL table wipe (truncate table)' }
  ];

  for (const sub of subCommands) {
    for (const p of patterns) {
      if (p.regex.test(sub)) {
        return {
          isDangerous: true,
          dangerReason: p.reason,
          subCommand: sub
        };
      }
    }
  }

  return { isDangerous: false };
}

class TerminalExecutor {
  constructor(workspaceRoot = null, defaultTimeout = 60, shell = 'powershell') {
    this.workspaceRoot = workspaceRoot;
    this.defaultTimeout = defaultTimeout;
    this.shell = shell;
    this.confirmCallback = null;
    this.outputCallback = null;
    this.activeProcesses = new Map();
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
  }

  setDefaultTimeout(seconds) {
    this.defaultTimeout = parseInt(seconds, 10) || 60;
  }

  setShell(shell) {
    this.shell = shell;
  }

  /**
   * Set callback function that prompts user for approval in the UI.
   * Signature: async ({ id, command, timeoutSeconds, workingDir, isDangerous, dangerReason }) => boolean
   */
  setConfirmCallback(fn) {
    this.confirmCallback = fn;
  }

  /**
   * Set real-time terminal output stream listener.
   * Signature: ({ stream: 'stdout'|'stderr', text: string }) => void
   */
  setOutputCallback(fn) {
    this.outputCallback = fn;
  }

  /**
   * Executes a shell command with user confirmation and configurable timeout.
   */
  async executeCommand(command, requestedTimeout = null) {
    if (!this.workspaceRoot) {
      return {
        success: false,
        error: "Cannot execute terminal command: No active workspace folder selected."
      };
    }

    const timeoutSeconds = parseInt(requestedTimeout, 10) > 0 
      ? parseInt(requestedTimeout, 10) 
      : this.defaultTimeout;

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const dangerScan = isDestructiveCommand(command);

    // Human-In-The-Loop Confirmation
    if (this.confirmCallback) {
      try {
        const approved = await this.confirmCallback({
          id: requestId,
          command: command,
          timeoutSeconds: timeoutSeconds,
          workingDir: this.workspaceRoot,
          isDangerous: dangerScan.isDangerous,
          dangerReason: dangerScan.dangerReason || null
        });

        if (!approved) {
          return {
            success: false,
            error: `Execution denied: User rejected terminal command: "${command}"`
          };
        }
      } catch (confirmErr) {
        return {
          success: false,
          error: `Execution rejected: Confirmation failed or timed out (${confirmErr.message})`
        };
      }
    }

    // Determine shell arguments based on OS
    const isWin = process.platform === 'win32';
    let shellExecutable;
    let shellArgs;

    // Auto-protect Gradle commands with --no-daemon to prevent background daemon from holding stdio pipes
    let effectiveCommand = command;
    if (/\bgradlew?(\.bat)?\b/i.test(effectiveCommand) && !effectiveCommand.includes('--no-daemon')) {
      effectiveCommand = `${effectiveCommand} --no-daemon`;
    }

    if (isWin) {
      if (this.shell === 'cmd') {
        shellExecutable = 'cmd.exe';
        shellArgs = ['/c', effectiveCommand];
      } else {
        // Default PowerShell
        shellExecutable = 'powershell.exe';
        shellArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', effectiveCommand];
      }
    } else {
      shellExecutable = '/bin/bash';
      shellArgs = ['-c', effectiveCommand];
    }

    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killedDueToTimeout = false;
      let isResolved = false;
      let exitCode = null;

      const finishExecution = (codeOverride = null) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timer);
        this.activeProcesses.delete(requestId);

        // Destroy stdio streams if still open to avoid lingering inherited handles
        try {
          if (child && child.stdout && !child.stdout.destroyed) child.stdout.destroy();
          if (child && child.stderr && !child.stderr.destroyed) child.stderr.destroy();
        } catch (e) {}

        const finalCode = codeOverride !== null ? codeOverride : (exitCode !== null ? exitCode : (killedDueToTimeout ? -1 : 0));
        const executionTimeMs = Date.now() - startTime;

        if (killedDueToTimeout) {
          return resolve({
            success: false,
            error: `Command timed out after ${timeoutSeconds} seconds. If this task legitimately requires more time (such as heavy compilations or large file operations), call execute_terminal_command with a higher timeout_seconds parameter.`,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            executionTimeMs
          });
        }

        resolve({
          success: finalCode === 0,
          exitCode: finalCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          executionTimeMs
        });
      };

      let child;
      try {
        child = spawn(shellExecutable, shellArgs, {
          cwd: this.workspaceRoot,
          windowsHide: true,
          env: { ...process.env, CI: 'true' }
        });
      } catch (spawnErr) {
        return resolve({
          success: false,
          error: `Failed to spawn process: ${spawnErr.message}`
        });
      }

      this.activeProcesses.set(requestId, child);

      const timeoutMs = timeoutSeconds * 1000;
      const timer = setTimeout(() => {
        killedDueToTimeout = true;
        try {
          if (isWin) {
            // Force kill child process tree on Windows
            spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
          } else {
            child.kill('SIGKILL');
          }
        } catch (killErr) {
          console.error('Error killing timed out process:', killErr);
        }

        // Guarantee resolution after 500ms even if taskkill or close event stalls
        setTimeout(() => {
          finishExecution(-1);
        }, 500);
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        if (this.outputCallback) {
          this.outputCallback({ stream: 'stdout', text });
        }
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        if (this.outputCallback) {
          this.outputCallback({ stream: 'stderr', text });
        }
      });

      child.on('error', (err) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timer);
        this.activeProcesses.delete(requestId);
        resolve({
          success: false,
          error: `Terminal error: ${err.message}`,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      child.on('exit', (code) => {
        exitCode = code;
        // Allow up to 300ms for final buffers to flush in 'close'
        // But do not hang if a background daemon keeps stdio open
        setTimeout(() => {
          finishExecution(code);
        }, 300);
      });

      child.on('close', (code) => {
        exitCode = code;
        finishExecution(code);
      });
    });
  }

  cancelAll() {
    for (const [id, child] of this.activeProcesses.entries()) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
        } else {
          child.kill('SIGKILL');
        }
        if (child.stdout && !child.stdout.destroyed) child.stdout.destroy();
        if (child.stderr && !child.stderr.destroyed) child.stderr.destroy();
      } catch (err) {
        console.error(`Error terminating process ${id}:`, err);
      }
    }
    this.activeProcesses.clear();
  }
}

module.exports = { TerminalExecutor, isDestructiveCommand };
