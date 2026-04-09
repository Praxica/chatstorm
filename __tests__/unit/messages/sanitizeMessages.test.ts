import { MessageUtils } from '@/lib/chat/services/messages'
import {
  createTestAgent,
  createTestRound,
  createTestSession,
  createTestMessage,
  createTestChatState,
  resetIdCounter,
} from '../../factories'
import {
  getMessageText,
  expectNoMessagesFromAgent,
  expectNoMessageContaining,
  expectSomeMessageContaining,
} from '../../helpers/assertions'

beforeEach(() => resetIdCounter())

// ---------------------------------------------------------------------------
// Helper: build a standard 2-agent isolated-round ChatState
// ---------------------------------------------------------------------------
function buildIsolationScenario(opts: { agentIsolation: boolean; activeAgentId?: string }) {
  const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
  const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })
  const sessionId = 'session-1'

  const round = createTestRound({
    id: 'round-1',
    agentIsolation: opts.agentIsolation,
    participants: [agentA, agentB],
  })

  const messages = [
    createTestMessage({ role: 'user', content: 'Hello Alice', sessionId, agentId: undefined }),
    createTestMessage({ role: 'assistant', content: 'Hi from Alice', agentId: 'agent-a', sessionId }),
    createTestMessage({ role: 'user', content: 'Hello Bob', sessionId, agentId: undefined }),
    createTestMessage({ role: 'assistant', content: 'Hi from Bob', agentId: 'agent-b', sessionId }),
  ]

  const activeAgent = opts.activeAgentId === 'agent-b' ? agentB : agentA

  return createTestChatState({
    agents: [agentA, agentB],
    activeAgent,
    activeRound: round,
    rounds: [round],
    messages,
    currentSessionId: sessionId,
    sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
  })
}

// ===========================================================================
// 1. Agent isolation DISABLED — all agents see all messages
// ===========================================================================
describe('sanitizeMessages', () => {
  it('returns all messages when agent isolation is disabled', () => {
    const chatState = buildIsolationScenario({ agentIsolation: false, activeAgentId: 'agent-a' })
    const result = MessageUtils.sanitizeMessages(chatState)

    // Alice should see all 4 messages (2 user + 2 assistant)
    expect(result).toHaveLength(4)
  })

  // =========================================================================
  // 2. Agent isolation ENABLED — agent only sees own messages in current session
  // =========================================================================
  it('filters other agents messages when isolation is enabled', () => {
    const chatState = buildIsolationScenario({ agentIsolation: true, activeAgentId: 'agent-a' })
    const result = MessageUtils.sanitizeMessages(chatState)

    // Alice should NOT see Bob's message or its preceding user message
    expectNoMessagesFromAgent(result, 'Bob')

    // Alice should see her own message + its user prompt
    const assistantMessages = result.filter(m => m.role === 'assistant')
    expect(assistantMessages).toHaveLength(1)
    expect(getMessageText(assistantMessages[0])).toContain('Alice')
  })

  it('filters correctly from the other agents perspective', () => {
    const chatState = buildIsolationScenario({ agentIsolation: true, activeAgentId: 'agent-b' })
    const result = MessageUtils.sanitizeMessages(chatState)

    // Bob should NOT see Alice's message
    expectNoMessagesFromAgent(result, 'Alice')

    // Bob should see his own message
    const assistantMessages = result.filter(m => m.role === 'assistant')
    expect(assistantMessages).toHaveLength(1)
    expect(getMessageText(assistantMessages[0])).toContain('Bob')
  })

  // =========================================================================
  // 3. Agent isolation scope — previous sessions visible regardless
  // =========================================================================
  it('does not filter messages from previous sessions even when isolation is enabled', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })

    const prevSessionId = 'prev-session'
    const currentSessionId = 'current-session'

    const round = createTestRound({
      id: 'round-1',
      agentIsolation: true,
      participants: [agentA, agentB],
    })

    const messages = [
      // Previous session messages (should be visible to all)
      createTestMessage({ role: 'user', content: 'Prev user msg', sessionId: prevSessionId }),
      createTestMessage({ role: 'assistant', content: 'Prev Bob msg', agentId: 'agent-b', sessionId: prevSessionId }),
      // Current session messages (isolation applies)
      createTestMessage({ role: 'user', content: 'Current user msg', sessionId: currentSessionId }),
      createTestMessage({ role: 'assistant', content: 'Current Bob msg', agentId: 'agent-b', sessionId: currentSessionId }),
    ]

    const chatState = createTestChatState({
      agents: [agentA, agentB],
      activeAgent: agentA,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId,
      sessions: [
        createTestSession({ id: prevSessionId, roundId: 'round-1', isActive: false, completedAt: new Date() }),
        createTestSession({ id: currentSessionId, roundId: 'round-1', isActive: true }),
      ],
    })

    const result = MessageUtils.sanitizeMessages(chatState)

    // Alice should see the previous session's Bob message (isolation only applies to current session)
    const assistantTexts = result
      .filter(m => m.role === 'assistant')
      .map(getMessageText)

    expect(assistantTexts.some(t => t.includes('Prev Bob msg'))).toBe(true)
    // But NOT the current session's Bob message
    expect(assistantTexts.some(t => t.includes('Current Bob msg'))).toBe(false)
  })

  // =========================================================================
  // 4. Preceding user message exclusion
  // =========================================================================
  it('excludes preceding user messages when excluding an agent message', () => {
    const chatState = buildIsolationScenario({ agentIsolation: true, activeAgentId: 'agent-a' })
    const result = MessageUtils.sanitizeMessages(chatState)

    // With isolation on, Bob's message AND its preceding "Hello Bob" user message should be excluded
    const userTexts = result.filter(m => m.role === 'user').map(getMessageText)
    expect(userTexts.some(t => t.includes('Hello Bob'))).toBe(false)
    expect(userTexts.some(t => t.includes('Hello Alice'))).toBe(true)
  })

  // =========================================================================
  // 5. Moderator bypass
  // =========================================================================
  it('returns all messages when isModeratorContext is true regardless of isolation', () => {
    const chatState = buildIsolationScenario({ agentIsolation: true, activeAgentId: 'agent-a' })
    const result = MessageUtils.sanitizeMessages(chatState, undefined, true)

    // Moderator should see all 4 messages
    expect(result).toHaveLength(4)
  })

  // =========================================================================
  // 6. Dialogue privacy — non-participants can't see dialogue messages
  // =========================================================================
  it('filters dialogue messages from non-participants', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })
    const agentC = createTestAgent({ id: 'agent-c', name: 'Charlie' })
    const sessionId = 'session-1'

    const round = createTestRound({
      id: 'round-1',
      type: 'dialogue' as any,
      participants: [agentA, agentB, agentC],
    })

    const messages = [
      createTestMessage({ role: 'user', content: 'Start dialogue', sessionId }),
      createTestMessage({
        role: 'assistant',
        content: 'Alice to Bob privately',
        agentId: 'agent-a',
        sessionId,
        parts: [
          { type: 'text', text: 'Alice to Bob privately' },
          { type: 'data-dialogue', data: { senderId: 'agent-a', receiverId: 'agent-b' } },
        ],
      }),
    ]

    // Charlie should NOT see the Alice-Bob dialogue
    const charlieState = createTestChatState({
      agents: [agentA, agentB, agentC],
      activeAgent: agentC,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
    })

    const charlieResult = MessageUtils.sanitizeMessages(charlieState)
    const charlieAssistant = charlieResult.filter(m => m.role === 'assistant')
    expect(charlieAssistant).toHaveLength(0)

    // Alice (sender) should see the dialogue
    const aliceState = { ...charlieState, activeAgent: agentA }
    const aliceResult = MessageUtils.sanitizeMessages(aliceState)
    expect(aliceResult.filter(m => m.role === 'assistant')).toHaveLength(1)

    // Bob (receiver) should see the dialogue
    const bobState = { ...charlieState, activeAgent: agentB }
    const bobResult = MessageUtils.sanitizeMessages(bobState)
    expect(bobResult.filter(m => m.role === 'assistant')).toHaveLength(1)
  })

  // =========================================================================
  // 7. Private round filtering — non-participants can't see completed private rounds
  // =========================================================================
  it('filters messages from completed private rounds for non-participants', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })

    const privateRound = createTestRound({ id: 'private-round', isPrivate: true })
    const currentRound = createTestRound({ id: 'current-round', participants: [agentA, agentB] })

    const privateSessionId = 'private-session'
    const currentSessionId = 'current-session'

    const messages = [
      // Private round messages — only Alice participated
      createTestMessage({
        role: 'user',
        content: 'Private prompt',
        sessionId: privateSessionId,
      }),
      createTestMessage({
        role: 'assistant',
        content: 'Alice private response',
        agentId: 'agent-a',
        sessionId: privateSessionId,
      }),
      // Current round messages
      createTestMessage({ role: 'user', content: 'Current prompt', sessionId: currentSessionId }),
    ]

    const sessions = [
      createTestSession({ id: privateSessionId, roundId: 'private-round', isActive: false, completedAt: new Date() }),
      createTestSession({ id: currentSessionId, roundId: 'current-round', isActive: true }),
    ]

    // Bob was NOT a participant in the private round — should not see those messages
    const bobState = createTestChatState({
      agents: [agentA, agentB],
      activeAgent: agentB,
      activeRound: currentRound,
      rounds: [privateRound, currentRound],
      messages,
      currentSessionId,
      sessions,
    })

    const bobResult = MessageUtils.sanitizeMessages(bobState)
    const bobTexts = bobResult.map(getMessageText)
    expect(bobTexts.some(t => t.includes('Alice private response'))).toBe(false)
    expect(bobTexts.some(t => t.includes('Current prompt'))).toBe(true)
  })

  // =========================================================================
  // 8. Private round active session — current session always visible
  // =========================================================================
  it('does NOT filter messages from the current active private session', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })
    const sessionId = 'active-private-session'

    const privateRound = createTestRound({
      id: 'private-round',
      isPrivate: true,
      participants: [agentA, agentB],
    })

    const messages = [
      createTestMessage({ role: 'user', content: 'Active private prompt', sessionId }),
      createTestMessage({ role: 'assistant', content: 'Alice active msg', agentId: 'agent-a', sessionId }),
    ]

    const bobState = createTestChatState({
      agents: [agentA, agentB],
      activeAgent: agentB,
      activeRound: privateRound,
      rounds: [privateRound],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'private-round', isActive: true })],
    })

    const result = MessageUtils.sanitizeMessages(bobState)
    // The private round filter only applies to completed sessions, not the current active one
    expect(result.filter(m => m.role === 'assistant')).toHaveLength(1)
  })

  // =========================================================================
  // 9. Self-reflection stripping
  // =========================================================================
  it('strips <SELF> tags from other agents messages', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const agentB = createTestAgent({ id: 'agent-b', name: 'Bob' })
    const sessionId = 'session-1'

    const round = createTestRound({
      id: 'round-1',
      agentIsolation: false,
      participants: [agentA, agentB],
    })

    const messages = [
      createTestMessage({ role: 'user', content: 'Think about this', sessionId }),
      createTestMessage({
        role: 'assistant',
        content: '<SELF>My private thought</SELF>Public response from Alice',
        agentId: 'agent-a',
        sessionId,
      }),
    ]

    // Bob viewing Alice's message — <SELF> should be stripped
    const bobState = createTestChatState({
      agents: [agentA, agentB],
      activeAgent: agentB,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
    })

    const bobResult = MessageUtils.sanitizeMessages(bobState)
    const bobText = getMessageText(bobResult.find(m => m.role === 'assistant')!)
    expect(bobText).not.toContain('My private thought')
    expect(bobText).toContain('Public response from Alice')
  })

  it('preserves <SELF> tags for the agents own messages', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const sessionId = 'session-1'

    const round = createTestRound({
      id: 'round-1',
      participants: [agentA],
    })

    const messages = [
      createTestMessage({ role: 'user', content: 'Think', sessionId }),
      createTestMessage({
        role: 'assistant',
        content: '<SELF>My thought</SELF>Public bit',
        agentId: 'agent-a',
        sessionId,
      }),
    ]

    const aliceState = createTestChatState({
      agents: [agentA],
      activeAgent: agentA,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
    })

    const result = MessageUtils.sanitizeMessages(aliceState)
    const text = getMessageText(result.find(m => m.role === 'assistant')!)
    expect(text).toContain('<SELF>My thought</SELF>')
  })

  // =========================================================================
  // 10. Agent tag injection
  // =========================================================================
  it('injects <AGENT> tags into messages that lack them', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const sessionId = 'session-1'

    const round = createTestRound({
      id: 'round-1',
      participants: [agentA],
    })

    const messages = [
      createTestMessage({ role: 'user', content: 'Hi', sessionId }),
      createTestMessage({ role: 'assistant', content: 'Response without agent tag', agentId: 'agent-a', sessionId }),
    ]

    const state = createTestChatState({
      agents: [agentA],
      activeAgent: agentA,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
    })

    const result = MessageUtils.sanitizeMessages(state)
    const text = getMessageText(result.find(m => m.role === 'assistant')!)
    expect(text).toMatch(/<AGENT>Alice<\/AGENT>/)
  })

  it('does not double-inject <AGENT> tags', () => {
    const agentA = createTestAgent({ id: 'agent-a', name: 'Alice' })
    const sessionId = 'session-1'

    const round = createTestRound({ id: 'round-1', participants: [agentA] })

    const messages = [
      createTestMessage({ role: 'user', content: 'Hi', sessionId }),
      createTestMessage({
        role: 'assistant',
        content: '<AGENT>Alice</AGENT>Already tagged',
        agentId: 'agent-a',
        sessionId,
      }),
    ]

    const state = createTestChatState({
      agents: [agentA],
      activeAgent: agentA,
      activeRound: round,
      rounds: [round],
      messages,
      currentSessionId: sessionId,
      sessions: [createTestSession({ id: sessionId, roundId: 'round-1', isActive: true })],
    })

    const result = MessageUtils.sanitizeMessages(state)
    const text = getMessageText(result.find(m => m.role === 'assistant')!)
    const matches = text.match(/<AGENT>/g) || []
    expect(matches).toHaveLength(1)
  })
})
