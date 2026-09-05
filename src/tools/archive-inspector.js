const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

class ArchiveInspector {
  constructor(workspaceRoot = null) {
    this.workspaceRoot = workspaceRoot;
    this.confirmCallback = null;
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
  }

  setConfirmCallback(fn) {
    this.confirmCallback = fn;
  }

  /**
   * Resolves archive path and checks confirmation if external.
   */
  async resolveArchiveSafe(archivePath) {
    if (!archivePath || typeof archivePath !== 'string') {
      throw new Error("Invalid archive path provided.");
    }

    let resolvedPath;
    if (path.isAbsolute(archivePath)) {
      resolvedPath = path.resolve(archivePath);
    } else if (this.workspaceRoot) {
      resolvedPath = path.resolve(this.workspaceRoot, archivePath);
    } else {
      resolvedPath = path.resolve(process.cwd(), archivePath);
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Archive file not found: ${archivePath}`);
    }

    // Check if outside workspace
    const isOutside = this.workspaceRoot 
      ? !resolvedPath.startsWith(path.resolve(this.workspaceRoot))
      : true;

    if (isOutside && this.confirmCallback) {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const approved = await this.confirmCallback({
        id: requestId,
        type: 'EXTERNAL_PATH',
        action: 'inspect_archive',
        path: resolvedPath,
        description: `Inspect contents of archive: ${path.basename(resolvedPath)}`
      });

      if (!approved) {
        throw new Error(`Access denied: User rejected inspection of external archive: "${archivePath}"`);
      }
    }

    return resolvedPath;
  }

  /**
   * List all files and folders inside a .jar or .zip archive.
   */
  async listEntries(archivePath) {
    try {
      const fullPath = await this.resolveArchiveSafe(archivePath);

      return new Promise((resolve) => {
        execFile('tar', ['-tf', fullPath], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            return resolve({
              success: false,
              path: fullPath,
              error: `Failed to inspect archive: ${stderr || err.message}`
            });
          }

          const rawLines = stdout.split(/\r?\n/).filter(line => line.trim().length > 0);
          const directories = [];
          const files = [];
          let detectedPluginType = 'Standard Jar';

          rawLines.forEach(item => {
            const trimmed = item.trim();
            if (trimmed.endsWith('/')) {
              directories.push(trimmed);
            } else {
              files.push(trimmed);
              if (trimmed === 'plugin.yml') detectedPluginType = 'Bukkit / Spigot / Paper Plugin';
              else if (trimmed === 'paper-plugin.yml') detectedPluginType = 'Paper Plugin (Modern)';
              else if (trimmed === 'fabric.mod.json') detectedPluginType = 'Fabric Mod';
              else if (trimmed === 'quilt.mod.json') detectedPluginType = 'Quilt Mod';
              else if (trimmed === 'mcmod.info' || trimmed === 'META-INF/mods.toml') detectedPluginType = 'Forge / NeoForge Mod';
              else if (trimmed === 'velocity-plugin.json') detectedPluginType = 'Velocity Proxy Plugin';
              else if (trimmed === 'bungee.yml') detectedPluginType = 'BungeeCord Plugin';
            }
          });

          resolve({
            success: true,
            path: fullPath,
            fileName: path.basename(fullPath),
            detectedPluginType: detectedPluginType,
            totalEntries: rawLines.length,
            totalFiles: files.length,
            totalDirectories: directories.length,
            entries: rawLines.slice(0, 500),
            hasMoreEntries: rawLines.length > 500,
            keyManifestFiles: files.filter(f => 
              f === 'plugin.yml' || 
              f === 'paper-plugin.yml' || 
              f === 'fabric.mod.json' || 
              f === 'quilt.mod.json' || 
              f === 'META-INF/MANIFEST.MF' || 
              f.endsWith('.yml') || 
              f.endsWith('.json')
            )
          });
        });
      });
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Read text content of a specific file inside a .jar or .zip archive.
   */
  async readEntry(archivePath, internalFilePath) {
    try {
      const fullPath = await this.resolveArchiveSafe(archivePath);

      if (!internalFilePath || typeof internalFilePath !== 'string') {
        return {
          success: false,
          error: "No internal file path specified to read."
        };
      }

      return new Promise((resolve) => {
        execFile('tar', ['-xOf', fullPath, internalFilePath], { maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            return resolve({
              success: false,
              archivePath: fullPath,
              internalFilePath: internalFilePath,
              error: `Failed to read "${internalFilePath}" from archive: ${stderr || err.message}`
            });
          }

          resolve({
            success: true,
            archivePath: fullPath,
            internalFilePath: internalFilePath,
            size: Buffer.byteLength(stdout, 'utf8'),
            content: stdout
          });
        });
      });
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = { ArchiveInspector };
