const fs = require('fs');
const path = require('path');

class WorkspaceMemory {
  constructor(workspaceRoot = null) {
    this.workspaceRoot = workspaceRoot;
  }

  setWorkspaceRoot(root) {
    this.workspaceRoot = root;
  }

  getMemoryFilePath() {
    if (!this.workspaceRoot) return null;
    return path.join(this.workspaceRoot, '.craft', 'memory.json');
  }

  getDefaultMemory() {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      projectContext: {
        name: this.workspaceRoot ? path.basename(this.workspaceRoot) : 'Unknown Project',
        type: 'Minecraft / Java Workspace',
        javaVersion: 'Java 21',
        buildTool: 'Gradle',
        serverPlatform: 'Paper'
      },
      activeGoals: [],
      completedMilestones: [],
      notes: []
    };
  }

  load() {
    const filePath = this.getMemoryFilePath();
    if (!filePath || !fs.existsSync(filePath)) {
      return this.getDefaultMemory();
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...this.getDefaultMemory(),
        ...parsed,
        projectContext: {
          ...this.getDefaultMemory().projectContext,
          ...(parsed.projectContext || {})
        },
        activeGoals: Array.isArray(parsed.activeGoals) ? parsed.activeGoals : [],
        completedMilestones: Array.isArray(parsed.completedMilestones) ? parsed.completedMilestones : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : []
      };
    } catch (err) {
      console.warn('Failed to parse .craft/memory.json, returning defaults:', err.message);
      return this.getDefaultMemory();
    }
  }

  save(data) {
    const filePath = this.getMemoryFilePath();
    if (!filePath) return false;

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Failed to write .craft/memory.json:', err.message);
      return false;
    }
  }

  /**
   * Updates memory fields from agent tool call or system actions.
   */
  update({ project_facts, active_goals, completed_goals, add_notes }) {
    const mem = this.load();

    if (project_facts && typeof project_facts === 'object') {
      mem.projectContext = {
        ...mem.projectContext,
        ...project_facts
      };
    }

    if (Array.isArray(active_goals)) {
      mem.activeGoals = active_goals.map(g => String(g).trim()).filter(Boolean);
    }

    if (Array.isArray(completed_goals)) {
      const newDone = completed_goals.map(g => String(g).trim()).filter(Boolean);
      mem.completedMilestones = Array.from(new Set([...mem.completedMilestones, ...newDone]));
    }

    if (add_notes) {
      if (Array.isArray(add_notes)) {
        mem.notes.push(...add_notes.map(n => String(n).trim()).filter(Boolean));
      } else if (typeof add_notes === 'string' && add_notes.trim()) {
        mem.notes.push(add_notes.trim());
      }
      // Keep notes bounded to last 30 items
      if (mem.notes.length > 30) {
        mem.notes = mem.notes.slice(-30);
      }
    }

    const saved = this.save(mem);
    return {
      success: saved,
      memory: mem
    };
  }

  /**
   * Generates a concise markdown prompt snippet for the system prompt.
   */
  getFormattedPrompt() {
    if (!this.workspaceRoot) return '';

    const mem = this.load();
    const sections = [];

    // Project Facts
    const facts = [];
    if (mem.projectContext.name) facts.push(`Project: ${mem.projectContext.name}`);
    if (mem.projectContext.type) facts.push(`Type: ${mem.projectContext.type}`);
    if (mem.projectContext.javaVersion) facts.push(`Java: ${mem.projectContext.javaVersion}`);
    if (mem.projectContext.buildTool) facts.push(`Build Tool: ${mem.projectContext.buildTool}`);
    if (mem.projectContext.serverPlatform) facts.push(`Platform: ${mem.projectContext.serverPlatform}`);

    if (facts.length > 0) {
      sections.push(`- Project Facts: ${facts.join(' | ')}`);
    }

    // Active Goals
    if (mem.activeGoals.length > 0) {
      sections.push(`- Active Tasks & Goals:\n  ${mem.activeGoals.map(g => `* [ ] ${g}`).join('\n  ')}`);
    }

    // Completed Milestones
    if (mem.completedMilestones.length > 0) {
      // Show up to last 10 completed milestones
      const recent = mem.completedMilestones.slice(-10);
      sections.push(`- Completed Milestones (Already Finished):\n  ${recent.map(m => `* [x] ${m}`).join('\n  ')}`);
    }

    // Persistent Notes
    if (mem.notes.length > 0) {
      const recentNotes = mem.notes.slice(-8);
      sections.push(`- Workspace Notes & Preferences:\n  ${recentNotes.map(n => `* ${n}`).join('\n  ')}`);
    }

    if (sections.length === 0) return '';

    return `### PERSISTENT WORKSPACE MEMORY (.craft/memory.json):\n${sections.join('\n\n')}\n(Use the "update_workspace_memory" tool whenever you discover project architecture or complete a goal.)`;
  }
}

module.exports = { WorkspaceMemory };
