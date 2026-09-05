class HistoryManager {
  constructor(maxMessages = 15) {
    this.maxMessages = maxMessages;
    // Internal history of user/assistant/tool messages (excluding system prompt)
    this.messages = [];
  }

  setMaxMessages(max) {
    this.maxMessages = parseInt(max, 10) || 15;
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
   * Prepares message array for OpenAI API payload with sliding window.
   * Preserves system prompt at index 0.
   * Slices history to at most maxMessages, ensuring tool_call and tool response pairs are NOT orphaned.
   */
  getMessagesForAPI(systemPrompt) {
    const systemMessage = {
      role: 'system',
      content: systemPrompt
    };

    if (this.messages.length <= this.maxMessages) {
      return [systemMessage, ...this.messages];
    }

    // Need to slice to at most this.maxMessages
    let sliceStart = this.messages.length - this.maxMessages;

    // Boundary validation: Never start with a 'tool' message (it must follow assistant tool_calls)
    // Also, if the starting message is an 'assistant' message that has tool_calls, but its tool responses are included, that's fine.
    // However, if slice starts in the middle of a tool response sequence, advance or retreat the window.
    while (sliceStart < this.messages.length && this.messages[sliceStart].role === 'tool') {
      sliceStart++; // Move forward past orphaned tool response
    }

    // Check if the message at sliceStart is an assistant message that expected tool calls that might be cut off
    // If sliceStart lands on a user message, that is the cleanest cut.
    // Try to find the closest user message near sliceStart if possible
    for (let i = sliceStart; i < this.messages.length; i++) {
      if (this.messages[i].role === 'user') {
        sliceStart = i;
        break;
      }
    }

    const sliced = this.messages.slice(sliceStart);

    // Final integrity check: every assistant message with tool_calls in sliced MUST have its tool responses in sliced
    // and every tool message MUST have its preceding assistant message with matching tool_calls
    const validMessages = [];
    let pendingToolCalls = new Set();

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

    return [systemMessage, ...validMessages];
  }
}

module.exports = { HistoryManager };
