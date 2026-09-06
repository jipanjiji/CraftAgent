const fs = require('fs');
const path = require('path');

class WorkspaceScanner {
  constructor(workspaceRoot = null, defaultIgnored = null) {
    this.workspaceRoot = workspaceRoot;
    this.confirmCallback = null;
    this.defaultIgnored = defaultIgnored || [
      'target',
      '.gradle',
      '.idea',
      '.git',
      'node_modules',
      '.vscode',
      'dist',
      '.craft',
      '.DS_Store'
    ];
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
  }

  setConfirmCallback(fn) {
    this.confirmCallback = fn;
  }

  setIgnoredPatterns(patterns) {
    if (Array.isArray(patterns)) {
      this.defaultIgnored = patterns;
    }
  }

  /**
   * Reads .forgeignore if present in workspace root and combines with default ignored patterns.
   */
  getIgnoreList() {
    const list = new Set(this.defaultIgnored);
    if (!this.workspaceRoot) return Array.from(list);

    const forgeignorePath = path.join(this.workspaceRoot, '.forgeignore');
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');

    // Load .forgeignore first
    if (fs.existsSync(forgeignorePath)) {
      try {
        const content = fs.readFileSync(forgeignorePath, 'utf8');
        content.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'))
          .forEach(pattern => list.add(pattern));
      } catch (err) {
        console.error('Failed to read .forgeignore:', err);
      }
    } else if (fs.existsSync(gitignorePath)) {
      // Optional fallback to .gitignore
      try {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        content.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'))
          .forEach(pattern => list.add(pattern));
      } catch (err) {
        console.error('Failed to read .gitignore:', err);
      }
    }

    return Array.from(list);
  }

  isIgnored(name, relPath, ignoreList) {
    for (const rawPattern of ignoreList) {
      const pattern = rawPattern.replace(/\/$/, '').trim();
      if (!pattern) continue;

      // Exact match on folder/file name
      if (name === pattern) return true;

      // Wildcard match (e.g., *.jar)
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        if (name.endsWith(ext)) return true;
      }

      // Path contains ignored directory
      const normalizedRel = relPath.replace(/\\/g, '/');
      if (normalizedRel === pattern || normalizedRel.startsWith(pattern + '/') || normalizedRel.includes('/' + pattern + '/')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scans the workspace or an external directory (with approval) and builds an indented ASCII structure string.
   * Max depth: 8 levels, Max items: 600 items.
   */
  async scan(targetPath = null, maxDepth = 8, maxItems = 600) {
    let scanDir = this.workspaceRoot;

    if (targetPath && typeof targetPath === 'string') {
      if (path.isAbsolute(targetPath)) {
        scanDir = path.resolve(targetPath);
      } else if (this.workspaceRoot) {
        scanDir = path.resolve(this.workspaceRoot, targetPath);
      } else {
        scanDir = path.resolve(process.cwd(), targetPath);
      }

      // Check external path
      const isOutside = this.workspaceRoot 
        ? !scanDir.startsWith(path.resolve(this.workspaceRoot))
        : true;

      if (isOutside && this.confirmCallback) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const approved = await this.confirmCallback({
          id: requestId,
          type: 'EXTERNAL_PATH',
          action: 'scan_directory',
          path: scanDir,
          description: `Scan directory structure: ${path.basename(scanDir)}`
        });

        if (!approved) {
          return {
            success: false,
            error: `Access denied: User rejected scan of external directory: "${targetPath}"`
          };
        }
      }
    }

    if (!scanDir) {
      return {
        success: false,
        error: "No active workspace or target directory selected."
      };
    }

    if (!fs.existsSync(scanDir)) {
      return {
        success: false,
        error: `Target directory does not exist: ${scanDir}`
      };
    }

    const ignoreList = this.getIgnoreList();
    let itemCount = 0;
    let truncated = false;

    const buildTree = (dir, depth, prefix = '') => {
      if (depth > maxDepth || itemCount >= maxItems) {
        if (itemCount >= maxItems) truncated = true;
        return [];
      }

      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        return [`${prefix}└── [Error reading directory: ${err.message}]`];
      }

      // Sort directories first, then alphabetical
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const lines = [];

      for (let i = 0; i < entries.length; i++) {
        if (itemCount >= maxItems) {
          truncated = true;
          break;
        }

        const entry = entries[i];
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(scanDir, fullPath);

        if (this.isIgnored(entry.name, relPath, ignoreList)) {
          continue;
        }

        itemCount++;
        const isLast = i === entries.length - 1;
        const branch = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');

        if (entry.isDirectory()) {
          lines.push(`${prefix}${branch}${entry.name}/`);
          const subLines = buildTree(fullPath, depth + 1, childPrefix);
          lines.push(...subLines);
        } else {
          lines.push(`${prefix}${branch}${entry.name}`);
        }
      }

      return lines;
    };

    const rootName = path.basename(scanDir) || 'root';
    const lines = [`${rootName}/`];
    lines.push(...buildTree(scanDir, 1, ''));

    if (truncated) {
      lines.push(`... [Tree truncated after ${maxItems} items for brevity]`);
    }

    return {
      success: true,
      workspaceRoot: scanDir,
      totalItemsScanned: itemCount,
      tree: lines.join('\n')
    };
  }
}

module.exports = { WorkspaceScanner };
