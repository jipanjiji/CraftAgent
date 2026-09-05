const fs = require('fs');
const path = require('path');

class FileManager {
  constructor(workspaceRoot = null, maxReadSize = 512000) {
    this.workspaceRoot = workspaceRoot;
    this.maxReadSize = maxReadSize;
    this.confirmCallback = null;
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
  }

  setMaxReadSize(size) {
    this.maxReadSize = size;
  }

  setConfirmCallback(fn) {
    this.confirmCallback = fn;
  }

  /**
   * Validate and resolve path.
   * If inside workspace, resolves immediately.
   * If outside workspace, prompts user via confirmCallback if configured.
   */
  async resolvePathWithApproval(targetPath, action = 'read_file') {
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error("Invalid file path specified.");
    }

    let resolvedTarget;
    if (path.isAbsolute(targetPath)) {
      resolvedTarget = path.resolve(targetPath);
    } else if (this.workspaceRoot) {
      resolvedTarget = path.resolve(this.workspaceRoot, targetPath);
    } else {
      resolvedTarget = path.resolve(process.cwd(), targetPath);
    }

    if (!this.workspaceRoot) {
      // If no workspace is selected, any access is external
      if (this.confirmCallback) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const approved = await this.confirmCallback({
          id: requestId,
          type: 'EXTERNAL_PATH',
          action: action,
          path: resolvedTarget,
          description: `${action} on: ${path.basename(resolvedTarget)}`
        });
        if (!approved) {
          throw new Error(`Access denied: User rejected file access to "${targetPath}".`);
        }
        return resolvedTarget;
      }
      throw new Error("No active workspace selected. Please select a workspace folder first.");
    }

    const resolvedRoot = path.resolve(this.workspaceRoot);

    // If within workspace boundaries, allow immediately
    if (resolvedTarget.startsWith(resolvedRoot)) {
      return resolvedTarget;
    }

    // Path is outside workspace boundaries
    if (this.confirmCallback) {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const approved = await this.confirmCallback({
        id: requestId,
        type: 'EXTERNAL_PATH',
        action: action,
        path: resolvedTarget,
        description: `${action} on external file: ${path.basename(resolvedTarget)}`
      });

      if (!approved) {
        throw new Error(`Access denied: User rejected external path access to "${targetPath}".`);
      }

      return resolvedTarget;
    }

    throw new Error(`Access denied: Path "${targetPath}" is outside workspace boundaries.`);
  }

  /**
   * Synchronous safe path resolver strictly confined to workspace.
   */
  resolveSafePath(targetPath) {
    if (!this.workspaceRoot) {
      throw new Error("No active workspace selected. Please select a workspace folder first.");
    }

    const resolvedRoot = path.resolve(this.workspaceRoot);
    const resolvedTarget = path.isAbsolute(targetPath) 
      ? path.resolve(targetPath)
      : path.resolve(resolvedRoot, targetPath);

    // Prevent directory traversal attacks
    if (!resolvedTarget.startsWith(resolvedRoot)) {
      throw new Error(`Access denied: Path "${targetPath}" is outside workspace boundaries.`);
    }

    return resolvedTarget;
  }

  /**
   * Reads a file within or outside workspace (with approval) up to maxReadSize bytes.
   */
  async readFile(relativePath) {
    try {
      const fullPath = await this.resolvePathWithApproval(relativePath, 'read_file');

      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `File not found: ${relativePath}`
        };
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return {
          success: false,
          error: `Cannot read directory as file: ${relativePath}`
        };
      }

      if (stat.size > this.maxReadSize) {
        return {
          success: false,
          error: `File size (${stat.size} bytes) exceeds maximum allowable limit (${this.maxReadSize} bytes / 500KB). Consider reading specific parts or inspecting workspace structure instead.`
        };
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const rel = path.relative(this.workspaceRoot, fullPath);

      return {
        success: true,
        path: rel,
        size: stat.size,
        content: content
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Writes or overwrites a file inside or outside workspace (with approval).
   * Automatically creates intermediate directories.
   */
  async writeFile(relativePath, content) {
    try {
      const fullPath = await this.resolvePathWithApproval(relativePath, 'write_file');
      const parentDir = path.dirname(fullPath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf8');
      const stat = fs.statSync(fullPath);
      const displayPath = this.workspaceRoot && fullPath.startsWith(path.resolve(this.workspaceRoot))
        ? path.relative(this.workspaceRoot, fullPath)
        : fullPath;

      return {
        success: true,
        path: displayPath,
        bytesWritten: stat.size,
        message: `Successfully wrote ${stat.size} bytes to ${displayPath}`
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Patches a file by finding a specific block of text and replacing it.
   * Handles CRLF / LF discrepancies gracefully.
   */
  async patchFile(relativePath, searchBlock, replaceBlock) {
    try {
      const fullPath = await this.resolvePathWithApproval(relativePath, 'patch_file');

      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `File not found for patching: ${relativePath}`
        };
      }

      const original = fs.readFileSync(fullPath, 'utf8');
      const displayPath = this.workspaceRoot && fullPath.startsWith(path.resolve(this.workspaceRoot))
        ? path.relative(this.workspaceRoot, fullPath)
        : fullPath;

      // Attempt direct match
      if (original.includes(searchBlock)) {
        const updated = original.replace(searchBlock, replaceBlock);
        fs.writeFileSync(fullPath, updated, 'utf8');
        return {
          success: true,
          path: displayPath,
          message: `Successfully patched ${displayPath}`
        };
      }

      // Try normalizing line endings to LF
      const normOriginal = original.replace(/\r\n/g, '\n');
      const normSearch = searchBlock.replace(/\r\n/g, '\n');
      const normReplace = replaceBlock.replace(/\r\n/g, '\n');

      if (normOriginal.includes(normSearch)) {
        // Detect if file originally used CRLF
        const usesCRLF = original.includes('\r\n');
        let updated = normOriginal.replace(normSearch, normReplace);
        if (usesCRLF) {
          updated = updated.replace(/\n/g, '\r\n');
        }
        fs.writeFileSync(fullPath, updated, 'utf8');
        return {
          success: true,
          path: displayPath,
          message: `Successfully patched ${displayPath} (normalized line endings)`
        };
      }

      return {
        success: false,
        error: `Could not find exact search_block in ${relativePath}. Make sure search_block matches the current file contents exactly, including indentation.`
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Downloads a remote file directly into the workspace or destination.
   */
  async downloadFile(url, relativePath) {
    try {
      const fullPath = await this.resolvePathWithApproval(relativePath, 'download_file');
      const parentDir = path.dirname(fullPath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Download failed with HTTP ${res.status}: ${res.statusText}`
        };
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(fullPath, buffer);

      const displayPath = this.workspaceRoot && fullPath.startsWith(path.resolve(this.workspaceRoot))
        ? path.relative(this.workspaceRoot, fullPath)
        : fullPath;

      return {
        success: true,
        path: displayPath,
        bytesDownloaded: buffer.length,
        message: `Successfully downloaded ${buffer.length} bytes to ${displayPath}`
      };
    } catch (err) {
      return {
        success: false,
        error: `Download error: ${err.message}`
      };
    }
  }
}

module.exports = { FileManager };
