const https = require('https');
const fs = require('fs');
const path = require('path');

class ModrinthService {
  constructor(workspaceRoot = null) {
    this.workspaceRoot = workspaceRoot;
    this.baseUrl = 'https://api.modrinth.com/v2';
    this.userAgent = 'CraftAgent/1.0.5 (Minecraft Dev Pair Programmer)';
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
  }

  _request(endpoint, method = 'GET') {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(body));
            } else {
              reject(new Error(`Modrinth API error ${res.statusCode}: ${body}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Modrinth response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Searches projects in Modrinth.
   * projectType: 'mod' | 'resourcepack' | 'datapack' | 'shader' | 'modpack' | 'plugin'
   * sortBy: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
   */
  async searchProjects({
    query = '',
    projectType = 'plugin',
    loader = '',
    gameVersion = '',
    sortBy = 'downloads',
    limit = 20,
    offset = 0
  } = {}) {
    const facets = [];
    if (projectType) {
      facets.push([`project_type:${projectType}`]);
    }
    if (loader && loader !== 'all') {
      facets.push([`categories:${loader.toLowerCase()}`]);
    }
    if (gameVersion && gameVersion !== 'all') {
      facets.push([`versions:${gameVersion}`]);
    }

    const params = new URLSearchParams();
    if (query && query.trim()) params.append('query', query.trim());
    if (facets.length > 0) params.append('facets', JSON.stringify(facets));
    if (sortBy) params.append('index', sortBy);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const result = await this._request(`/search?${params.toString()}`);
    return {
      totalHits: result.total_hits || 0,
      hits: result.hits || [],
      offset: result.offset || 0,
      limit: result.limit || limit
    };
  }

  /**
   * Retrieves single project details.
   */
  async getProject(slugOrId) {
    return await this._request(`/project/${encodeURIComponent(slugOrId)}`);
  }

  /**
   * Retrieves multiple projects by IDs (batch request for dependencies).
   */
  async getProjects(ids = []) {
    if (!ids || ids.length === 0) return [];
    return await this._request(`/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`);
  }

  /**
   * Retrieves versions for a project.
   */
  async getProjectVersions(slugOrId, loaders = [], gameVersions = []) {
    const params = new URLSearchParams();
    if (loaders && loaders.length > 0) params.append('loaders', JSON.stringify(loaders));
    if (gameVersions && gameVersions.length > 0) params.append('game_versions', JSON.stringify(gameVersions));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await this._request(`/project/${encodeURIComponent(slugOrId)}/version${qs}`);
  }

  /**
   * Direct download of a release file into workspace or target destination.
   */
  async downloadVersionFile({ fileUrl, targetFilename, projectType = 'plugin', destinationPath = null }) {
    return new Promise((resolve, reject) => {
      let targetDir = '';
      if (destinationPath) {
        targetDir = destinationPath;
      } else if (this.workspaceRoot) {
        // Automatically route to standard Minecraft subdirectories
        switch (projectType) {
          case 'plugin':
            targetDir = path.join(this.workspaceRoot, 'plugins');
            break;
          case 'mod':
            targetDir = path.join(this.workspaceRoot, 'mods');
            break;
          case 'shader':
            targetDir = path.join(this.workspaceRoot, 'shaderpacks');
            break;
          case 'resourcepack':
            targetDir = path.join(this.workspaceRoot, 'resourcepacks');
            break;
          case 'datapack':
            targetDir = path.join(this.workspaceRoot, 'datapacks');
            break;
          default:
            targetDir = this.workspaceRoot;
        }
      } else {
        // Fallback to downloads or cwd
        targetDir = path.join(process.cwd(), 'downloads');
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const finalPath = path.join(targetDir, targetFilename);
      const url = new URL(fileUrl);

      const req = https.get(url, {
        headers: { 'User-Agent': this.userAgent }
      }, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.downloadVersionFile({
            fileUrl: res.headers.location,
            targetFilename,
            projectType,
            destinationPath: targetDir
          }).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(finalPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            const stat = fs.statSync(finalPath);
            const relPath = this.workspaceRoot && finalPath.startsWith(path.resolve(this.workspaceRoot))
              ? path.relative(this.workspaceRoot, finalPath)
              : finalPath;

            resolve({
              success: true,
              filename: targetFilename,
              fullPath: finalPath,
              relativePath: relPath,
              sizeBytes: stat.size
            });
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(finalPath, () => {});
          reject(err);
        });
      });

      req.on('error', reject);
    });
  }
}

module.exports = { ModrinthService };
