const fs = require('fs');
const path = require('path');

class WorkspaceScanner {
  constructor(workspaceRoot = null, defaultIgnored = null) {
    this.workspaceRoot = workspaceRoot;
    this.defaultIgnored = defaultIgnored || [
      'target',
      '.gradle',
      '.idea',
      '.git',
      'node_modules',
      '.vscode',
      'dist',
      '.DS_Store'
    ];
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
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
   * Scans the workspace and builds an indented ASCII structure string.
   * Max depth: 8 levels, Max items: 600 items.
   */
  scan(maxDepth = 8, maxItems = 600) {
    if (!this.workspaceRoot) {
      return {
        success: false,
        error: "No active workspace selected."
      };
    }

    if (!fs.existsSync(this.workspaceRoot)) {
      return {
        success: false,
        error: `Workspace directory does not exist: ${this.workspaceRoot}`
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
        const relPath = path.relative(this.workspaceRoot, fullPath);

        if (this.isIgnored(entry.name, relPath, ignoreList)) {
          continue;
        }

        itemCount++;
        const isLast = i === entries.length - 1;
        const branch = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');

        if (entry.isDirectory()) {
          lines.push(`${prefix}${branch}📁 ${entry.name}/`);
          const subLines = buildTree(fullPath, depth + 1, childPrefix);
          lines.push(...subLines);
        } else {
          lines.push(`${prefix}${branch}📄 ${entry.name}`);
        }
      }

      return lines;
    };

    const rootName = path.basename(this.workspaceRoot) || 'root';
    const lines = [`📁 ${rootName}/`];
    lines.push(...buildTree(this.workspaceRoot, 1, ''));

    if (truncated) {
      lines.push(`... [Tree truncated after ${maxItems} items for brevity]`);
    }

    return {
      success: true,
      workspaceRoot: this.workspaceRoot,
      totalItemsScanned: itemCount,
      tree: lines.join('\n')
    };
  }
}

module.exports = { WorkspaceScanner };
