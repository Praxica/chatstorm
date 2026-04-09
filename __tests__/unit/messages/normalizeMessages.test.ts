import { MessageUtils } from '@/lib/chat/services/messages';

describe('MessageUtils.normalizeMessages', () => {
  it('returns messages unchanged when no currentSessionId is provided', () => {
    const messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];

    const result = MessageUtils.normalizeMessages(messages);

    expect(result).toEqual(messages);
  });

  it('returns messages unchanged when all messages already have sessionId', () => {
    const messages = [
      { role: 'user', content: 'hello', metadata: { sessionId: 'session-1' } },
      { role: 'assistant', content: 'hi', metadata: { sessionId: 'session-1' } },
      { role: 'user', content: 'bye', metadata: { sessionId: 'session-2' } },
      { role: 'assistant', content: 'goodbye', metadata: { sessionId: 'session-2' } },
    ];

    const result = MessageUtils.normalizeMessages(messages, 'current-session');

    expect(result).toEqual(messages);
  });

  it('assigns currentSessionId to assistant messages without sessionId', () => {
    const messages = [
      { role: 'assistant', content: 'response one', metadata: {} },
      { role: 'assistant', content: 'response two', metadata: {} },
    ];

    const result = MessageUtils.normalizeMessages(messages, 'current-session');

    expect(result[0].metadata.sessionId).toBe('current-session');
    expect(result[1].metadata.sessionId).toBe('current-session');
  });

  it('assigns the next assistant message sessionId to user messages without sessionId', () => {
    const messages = [
      { role: 'user', content: 'hello', metadata: {} },
      { role: 'assistant', content: 'hi', metadata: { sessionId: 'session-A' } },
    ];

    const result = MessageUtils.normalizeMessages(messages, 'current-session');

    expect(result[0].metadata.sessionId).toBe('session-A');
    // Assistant message already had sessionId, should be unchanged
    expect(result[1].metadata.sessionId).toBe('session-A');
  });

  it('assigns currentSessionId to a user message at the end with no following assistant', () => {
    const messages = [
      { role: 'assistant', content: 'hi', metadata: { sessionId: 'session-1' } },
      { role: 'user', content: 'last message', metadata: {} },
    ];

    const result = MessageUtils.normalizeMessages(messages, 'current-session');

    expect(result[0].metadata.sessionId).toBe('session-1');
    expect(result[1].metadata.sessionId).toBe('current-session');
  });

  it('only assigns sessionId to messages that are missing it (mixed scenario)', () => {
    const messages = [
      { role: 'user', content: 'msg1', metadata: { sessionId: 'existing-session' } },
      { role: 'assistant', content: 'msg2', metadata: { sessionId: 'existing-session' } },
      { role: 'user', content: 'msg3', metadata: {} },
      { role: 'assistant', content: 'msg4', metadata: {} },
    ];

    const result = MessageUtils.normalizeMessages(messages, 'current-session');

    // First two should be unchanged
    expect(result[0].metadata.sessionId).toBe('existing-session');
    expect(result[1].metadata.sessionId).toBe('existing-session');
    // User message without sessionId: looks forward, next assistant has no sessionId either,
    // so it falls through the loop without finding one and defaults to currentSessionId
    expect(result[2].metadata.sessionId).toBe('current-session');
    // Assistant message without sessionId gets currentSessionId
    expect(result[3].metadata.sessionId).toBe('current-session');
  });

  it('assigns all preceding user messages the next assistant message sessionId', () => {
    const messages = [
      { role: 'user', content: 'first user msg', metadata: {} },
      { role: 'user', content: 'second user msg', metadata: {} },
      { role: 'user', content: 'third user msg', metadata: {} },
      { role: 'assistant', content: 'response', metadata: { sessionId: 'session-X' } },
    ];

    const result = MessageUtils.normalizeMessages(messages, 'current-session');

    expect(result[0].metadata.sessionId).toBe('session-X');
    expect(result[1].metadata.sessionId).toBe('session-X');
    expect(result[2].metadata.sessionId).toBe('session-X');
    // Assistant already had sessionId
    expect(result[3].metadata.sessionId).toBe('session-X');
  });

  it('returns an empty array when given an empty messages array', () => {
    const result = MessageUtils.normalizeMessages([], 'current-session');

    expect(result).toEqual([]);
  });

  it('does not mutate the original messages array', () => {
    const messages = [
      { role: 'user', content: 'hello', metadata: {} },
      { role: 'assistant', content: 'hi', metadata: {} },
    ];

    const originalMessages = messages.map(m => ({ ...m, metadata: { ...m.metadata } }));
    MessageUtils.normalizeMessages(messages, 'current-session');

    // Original messages should not have been modified
    expect(messages[0].metadata).toEqual(originalMessages[0].metadata);
    expect(messages[1].metadata).toEqual(originalMessages[1].metadata);
  });
});
