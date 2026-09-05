/**
 * Fast Token Estimator:
 * Average ~3.8 characters per token for English, Indonesian, code, and JSON symbols.
 */
function estimateTokens(content) {
  if (!content) return 0;
  if (typeof content !== 'string') {
    try {
      content = JSON.stringify(content);
    } catch (e) {
      content = String(content);
    }
  }
  return Math.ceil(content.length / 3.8);
}

/**
 * Head-Tail Tool Content Pruner (Feature 1):
 * If a tool output exceeds maxChars (default 5000 chars / ~1300 tokens),
 * keep headLines (30) and tailLines (45) and neatly omit the middle.
 */
function pruneToolContent(content, maxChars = 5000, headLines = 30, tailLines = 45) {
  if (!content || typeof content !== 'string') return content;
  if (content.length <= maxChars) return content;

  const lines = content.split('\n');
  if (lines.length <= (headLines + tailLines + 5)) {
    const half = Math.floor(maxChars / 2);
    return content.slice(0, half) + `\n\n... [${content.length - maxChars} characters omitted for context token efficiency] ...\n\n` + content.slice(-half);
  }

  const head = lines.slice(0, headLines).join('\n');
  const tail = lines.slice(-tailLines).join('\n');
  const omittedLines = lines.length - (headLines + tailLines);
  return `${head}\n\n... [Output truncated: ${omittedLines} lines omitted for context token efficiency] ...\n\n${tail}`;
}

class HistoryManager {
  constructor(maxMessages = 20, maxTokenBudget = 36000) {
    this.maxMessages = maxMessages;
    this.maxTokenBudget = maxTokenBudget;
    // Internal history of user/assistant/tool messages (excluding system prompt)
    this.messages = [];
    // Feature 3: Rolling progress summarizer of earlier completed actions
    this.cumulativeMilestones = [];
  }

  setMaxMessages(max) {
    this.maxMessages = parseInt(max, 10) || 20;
  }

  setMaxTokenBudget(budget) {
    this.maxTokenBudget = parseInt(budget, 10) || 36000;
  }

  /**
   * Appends a message to the history.
   * Format: { role: 'user'|'assistant'|'tool', content: string, tool_calls?: [], tool_call_id?: string, name?: string }
   */
  addMessage(msg) {
    this.messages.push(msg);
  }

  clearHistory() {
    this.messages = [];
    this.cumulativeMilestones = [];
  }

  setHistory(messages) {
    if (Array.isArray(messages)) {
      this.messages = [...messages];
    }
  }

  getAllMessages() {
    return [...this.messages];
  }

  /**
   * Feature 3: Extracts completed actions from messages that are about to be sliced out
   * so earlier progress is never lost from the AI's mind.
   */
  _extractAndRecordMilestones(discardedMessages) {
    if (!Array.isArray(discardedMessages) || discardedMessages.length === 0) return;

    for (let i = 0; i < discardedMessages.length; i++) {
      const msg = discardedMessages[i];
      if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const fnName = tc.function?.name;
          let args = {};
          try {
            args = typeof tc.function?.arguments === 'string' 
              ? JSON.parse(tc.function.arguments) 
              : (tc.function?.arguments || {});
          } catch (e) {
            args = {};
          }

          // Find corresponding tool result if available
          const toolResultMsg = discardedMessages.find(m => m.role === 'tool' && m.tool_call_id === tc.id);
          let success = true;
          if (toolResultMsg) {
            try {
              const res = JSON.parse(toolResultMsg.content);
              if (res && res.success === false) success = false;
            } catch (e) {}
          }

          let milestone = null;
          switch (fnName) {
            case 'execute_terminal_command':
              milestone = success 
                ? `Ran command: "${args.command || '...'}"`
                : `Command failed: "${args.command || '...'}"`;
              break;
            case 'write_file':
              milestone = `Created/Overwrote file: ${args.path || '...'}`;
              break;
            case 'patch_file':
              milestone = `Modified/Patched file: ${args.path || '...'}`;
              break;
            case 'inspect_jar':
              milestone = args.internal_file 
                ? `Inspected "${args.internal_file}" inside archive: ${args.path || '...'}`
                : `Inspected archive contents: ${args.path || '...'}`;
              break;
            case 'download_file':
              milestone = `Downloaded file to: ${args.path || '...'}`;
              break;
            case 'update_workspace_memory':
              milestone = `Updated persistent workspace memory (.craft/memory.json)`;
              break;
            default:
              break;
          }

          if (milestone && !this.cumulativeMilestones.includes(milestone)) {
            this.cumulativeMilestones.push(milestone);
          }
        }
      }
    }

    // Keep cumulative milestones bounded to last 20 key actions
    if (this.cumulativeMilestones.length > 20) {
      this.cumulativeMilestones = this.cumulativeMilestones.slice(-20);
    }
  }

  /**
   * Prepares message array for OpenAI API payload with:
   * 1. Token-based budgeting & Smart sliding window (Feature 2)
   * 2. Rolling compaction & progress summary (Feature 3)
   * 3. Session goal context pinning
   * 4. Strict tool call / response pairing integrity
   */
  getMessagesForAPI(systemPrompt) {
    const systemMessage = {
      role: 'system',
      content: systemPrompt
    };

    if (this.messages.length === 0) {
      return [systemMessage];
    }

    // Find the initial user prompt in the session
    const firstUserMsg = this.messages.find(m => m.role === 'user');

    // Calculate approximate slice start point based on token budget and message counts
    // We traverse BACKWARDS from the latest message, accumulating tokens
    let accumulatedTokens = estimateTokens(systemPrompt);
    let sliceStart = 0;
    const ceilingMessages = Math.max(this.maxMessages, 35); // Allow more messages if tokens permit

    let targetIndex = this.messages.length - 1;
    let includedCount = 0;

    while (targetIndex >= 0) {
      const m = this.messages[targetIndex];
      const msgTokens = estimateTokens(m.content) + (m.tool_calls ? estimateTokens(JSON.stringify(m.tool_calls)) : 0);

      // If adding this message exceeds maxTokenBudget AND we already have at least 4 recent messages, stop
      if ((accumulatedTokens + msgTokens > this.maxTokenBudget) && includedCount >= 4) {
        sliceStart = targetIndex + 1;
        break;
      }

      // If we've reached maxMessages count, stop
      if (includedCount >= this.maxMessages) {
        sliceStart = targetIndex + 1;
        break;
      }

      accumulatedTokens += msgTokens;
      includedCount++;
      targetIndex--;
    }

    // Search BACKWARD from sliceStart (at most 4 steps) to find if a user prompt initiated this sequence.
    // This prevents dropping the immediate user prompt when tool calls take up several messages,
    // while allowing older messages to be summarized properly.
    let foundUserIndex = -1;
    const maxLookback = Math.max(0, sliceStart - 4);
    for (let i = sliceStart; i >= maxLookback; i--) {
      if (this.messages[i].role === 'user') {
        foundUserIndex = i;
        break;
      }
    }

    if (foundUserIndex !== -1) {
      sliceStart = foundUserIndex;
    }

    // Feature 3: Record milestones from discarded messages before slicing
    if (sliceStart > 0) {
      const discarded = this.messages.slice(0, sliceStart);
      this._extractAndRecordMilestones(discarded);
    }

    const sliced = this.messages.slice(sliceStart);

    // Final integrity check: every assistant message with tool_calls in sliced MUST have its tool responses in sliced
    // and every tool message MUST have its preceding assistant message with matching tool_calls
    const validMessages = [];
    const pendingToolCalls = new Set();

    for (const msg of sliced) {
      if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        msg.tool_calls.forEach(tc => pendingToolCalls.add(tc.id));
        validMessages.push(msg);
      } else if (msg.role === 'tool') {
        if (pendingToolCalls.has(msg.tool_call_id)) {
          pendingToolCalls.delete(msg.tool_call_id);
          validMessages.push(msg);
        } else {
          // Orphaned tool response, skip
          console.warn(`Dropping orphaned tool response ${msg.tool_call_id}`);
        }
      } else {
        validMessages.push(msg);
      }
    }

    // Assemble final message array
    const finalPayload = [systemMessage];

    // Feature 3: If earlier actions were summarized, inject the cumulative progress summary
    if (this.cumulativeMilestones.length > 0) {
      finalPayload.push({
        role: 'system',
        content: `### CUMULATIVE WORK PROGRESS (Completed in earlier turns of this session):\n${this.cumulativeMilestones.map(m => `* ${m}`).join('\n')}\n(Refer to these completed milestones so you don't repeat them or lose context.)`
      });
    }

    // If the slice discarded the very first user message of this session,
    // inject a goal reminder so the AI NEVER loses the original intent!
    if (firstUserMsg && sliceStart > 0 && !validMessages.includes(firstUserMsg)) {
      const rawFirstContent = typeof firstUserMsg.content === 'string' 
        ? firstUserMsg.content 
        : JSON.stringify(firstUserMsg.content);

      finalPayload.push({
        role: 'user',
        content: `[Session Goal Context Reminder]: In this conversation, the user's primary ongoing request is: "${rawFirstContent}". Continue working strictly on this task unless the user explicitly requested something else.`
      });
      finalPayload.push({
        role: 'assistant',
        content: `Understood. I will strictly maintain focus on: "${rawFirstContent}" and will not divert to unrelated tasks.`
      });
    }

    finalPayload.push(...validMessages);
    return finalPayload;
  }
}

module.exports = {
  HistoryManager,
  pruneToolContent,
  estimateTokens
};
