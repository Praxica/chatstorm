/**
 * Tests for agent isolation in message filtering.
 *
 * When a round has `agentIsolation: true`, each agent should only see
 * their own messages from the current session - NOT messages from other agents.
 */

// Mock all transitive dependencies before imports
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/modalities', () => ({
  ModalityRegistry: { getModality: () => ({ getUserMessagePrefix: () => '' }) }
}));
jest.mock('@/lib/chat/services/prompts', () => ({ PromptService: {} }));
jest.mock('@/lib/chat/services/retention', () => ({ RetentionService: {} }));
jest.mock('@/lib/chat/services/sessions', () => ({}));
jest.mock('@/lib/chat/services/ui-message', () => ({ stripMetadata: (m: any) => m }));
jest.mock('@/lib/constants', () => ({ CHAT_USER_CONTINUE: '__continue__' }));
jest.mock('@prisma/client', () => ({}));

import { MessageUtils } from '@/lib/chat/services/messages';
import { ChatState } from '@/lib/chat/types';

// Helper to create a minimal ChatState for testing sanitizeMessages
function createTestChatState(overrides: Partial<ChatState> = {}): ChatState {
  const sessionId = 'session-1';
  return {
    chat: { id: 'chat-1', persistenceMode: 'save', generationMode: 'stream', branchId: 'branch-1', activeBranchPath: [] },
    config: null,
    rounds: [],
    activeRound: {
      id: 'round-1',
      agentIsolation: true,
      isPrivate: false,
      type: 'brainstorm',
      participants: [],
    } as any,
    agents: [
      { id: 'agent-a', name: 'Agent A' } as any,
      { id: 'agent-b', name: 'Agent B' } as any,
    ],
    activeAgent: { id: 'agent-b', name: 'Agent B' } as any,
    progress: {} as any,
    messages: [],
    sessions: [{ id: sessionId, roundId: 'round-1', isActive: true }] as any,
    adapter: {} as any,
    user: {} as any,
    currentSessionId: sessionId,
    languageModels: {},
    ...overrides,
  };
}

// Helper to create a message as it would come from the client (metadata.sessionId, no chatRoundSessionId)
function createClientMessage(role: 'user' | 'assistant', content: string, metadata: Record<string, any> = {}) {
  return {
    role,
    content,
    parts: [{ type: 'text', text: content }],
    metadata,
  };
}

describe('Agent Isolation in sanitizeMessages', () => {

  it('should filter out other agents messages when agentIsolation is true (client-side messages with metadata.sessionId)', () => {
    const sessionId = 'session-1';
    const chatState = createTestChatState();

    // Simulate messages as they come from the client (metadata.sessionId, NO chatRoundSessionId)
    const messages = [
      createClientMessage('user', 'Start the brainstorm', { sessionId }),
      createClientMessage('assistant', 'Agent A thinks...', { sessionId, agentId: 'agent-a' }),
      createClientMessage('user', 'Continue', { sessionId }),
    ];

    // Agent B is the active agent - should NOT see Agent A's message
    const result = MessageUtils.sanitizeMessages(chatState, messages);

    // Agent A's assistant message should be filtered out
    const assistantMessages = result.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(0);
  });

  it('should keep the active agents own messages when agentIsolation is true', () => {
    const sessionId = 'session-1';
    const chatState = createTestChatState();

    const messages = [
      createClientMessage('user', 'Start the brainstorm', { sessionId }),
      createClientMessage('assistant', 'Agent B responds first time', { sessionId, agentId: 'agent-b' }),
      createClientMessage('user', 'Continue', { sessionId }),
    ];

    // Agent B should see their own messages
    const result = MessageUtils.sanitizeMessages(chatState, messages);

    const assistantMessages = result.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect((assistantMessages[0].parts[0] as any).text).toContain('Agent B responds first time');
  });

  it('should filter multiple other agents messages in a multi-agent round', () => {
    const sessionId = 'session-1';
    const chatState = createTestChatState({
      agents: [
        { id: 'agent-a', name: 'Agent A' } as any,
        { id: 'agent-b', name: 'Agent B' } as any,
        { id: 'agent-c', name: 'Agent C' } as any,
      ],
      activeAgent: { id: 'agent-c', name: 'Agent C' } as any,
    });

    const messages = [
      createClientMessage('user', 'Start', { sessionId }),
      createClientMessage('assistant', 'Agent A says hello', { sessionId, agentId: 'agent-a' }),
      createClientMessage('user', 'Continue', { sessionId }),
      createClientMessage('assistant', 'Agent B says hello', { sessionId, agentId: 'agent-b' }),
      createClientMessage('user', 'Continue again', { sessionId }),
    ];

    // Agent C should NOT see Agent A's or Agent B's messages
    const result = MessageUtils.sanitizeMessages(chatState, messages);

    const assistantMessages = result.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(0);
  });

  it('should NOT filter messages when agentIsolation is false', () => {
    const sessionId = 'session-1';
    const chatState = createTestChatState({
      activeRound: {
        id: 'round-1',
        agentIsolation: false,
        isPrivate: false,
        type: 'brainstorm',
        participants: [],
      } as any,
    });

    const messages = [
      createClientMessage('user', 'Start', { sessionId }),
      createClientMessage('assistant', 'Agent A says hello', { sessionId, agentId: 'agent-a' }),
      createClientMessage('user', 'Continue', { sessionId }),
    ];

    // Agent B should see Agent A's message when isolation is off
    const result = MessageUtils.sanitizeMessages(chatState, messages);

    const assistantMessages = result.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
  });

  it('should work with DB-loaded messages that have chatRoundSessionId', () => {
    const sessionId = 'session-1';
    const chatState = createTestChatState();

    // DB-loaded messages have chatRoundSessionId as a top-level property
    const messages = [
      { role: 'user', content: 'Start', parts: [{ type: 'text', text: 'Start' }], metadata: { sessionId }, chatRoundSessionId: sessionId },
      { role: 'assistant', content: 'Agent A says hello', parts: [{ type: 'text', text: 'Agent A says hello' }], metadata: { sessionId, agentId: 'agent-a' }, chatRoundSessionId: sessionId },
      { role: 'user', content: 'Continue', parts: [{ type: 'text', text: 'Continue' }], metadata: { sessionId }, chatRoundSessionId: sessionId },
    ];

    // Agent B should NOT see Agent A's message
    const result = MessageUtils.sanitizeMessages(chatState, messages as any);

    const assistantMessages = result.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(0);
  });

  it('should not filter messages from previous sessions (completed rounds)', () => {
    const currentSessionId = 'session-2';
    const previousSessionId = 'session-1';
    const chatState = createTestChatState({
      currentSessionId: currentSessionId,
      sessions: [
        { id: previousSessionId, roundId: 'round-0', isActive: false } as any,
        { id: currentSessionId, roundId: 'round-1', isActive: true } as any,
      ],
    });

    const messages = [
      // Previous session messages (should NOT be filtered by isolation)
      createClientMessage('assistant', 'Agent A from previous round', { sessionId: previousSessionId, agentId: 'agent-a' }),
      // Current session messages
      createClientMessage('user', 'Start round 2', { sessionId: currentSessionId }),
      createClientMessage('assistant', 'Agent A in current round', { sessionId: currentSessionId, agentId: 'agent-a' }),
      createClientMessage('user', 'Continue', { sessionId: currentSessionId }),
    ];

    // Agent B should see Agent A's message from previous round, but NOT from current round
    const result = MessageUtils.sanitizeMessages(chatState, messages);

    const assistantMessages = result.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect((assistantMessages[0].parts[0] as any).text).toContain('Agent A from previous round');
  });

  it('moderator should see all messages even with isolation enabled', () => {
    const sessionId = 'session-1';
    const chatState = createTestChatState();

    const messages = [
      createClientMessage('user', 'Start', { sessionId }),
      createClientMessage('assistant', 'Agent A says hello', { sessionId, agentId: 'agent-a' }),
      createClientMessage('user', 'Continue', { sessionId }),
    ];

    // Moderator context bypasses isolation
    const result = MessageUtils.sanitizeMessages(chatState, messages, true);

    const assistantMessages = result.filter(m => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
  });
});
