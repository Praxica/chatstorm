import { CHAT_USER_CONTINUE } from "@/lib/constants";

/**
 * Extract text content from a message's parts array.
 * All messages should have parts populated via fromDbMessage() or the AI SDK.
 */
function getMessageText(message: any): string {
  if (!Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p: any) => p?.type === 'text')
    .map((p: any) => String(p.text ?? ''))
    .join('');
}

/**
 * Checks if a message is a tool call message or contains tool call data
 */
export function isToolCallMessage(message: any): boolean {
  // Check various properties that indicate this is a tool call message
  const text = getMessageText(message);
  return Boolean(
    // Check content for tool call indicators
    text.includes('saveNextAgent') ||
    // Check for toolInvocations property (v5)
    message.toolInvocations?.length > 0 ||
    // Check for finish reason indicating tool calls
    message.finishReason === 'tool-calls' ||
    // Legacy: Check annotations for tool calls (for old data)
    message.annotations?.some((a: any) => a.type === 'toolCall')
  );
}

/**
 * Checks if a message is ONLY a tool call with no substantial content
 * Used to avoid counting tool-only messages in progress tracking
 */
export function isToolCallOnlyMessage(message: any): boolean {
  const hasTool = isToolCallMessage(message);

  if (hasTool) {
    const text = getMessageText(message).trim();
    return !text || text === '';
  }

  return false;
}

/**
 * Filters out system messages that shouldn't be displayed in the UI
 *
 * @param messages The collection of messages to filter
 * @returns Filtered messages suitable for display
 */
export function filterDisplayMessages<T extends { content?: string, role?: string, parts?: any[] }>(messages: T[]): T[] {
  if (!messages || !Array.isArray(messages)) return [];

  return messages.filter((message) => {
    const text = getMessageText(message);

    // Filter out continuation messages
    if (text === CHAT_USER_CONTINUE) {
      return false;
    }

    // Always keep user messages
    if (message.role === 'user') return true;

    // Exclude assistant messages with empty content
    if (message.role === 'assistant' && !text.trim()) {
      return false;
    }

    // Filter out tool invocation messages for agent management
    const msg = message as any;
    if (msg?.toolInvocations && msg.toolInvocations[0]?.toolName === 'saveNextAgent') {
      return false;
    }

    // Filter out pure tool call messages that don't have displayable content
    if (isToolCallOnlyMessage(message as any)) {
      return false;
    }

    // For assistant messages with tool calls, make sure they also have actual content
    if (message.role === 'assistant' && isToolCallMessage(message as any)) {
      return text.trim().length > 0;
    }

    return true;
  });
}
