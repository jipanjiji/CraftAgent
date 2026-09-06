/**
 * High-performance, zero-dependency LCS (Longest Common Subsequence) diff generator.
 * Produces structured diff lines, hunk ranges, and line numbers for visual diff rendering.
 */

class DiffEngine {
  /**
   * Generates a structured diff between oldText and newText.
   * @param {string} oldText - Original file text
   * @param {string} newText - Modified file text
   * @param {string} [filePath] - Optional file path label
   * @returns {Object} Structured diff data with stats and lines
   */
  static generateDiff(oldText, newText, filePath = '') {
    const oldLines = (oldText || '').replace(/\r\n/g, '\n').split('\n');
    const newLines = (newText || '').replace(/\r\n/g, '\n').split('\n');

    // Edge case: identical content
    if (oldText === newText) {
      return {
        filePath,
        stats: { additions: 0, deletions: 0, unchanged: oldLines.length },
        lines: oldLines.map((line, idx) => ({
          type: 'context',
          oldLineNo: idx + 1,
          newLineNo: idx + 1,
          content: line
        }))
      };
    }

    // Compute LCS matrix
    const n = oldLines.length;
    const m = newLines.length;

    // Optimization for large files: if line count > 2000, do line-trimmed diff or limit
    const maxMatrix = 2500;
    if (n > maxMatrix || m > maxMatrix) {
      return this._fallbackLineDiff(oldLines, newLines, filePath);
    }

    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to build diff lines
    let i = n;
    let j = m;
    const diffReverse = [];
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        diffReverse.push({
          type: 'context',
          oldLineNo: i,
          newLineNo: j,
          content: oldLines[i - 1]
        });
        i--;
        j--;
        unchanged++;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diffReverse.push({
          type: 'addition',
          oldLineNo: null,
          newLineNo: j,
          content: newLines[j - 1]
        });
        j--;
        additions++;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        diffReverse.push({
          type: 'deletion',
          oldLineNo: i,
          newLineNo: null,
          content: oldLines[i - 1]
        });
        i--;
        deletions++;
      }
    }

    const diffLines = diffReverse.reverse();

    return {
      filePath,
      stats: { additions, deletions, unchanged },
      lines: diffLines
    };
  }

  /**
   * Fast fallback diff for very large files.
   */
  static _fallbackLineDiff(oldLines, newLines, filePath) {
    let additions = 0;
    let deletions = 0;
    const lines = [];

    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        lines.push({
          type: 'context',
          oldLineNo: i + 1,
          newLineNo: j + 1,
          content: oldLines[i]
        });
        i++;
        j++;
      } else if (i < oldLines.length) {
        lines.push({
          type: 'deletion',
          oldLineNo: i + 1,
          newLineNo: null,
          content: oldLines[i]
        });
        i++;
        deletions++;
      } else if (j < newLines.length) {
        lines.push({
          type: 'addition',
          oldLineNo: null,
          newLineNo: j + 1,
          content: newLines[j]
        });
        j++;
        additions++;
      }
    }

    return {
      filePath,
      stats: { additions, deletions, unchanged: lines.length - additions - deletions },
      lines
    };
  }
}

module.exports = { DiffEngine };
