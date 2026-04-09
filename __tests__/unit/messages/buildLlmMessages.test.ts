import { MessageUtils } from '@/lib/chat/services/messages'
import {
  createTestAgent,
  createTestRound,
  createTestSession,
  createTestMessage,
  createTestChatState,
  resetIdCounter,
} from '../../factories'
import { getMessageText } from '../../helpers/assertions'

beforeEach(() => resetIdCounter())

// ===========================================================================
// 1. No config fallback — returns raw messages
// ===========================================================================
describe('buildLlmMessages', () => {
  it('returns raw messages when config is null', () => {
    const messages = [
      createTestMessage({ role: 'user', content: 'Hello' }),
      createTestMessage({ role: 'assistant', content: 'Hi there' }),
    ]

    const state = createTestChatState({ messages, config: null })
    const result = MessageUtils.buildLlmMessages(state)

    expect(result).toHaveLength(2)
    expect(getMessageText(result[0])).toBe('Hello')
    expect(getMessageText(result[1])).toBe('Hi there')
  })

  // =========================================================================
  // 2. Session ordering — completed sessions before active
  // =========================================================================
  it('orders completed sessions before active sessions', () => {
    const agent = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const round1 = createTestRound({ id: 'round-1', retentionSettings: { policy: 'keep_full' } })
    const round2 = createTestRound({ id: 'round-2', retentionSettings: { policy: 'keep_full' } })

    const completedSessionId = 'completed-session'
    const activeSessionId = 'active-session'

    const messages = [
      createTestMessage({ role: 'user', content: 'Completed msg', sessionId: completedSessionId }),
      createTestMessage({ role: 'assistant', content: 'Completed response', agentId: 'agent-a', sessionId: completedSessionId }),
      createTestMessage({ role: 'user', content: 'Active msg', sessionId: activeSessionId }),
      createTestMessage({ role: 'assistant', content: 'Active response', agentId: 'agent-a', sessionId: activeSessionId }),
    ]

    const sessions = [
      createTestSession({ id: completedSessionId, roundId: 'round-1', isActive: false, completedAt: new Date() }),
      createTestSession({ id: activeSessionId, roundId: 'round-2', isActive: true }),
    ]

    const state = createTestChatState({
      agents: [agent],
      activeAgent: agent,
      activeRound: round2,
      rounds: [round1, round2],
      messages,
      sessions,
      currentSessionId: activeSessionId,
    })

    const result = MessageUtils.buildLlmMessages(state)

    // Completed session messages should come first
    const texts = result.map(getMessageText)
    const completedIdx = texts.findIndex(t => t.includes('Completed'))
    const activeIdx = texts.findIndex(t => t.includes('Active'))
    expect(completedIdx).toBeLessThan(activeIdx)
  })

  // =========================================================================
  // 3. Retention: keep_full — all messages preserved
  // =========================================================================
  it('keeps all messages with keep_full retention policy', () => {
    const agent = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const round = createTestRound({
      id: 'round-1',
      retentionSettings: { policy: 'keep_full' },
    })

    const sessionId = 'session-1'
    const messages = [
      createTestMessage({ role: 'user', content: 'Msg 1', sessionId }),
      createTestMessage({ role: 'assistant', content: 'Reply 1', agentId: 'agent-a', sessionId }),
      createTestMessage({ role: 'user', content: 'Msg 2', sessionId }),
      createTestMessage({ role: 'assistant', content: 'Reply 2', agentId: 'agent-a', sessionId }),
    ]

    const state = createTestChatState({
      agents: [agent],
      activeAgent: agent,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
    })

    const result = MessageUtils.buildLlmMessages(state)
    expect(result).toHaveLength(4)
  })

  // =========================================================================
  // 4. Retention: summarize with compression data
  // =========================================================================
  it('uses compression data for summarized completed sessions', () => {
    const agent = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const completedRound = createTestRound({
      id: 'round-1',
      retentionSettings: { policy: 'summarize' },
    })
    const activeRound = createTestRound({
      id: 'round-2',
      retentionSettings: { policy: 'keep_full' },
    })

    const completedSessionId = 'completed-session'
    const activeSessionId = 'active-session'

    const messages = [
      // Original messages from completed session (should be replaced by summary)
      createTestMessage({ role: 'user', content: 'Original msg', sessionId: completedSessionId }),
      createTestMessage({ role: 'assistant', content: 'Original reply', agentId: 'agent-a', sessionId: completedSessionId }),
      // Active session
      createTestMessage({ role: 'user', content: 'Active msg', sessionId: activeSessionId }),
    ]

    const sessions = [
      createTestSession({
        id: completedSessionId,
        roundId: 'round-1',
        isActive: false,
        completedAt: new Date(),
        compressionData: {
          summary: 'This is a summary of the conversation.',
          originalMessageCount: 2,
          summarizedAt: new Date(),
        },
      }),
      createTestSession({ id: activeSessionId, roundId: 'round-2', isActive: true }),
    ]

    const state = createTestChatState({
      agents: [agent],
      activeAgent: agent,
      activeRound: activeRound,
      rounds: [completedRound, activeRound],
      messages,
      sessions,
      currentSessionId: activeSessionId,
    })

    const result = MessageUtils.buildLlmMessages(state)
    const texts = result.map(getMessageText)

    // Should contain the summary, not the original messages
    expect(texts.some(t => t.includes('summary of the conversation'))).toBe(true)
    expect(texts.some(t => t.includes('Original reply'))).toBe(false)
  })

  // =========================================================================
  // 5. Retention: summarize without compression (falls back to full)
  // =========================================================================
  it('falls back to full messages when summarize policy has no compression data', () => {
    const agent = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const completedRound = createTestRound({
      id: 'round-1',
      retentionSettings: { policy: 'summarize' },
    })
    const activeRound = createTestRound({ id: 'round-2' })

    const completedSessionId = 'completed-session'
    const activeSessionId = 'active-session'

    const messages = [
      createTestMessage({ role: 'user', content: 'Keep this msg', sessionId: completedSessionId }),
      createTestMessage({ role: 'assistant', content: 'Keep this reply', agentId: 'agent-a', sessionId: completedSessionId }),
      createTestMessage({ role: 'user', content: 'Active msg', sessionId: activeSessionId }),
    ]

    const sessions = [
      createTestSession({
        id: completedSessionId,
        roundId: 'round-1',
        isActive: false,
        completedAt: new Date(),
        // No compressionData
      }),
      createTestSession({ id: activeSessionId, roundId: 'round-2', isActive: true }),
    ]

    const state = createTestChatState({
      agents: [agent],
      activeAgent: agent,
      activeRound: activeRound,
      rounds: [completedRound, activeRound],
      messages,
      sessions,
      currentSessionId: activeSessionId,
    })

    const result = MessageUtils.buildLlmMessages(state)
    const texts = result.map(getMessageText)

    // Should fall back to full messages
    expect(texts.some(t => t.includes('Keep this'))).toBe(true)
  })

  // =========================================================================
  // 6. Retention: ignore — messages dropped
  // =========================================================================
  it('drops messages for sessions with ignore policy', () => {
    const agent = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const ignoredRound = createTestRound({
      id: 'round-1',
      retentionSettings: { policy: 'ignore' },
    })
    const activeRound = createTestRound({ id: 'round-2' })

    const ignoredSessionId = 'ignored-session'
    const activeSessionId = 'active-session'

    const messages = [
      createTestMessage({ role: 'user', content: 'Ignored msg', sessionId: ignoredSessionId }),
      createTestMessage({ role: 'assistant', content: 'Ignored reply', agentId: 'agent-a', sessionId: ignoredSessionId }),
      createTestMessage({ role: 'user', content: 'Active msg', sessionId: activeSessionId }),
    ]

    const sessions = [
      createTestSession({ id: ignoredSessionId, roundId: 'round-1', isActive: false, completedAt: new Date() }),
      createTestSession({ id: activeSessionId, roundId: 'round-2', isActive: true }),
    ]

    const state = createTestChatState({
      agents: [agent],
      activeAgent: agent,
      activeRound: activeRound,
      rounds: [ignoredRound, activeRound],
      messages,
      sessions,
      currentSessionId: activeSessionId,
    })

    const result = MessageUtils.buildLlmMessages(state)
    const texts = result.map(getMessageText)

    // Ignored session messages should be dropped
    expect(texts.some(t => t.includes('Ignored'))).toBe(false)
    // Active session message should still be present
    expect(texts.some(t => t.includes('Active'))).toBe(true)
  })

  // =========================================================================
  // 7. Chat-level ignore override for old rounds
  // =========================================================================
  it('ignores rounds older than chat-level ignore threshold', () => {
    const agent = createTestAgent({ id: 'agent-a', name: 'Alice' })

    // Create many rounds, with keep_full policy on each
    const rounds = Array.from({ length: 5 }, (_, i) =>
      createTestRound({
        id: `round-${i}`,
        retentionSettings: { policy: 'keep_full' },
      })
    )

    // Create sessions: 4 completed, 1 active
    const sessions = rounds.map((r, i) =>
      createTestSession({
        id: `session-${i}`,
        roundId: r.id,
        isActive: i === 4,
        completedAt: i < 4 ? new Date() : null,
      })
    )

    const messages = rounds.flatMap((r, i) => [
      createTestMessage({ role: 'user', content: `Round ${i} msg`, sessionId: `session-${i}` }),
      createTestMessage({ role: 'assistant', content: `Round ${i} reply`, agentId: 'agent-a', sessionId: `session-${i}` }),
    ])

    const state = createTestChatState({
      agents: [agent],
      activeAgent: agent,
      activeRound: rounds[4],
      rounds,
      messages,
      sessions,
      currentSessionId: 'session-4',
      config: {
        id: 'test-config-id',
        title: 'Test Config',
        userId: 'test-user-id',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: {
          ignore: { enabled: true, afterRounds: 2 },
          summarize: { enabled: false, afterRounds: 10 },
        },
        memorySettings: null,
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      } as any,
    })

    const result = MessageUtils.buildLlmMessages(state)
    const texts = result.map(getMessageText)

    // Rounds 0 and 1 are > 2 rounds ago from the end of completed (4 completed sessions: 0,1,2,3)
    // Round 0 is 4 rounds ago, Round 1 is 3 rounds ago — both should be ignored
    expect(texts.some(t => t.includes('Round 0'))).toBe(false)
    expect(texts.some(t => t.includes('Round 1'))).toBe(false)
    // Recent rounds should still be present
    expect(texts.some(t => t.includes('Round 3'))).toBe(true)
    expect(texts.some(t => t.includes('Round 4'))).toBe(true)
  })

  // =========================================================================
  // 8. Active session always keep_full
  // =========================================================================
  it('always keeps full messages for active sessions regardless of round policy', () => {
    const agent = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const round = createTestRound({
      id: 'round-1',
      retentionSettings: { policy: 'ignore' },
    })

    const sessionId = 'active-session'
    const messages = [
      createTestMessage({ role: 'user', content: 'Should be kept', sessionId }),
      createTestMessage({ role: 'assistant', content: 'Also kept', agentId: 'agent-a', sessionId }),
    ]

    const state = createTestChatState({
      agents: [agent],
      activeAgent: agent,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
    })

    const result = MessageUtils.buildLlmMessages(state)
    const texts = result.map(getMessageText)

    // Even with 'ignore' policy, active session messages are kept
    expect(texts.some(t => t.includes('Should be kept'))).toBe(true)
    expect(texts.some(t => t.includes('Also kept'))).toBe(true)
  })

  // =========================================================================
  // 9. Private round session skipping
  // =========================================================================
  it('skips completed private round sessions where agent did not participate', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })

    const privateRound = createTestRound({
      id: 'private-round',
      isPrivate: true,
      retentionSettings: { policy: 'keep_full' },
    })
    const activeRound = createTestRound({
      id: 'active-round',
      retentionSettings: { policy: 'keep_full' },
    })

    const privateSessionId = 'private-session'
    const activeSessionId = 'active-session'

    const messages = [
      // Only Alice participated in the private round
      createTestMessage({ role: 'user', content: 'Private msg', sessionId: privateSessionId }),
      createTestMessage({ role: 'assistant', content: 'Alice private', agentId: 'agent-a', sessionId: privateSessionId }),
      // Active round
      createTestMessage({ role: 'user', content: 'Active msg', sessionId: activeSessionId }),
    ]

    const sessions = [
      createTestSession({ id: privateSessionId, roundId: 'private-round', isActive: false, completedAt: new Date() }),
      createTestSession({ id: activeSessionId, roundId: 'active-round', isActive: true }),
    ]

    // Bob didn't participate — shouldn't see private round messages
    const bobState = createTestChatState({
      agents: [agentA, agentB],
      activeAgent: agentB,
      activeRound: activeRound,
      rounds: [privateRound, activeRound],
      messages,
      sessions,
      currentSessionId: activeSessionId,
    })

    const bobResult = MessageUtils.buildLlmMessages(bobState)
    const bobTexts = bobResult.map(getMessageText)
    expect(bobTexts.some(t => t.includes('Alice private'))).toBe(false)
    expect(bobTexts.some(t => t.includes('Active msg'))).toBe(true)

    // Alice participated — should see private round messages
    const aliceState = { ...bobState, activeAgent: agentA }
    const aliceResult = MessageUtils.buildLlmMessages(aliceState)
    const aliceTexts = aliceResult.map(getMessageText)
    expect(aliceTexts.some(t => t.includes('Alice private'))).toBe(true)
  })

  // =========================================================================
  // 10. Dialogue-specific compression — agent only sees own dialogues
  // =========================================================================
  it('filters dialogue-specific compression to only include dialogues the agent participated in', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })
    const agentC = createTestAgent({ id: 'agent-c', name: 'Charlie' })

    const dialogueRound = createTestRound({
      id: 'dialogue-round',
      type: 'dialogue' as any,
      retentionSettings: { policy: 'summarize' },
    })
    const activeRound = createTestRound({ id: 'active-round' })

    const dialogueSessionId = 'dialogue-session'
    const activeSessionId = 'active-session'

    // No actual messages needed for compressed sessions (they use compressionData)
    const messages = [
      createTestMessage({ role: 'user', content: 'Active msg', sessionId: activeSessionId }),
    ]

    const sessions = [
      createTestSession({
        id: dialogueSessionId,
        roundId: 'dialogue-round',
        isActive: false,
        completedAt: new Date(),
        compressionData: {
          dialogues: {
            'agent-a||agent-b': {
              summary: 'Alice and Bob discussed the plan.',
              originalMessageCount: 10,
              participants: ['agent-a', 'agent-b'],
            },
            'agent-b||agent-c': {
              summary: 'Bob and Charlie discussed implementation.',
              originalMessageCount: 8,
              participants: ['agent-b', 'agent-c'],
            },
          },
          summary: 'General group discussion.',
          originalMessageCount: 5,
          summarizedAt: new Date(),
        },
      }),
      createTestSession({ id: activeSessionId, roundId: 'active-round', isActive: true }),
    ]

    // Alice should only see Alice-Bob dialogue + general summary
    const aliceState = createTestChatState({
      agents: [agentA, agentB, agentC],
      activeAgent: agentA,
      activeRound: activeRound,
      rounds: [dialogueRound, activeRound],
      messages,
      sessions,
      currentSessionId: activeSessionId,
    })

    const aliceResult = MessageUtils.buildLlmMessages(aliceState)
    const aliceTexts = aliceResult.map(getMessageText)

    expect(aliceTexts.some(t => t.includes('Alice and Bob discussed'))).toBe(true)
    expect(aliceTexts.some(t => t.includes('Bob and Charlie discussed'))).toBe(false)
    expect(aliceTexts.some(t => t.includes('General group discussion'))).toBe(true)

    // Charlie should only see Bob-Charlie dialogue + general summary
    const charlieState = { ...aliceState, activeAgent: agentC }
    const charlieResult = MessageUtils.buildLlmMessages(charlieState)
    const charlieTexts = charlieResult.map(getMessageText)

    expect(charlieTexts.some(t => t.includes('Alice and Bob discussed'))).toBe(false)
    expect(charlieTexts.some(t => t.includes('Bob and Charlie discussed'))).toBe(true)
    expect(charlieTexts.some(t => t.includes('General group discussion'))).toBe(true)
  })
})
