/**
 * Property-effect tests for sanitizeMessages() and buildLlmMessages().
 *
 * Philosophy: if changing a property doesn't change any test result,
 * we're not testing that property. Every test here toggles exactly one
 * property between two values and asserts that the output differs.
 */

import { MessageUtils } from '@/lib/chat/services/messages'
import {
  createTestAgent,
  createTestRound,
  createTestSession,
  createTestMessage,
  createTestChatState,
  resetIdCounter,
} from '@/__tests__/factories'

beforeEach(() => {
  resetIdCounter()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the text content from UIMessage-shaped output */
const textOf = (msg: any): string =>
  (msg.parts ?? [])
    .filter((p: any) => p?.type === 'text')
    .map((p: any) => String(p.text ?? ''))
    .join('')

const textsOf = (msgs: any[]): string[] => msgs.map(textOf)

// ---------------------------------------------------------------------------
// sanitizeMessages — property effects
// ---------------------------------------------------------------------------

describe('sanitizeMessages property effects', () => {
  // -------------------------------------------------------------------------
  // 1. Round.agentIsolation
  // -------------------------------------------------------------------------
  describe('round.agentIsolation', () => {
    it('when false, agent-2 sees agent-1 messages in the same session; when true, it does not', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const sessionId = 's1'

      const messages = [
        createTestMessage({ role: 'user', content: 'Hello', sessionId }),
        createTestMessage({ role: 'assistant', content: 'Hi from Alice', agentId: 'a1', sessionId }),
        createTestMessage({ role: 'user', content: 'Continue', sessionId }),
      ]

      // isolation OFF
      const roundOff = createTestRound({ id: 'r1', agentIsolation: false, participants: [agent1, agent2] })
      const stateOff = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: roundOff,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultOff = MessageUtils.sanitizeMessages(stateOff)

      // isolation ON
      const roundOn = createTestRound({ id: 'r1', agentIsolation: true, participants: [agent1, agent2] })
      const stateOn = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: roundOn,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultOn = MessageUtils.sanitizeMessages(stateOn)

      // With isolation OFF, agent-2 sees Alice's message
      expect(resultOff.length).toBeGreaterThan(resultOn.length)
      // With isolation ON, Alice's assistant message (and its preceding user message) are excluded
      const offTexts = textsOf(resultOff)
      const onTexts = textsOf(resultOn)
      expect(offTexts.some(t => t.includes('Alice'))).toBe(true)
      expect(onTexts.some(t => t.includes('Alice'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Round.isPrivate
  // -------------------------------------------------------------------------
  describe('round.isPrivate', () => {
    it('when false, all agents see completed round messages; when true, only participants do', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const agent3 = createTestAgent({ id: 'a3', name: 'Charlie' })

      const completedSessionId = 's-completed'
      const activeSessionId = 's-active'

      const messages = [
        // Completed session — only agent1 participated
        createTestMessage({ role: 'user', content: 'Start round 1', sessionId: completedSessionId }),
        createTestMessage({ role: 'assistant', content: 'Reply from Alice', agentId: 'a1', sessionId: completedSessionId }),
        // Active session
        createTestMessage({ role: 'user', content: 'Start round 2', sessionId: activeSessionId }),
      ]

      const completedSession = createTestSession({ id: completedSessionId, roundId: 'r1', isActive: false, completedAt: new Date() })
      const activeSession = createTestSession({ id: activeSessionId, roundId: 'r2', isActive: true })

      // isPrivate OFF — agent3 should see completed round messages
      const round1Off = createTestRound({ id: 'r1', isPrivate: false, participants: [agent1] })
      const round2 = createTestRound({ id: 'r2', participants: [agent1, agent2, agent3] })
      const stateOff = createTestChatState({
        agents: [agent1, agent2, agent3],
        activeAgent: agent3,
        activeRound: round2,
        rounds: [round1Off, round2],
        messages,
        sessions: [completedSession, activeSession],
        currentSessionId: activeSessionId,
      })
      const resultOff = MessageUtils.sanitizeMessages(stateOff)

      // isPrivate ON — agent3 should NOT see completed round messages (agent3 did not participate)
      const round1On = createTestRound({ id: 'r1', isPrivate: true, participants: [agent1] })
      const stateOn = createTestChatState({
        agents: [agent1, agent2, agent3],
        activeAgent: agent3,
        activeRound: round2,
        rounds: [round1On, round2],
        messages,
        sessions: [completedSession, activeSession],
        currentSessionId: activeSessionId,
      })
      const resultOn = MessageUtils.sanitizeMessages(stateOn)

      expect(resultOff.length).toBeGreaterThan(resultOn.length)
      const offTexts = textsOf(resultOff)
      const onTexts = textsOf(resultOn)
      expect(offTexts.some(t => t.includes('Alice'))).toBe(true)
      expect(onTexts.some(t => t.includes('Alice'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 3. Agent.id — changing activeAgent changes visibility
  // -------------------------------------------------------------------------
  describe('agent.id (activeAgent identity)', () => {
    it('changing which agent is activeAgent changes what messages are visible under isolation', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const sessionId = 's1'

      const messages = [
        createTestMessage({ role: 'user', content: 'Hello', sessionId }),
        createTestMessage({ role: 'assistant', content: 'Reply from Alice', agentId: 'a1', sessionId }),
        createTestMessage({ role: 'user', content: 'Next', sessionId }),
        createTestMessage({ role: 'assistant', content: 'Reply from Bob', agentId: 'a2', sessionId }),
      ]

      const round = createTestRound({ id: 'r1', agentIsolation: true, participants: [agent1, agent2] })

      // activeAgent = agent1 — sees own messages, not Bob's
      const stateA1 = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent1,
        activeRound: round,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultA1 = MessageUtils.sanitizeMessages(stateA1)

      // activeAgent = agent2 — sees own messages, not Alice's
      const stateA2 = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: round,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultA2 = MessageUtils.sanitizeMessages(stateA2)

      const a1Texts = textsOf(resultA1)
      const a2Texts = textsOf(resultA2)

      expect(a1Texts.some(t => t.includes('Alice'))).toBe(true)
      expect(a1Texts.some(t => t.includes('Bob'))).toBe(false)

      expect(a2Texts.some(t => t.includes('Bob'))).toBe(true)
      expect(a2Texts.some(t => t.includes('Alice'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 4. Agent.name — appears in <AGENT> tags
  // -------------------------------------------------------------------------
  describe('agent.name', () => {
    it('agent name appears in <AGENT> tags in output and changing it changes the output', () => {
      const sessionId = 's1'

      // Name = "Alice"
      const agentAlice = createTestAgent({ id: 'a1', name: 'Alice' })
      const messages = [
        createTestMessage({ role: 'assistant', content: 'Hello there', agentId: 'a1', sessionId }),
      ]
      const round = createTestRound({ id: 'r1', participants: [agentAlice] })
      const stateAlice = createTestChatState({
        agents: [agentAlice],
        activeAgent: agentAlice,
        activeRound: round,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultAlice = MessageUtils.sanitizeMessages(stateAlice)

      // Name = "Zara"
      const agentZara = createTestAgent({ id: 'a1', name: 'Zara' })
      const roundZ = createTestRound({ id: 'r1', participants: [agentZara] })
      const stateZara = createTestChatState({
        agents: [agentZara],
        activeAgent: agentZara,
        activeRound: roundZ,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultZara = MessageUtils.sanitizeMessages(stateZara)

      const aliceText = textsOf(resultAlice).join(' ')
      const zaraText = textsOf(resultZara).join(' ')

      expect(aliceText).toContain('<AGENT>Alice</AGENT>')
      expect(zaraText).toContain('<AGENT>Zara</AGENT>')
      expect(aliceText).not.toEqual(zaraText)
    })
  })

  // -------------------------------------------------------------------------
  // 5. metadata.agentId — affects filtering under isolation
  // -------------------------------------------------------------------------
  describe('metadata.agentId', () => {
    it('messages with different agentIds are filtered differently under isolation', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const sessionId = 's1'
      const round = createTestRound({ id: 'r1', agentIsolation: true, participants: [agent1, agent2] })

      // Message tagged as agent-1's
      const messagesA1 = [
        createTestMessage({ role: 'user', content: 'Hello', sessionId }),
        createTestMessage({ role: 'assistant', content: 'Reply', agentId: 'a1', sessionId }),
      ]

      // Same content but tagged as agent-2's
      const messagesA2 = [
        createTestMessage({ role: 'user', content: 'Hello', sessionId }),
        createTestMessage({ role: 'assistant', content: 'Reply', agentId: 'a2', sessionId }),
      ]

      // Active agent is always agent2
      const stateA1msg = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: round,
        messages: messagesA1,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultA1msg = MessageUtils.sanitizeMessages(stateA1msg)

      const stateA2msg = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: round,
        messages: messagesA2,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultA2msg = MessageUtils.sanitizeMessages(stateA2msg)

      // When message is tagged as a1 (other agent), agent2 shouldn't see it under isolation
      // When message is tagged as a2 (self), agent2 should see it
      expect(resultA2msg.length).toBeGreaterThan(resultA1msg.length)
    })
  })

  // -------------------------------------------------------------------------
  // 6. metadata.sessionId — current session vs other sessions
  // -------------------------------------------------------------------------
  describe('metadata.sessionId', () => {
    it('messages in the current session vs other sessions behave differently under isolation', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const currentSession = 's-current'
      const otherSession = 's-other'

      const round = createTestRound({ id: 'r1', agentIsolation: true, participants: [agent1, agent2] })

      // Message in CURRENT session from agent1 — agent2 won't see it (isolation applies to current session)
      const messagesInCurrent = [
        createTestMessage({ role: 'user', content: 'Hello', sessionId: currentSession }),
        createTestMessage({ role: 'assistant', content: 'From Alice', agentId: 'a1', sessionId: currentSession }),
      ]

      // Same message but in a DIFFERENT (completed) session — isolation doesn't apply to other sessions
      const messagesInOther = [
        createTestMessage({ role: 'user', content: 'Hello', sessionId: otherSession }),
        createTestMessage({ role: 'assistant', content: 'From Alice', agentId: 'a1', sessionId: otherSession }),
      ]

      const stateCurrent = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: round,
        messages: messagesInCurrent,
        sessions: [createTestSession({ id: currentSession, roundId: 'r1', isActive: true })],
        currentSessionId: currentSession,
      })
      const resultCurrent = MessageUtils.sanitizeMessages(stateCurrent)

      const stateOther = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: round,
        messages: messagesInOther,
        sessions: [
          createTestSession({ id: otherSession, roundId: 'r1', isActive: false, completedAt: new Date() }),
          createTestSession({ id: currentSession, roundId: 'r1', isActive: true }),
        ],
        currentSessionId: currentSession,
      })
      const resultOther = MessageUtils.sanitizeMessages(stateOther)

      // Isolation only applies to the current session, so messages in the other session
      // should NOT be filtered by isolation (they may still appear)
      expect(resultCurrent.length).not.toEqual(resultOther.length)
    })
  })

  // -------------------------------------------------------------------------
  // 7. Parts with data-dialogue — hidden from non-participants
  // -------------------------------------------------------------------------
  describe('parts with data-dialogue', () => {
    it('dialogue messages are hidden from non-participants', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const agent3 = createTestAgent({ id: 'a3', name: 'Charlie' })
      const sessionId = 's1'

      // Normal message (no dialogue part)
      const normalMessages = [
        createTestMessage({
          role: 'assistant',
          content: 'Hello everyone',
          agentId: 'a1',
          sessionId,
        }),
      ]

      // Dialogue message (with data-dialogue part)
      const dialogueMessages = [
        createTestMessage({
          role: 'assistant',
          content: 'Private chat between Alice and Bob',
          agentId: 'a1',
          sessionId,
          parts: [
            { type: 'text', text: 'Private chat between Alice and Bob' },
            { type: 'data-dialogue', data: { senderId: 'a1', receiverId: 'a2' } },
          ],
        }),
      ]

      const round = createTestRound({ id: 'r1', participants: [agent1, agent2, agent3] })

      // Agent3 (Charlie) sees normal message
      const stateNormal = createTestChatState({
        agents: [agent1, agent2, agent3],
        activeAgent: agent3,
        activeRound: round,
        messages: normalMessages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultNormal = MessageUtils.sanitizeMessages(stateNormal)

      // Agent3 (Charlie) does NOT see dialogue message (not a participant in the dialogue)
      const stateDialogue = createTestChatState({
        agents: [agent1, agent2, agent3],
        activeAgent: agent3,
        activeRound: round,
        messages: dialogueMessages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultDialogue = MessageUtils.sanitizeMessages(stateDialogue)

      expect(resultNormal.length).toBeGreaterThan(0)
      expect(resultDialogue.length).toBe(0)
    })

    it('dialogue messages are visible to dialogue participants', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const sessionId = 's1'

      const dialogueMessages = [
        createTestMessage({
          role: 'assistant',
          content: 'Private to Bob',
          agentId: 'a1',
          sessionId,
          parts: [
            { type: 'text', text: 'Private to Bob' },
            { type: 'data-dialogue', data: { senderId: 'a1', receiverId: 'a2' } },
          ],
        }),
      ]

      const round = createTestRound({ id: 'r1', participants: [agent1, agent2] })

      // Agent2 (Bob) IS a dialogue participant — should see it
      const state = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: round,
        messages: dialogueMessages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const result = MessageUtils.sanitizeMessages(state)

      expect(result.length).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // 8. Self-reflection tags — stripped from others, preserved for self
  // -------------------------------------------------------------------------
  describe('self-reflection tags (<SELF>)', () => {
    it('<SELF> tags are stripped from other agents messages but preserved for own messages', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const sessionId = 's1'

      const messages = [
        createTestMessage({
          role: 'assistant',
          content: 'Visible text<SELF>Private thought</SELF> more visible',
          agentId: 'a1',
          sessionId,
        }),
      ]

      const round = createTestRound({ id: 'r1', participants: [agent1, agent2] })

      // When Alice is the activeAgent — sees her own <SELF> tags
      const stateSelf = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent1,
        activeRound: round,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultSelf = MessageUtils.sanitizeMessages(stateSelf)

      // When Bob is the activeAgent — <SELF> tags are stripped
      const stateOther = createTestChatState({
        agents: [agent1, agent2],
        activeAgent: agent2,
        activeRound: round,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultOther = MessageUtils.sanitizeMessages(stateOther)

      const selfText = textsOf(resultSelf).join(' ')
      const otherText = textsOf(resultOther).join(' ')

      expect(selfText).toContain('Private thought')
      expect(otherText).not.toContain('Private thought')
      expect(selfText).not.toEqual(otherText)
    })
  })
})

// ---------------------------------------------------------------------------
// buildLlmMessages — property effects
// ---------------------------------------------------------------------------

describe('buildLlmMessages property effects', () => {
  // -------------------------------------------------------------------------
  // 9. config: null — returns raw messages without retention processing
  // -------------------------------------------------------------------------
  describe('config: null vs config present', () => {
    it('when config is null, returns raw messages; when config is present, applies retention logic', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const sessionId = 's1'

      const messages = [
        createTestMessage({ role: 'user', content: 'Hello', sessionId }),
        createTestMessage({ role: 'assistant', content: 'Hi there', agentId: 'a1', sessionId }),
      ]

      const round = createTestRound({ id: 'r1', participants: [agent1] })

      // config: null — raw passthrough
      const stateNull = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
        config: null,
      })
      const resultNull = MessageUtils.buildLlmMessages(stateNull)

      // config present — processed through retention + sanitization
      const stateConfig = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round,
        messages,
        sessions: [createTestSession({ id: sessionId, roundId: 'r1', isActive: true })],
        currentSessionId: sessionId,
      })
      const resultConfig = MessageUtils.buildLlmMessages(stateConfig)

      // With config null, messages pass through as raw { role, parts: [{type: 'text', text}] }
      // With config present, messages go through sanitization which adds <AGENT> tags
      const nullTexts = textsOf(resultNull)
      const configTexts = textsOf(resultConfig)

      // Config version has <AGENT> tags, null version does not
      expect(configTexts.some(t => t.includes('<AGENT>'))).toBe(true)
      expect(nullTexts.some(t => t.includes('<AGENT>'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 10. config.retentionSettings.ignore — old sessions get dropped
  // -------------------------------------------------------------------------
  describe('config.retentionSettings.ignore', () => {
    it('when ignore is enabled with afterRounds=1, old completed sessions get dropped', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })

      const round1 = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'keep_full' } as any })
      const round2 = createTestRound({ id: 'r2', participants: [agent1], retentionSettings: { policy: 'keep_full' } as any })

      const session1 = createTestSession({ id: 's1', roundId: 'r1', isActive: false, completedAt: new Date() })
      const session2 = createTestSession({ id: 's2', roundId: 'r2', isActive: true })

      const messages = [
        createTestMessage({ role: 'user', content: 'Round 1 user', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Round 1 reply', agentId: 'a1', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Round 2 user', sessionId: 's2' }),
        createTestMessage({ role: 'assistant', content: 'Round 2 reply', agentId: 'a1', sessionId: 's2' }),
      ]

      // ignore DISABLED
      const stateNoIgnore = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [round1, round2],
        messages,
        sessions: [session1, session2],
        currentSessionId: 's2',
        config: {
          id: 'cfg',
          title: 'Test',
          userId: 'u1',
          chatInstructions: null,
          examplePrompts: [],
          retentionSettings: { ignore: { enabled: false, afterRounds: 1 }, summarize: { enabled: false, afterRounds: 3 } },
          memorySettings: null,
          designSettings: null,
          spaceId: null,
          previewChatId: null,
          createdAt: new Date(),
          lastUpdatedAt: new Date(),
        } as any,
      })
      const resultNoIgnore = MessageUtils.buildLlmMessages(stateNoIgnore)

      // ignore ENABLED with afterRounds=1 — session1 is 1 round ago, so it gets ignored
      const stateIgnore = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [round1, round2],
        messages,
        sessions: [session1, session2],
        currentSessionId: 's2',
        config: {
          id: 'cfg',
          title: 'Test',
          userId: 'u1',
          chatInstructions: null,
          examplePrompts: [],
          retentionSettings: { ignore: { enabled: true, afterRounds: 1 }, summarize: { enabled: false, afterRounds: 3 } },
          memorySettings: null,
          designSettings: null,
          spaceId: null,
          previewChatId: null,
          createdAt: new Date(),
          lastUpdatedAt: new Date(),
        } as any,
      })
      const resultIgnore = MessageUtils.buildLlmMessages(stateIgnore)

      // Without ignore, we see all messages; with ignore, session1 messages are dropped
      expect(resultNoIgnore.length).toBeGreaterThan(resultIgnore.length)
      const noIgnoreTexts = textsOf(resultNoIgnore)
      const ignoreTexts = textsOf(resultIgnore)
      expect(noIgnoreTexts.some(t => t.includes('Round 1'))).toBe(true)
      expect(ignoreTexts.some(t => t.includes('Round 1'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 11. round.retentionSettings.policy = 'keep_full'
  // -------------------------------------------------------------------------
  describe('round.retentionSettings.policy = keep_full', () => {
    it('all messages are preserved when policy is keep_full', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })

      const session1 = createTestSession({ id: 's1', roundId: 'r1', isActive: false, completedAt: new Date() })
      const session2 = createTestSession({ id: 's2', roundId: 'r2', isActive: true })

      const messages = [
        createTestMessage({ role: 'user', content: 'Round 1 question', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Round 1 answer', agentId: 'a1', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Round 2 question', sessionId: 's2' }),
      ]

      // policy = keep_full — all messages preserved
      const roundKeep = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'keep_full' } as any })
      const round2 = createTestRound({ id: 'r2', participants: [agent1] })

      const state = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundKeep, round2],
        messages,
        sessions: [session1, session2],
        currentSessionId: 's2',
      })
      const result = MessageUtils.buildLlmMessages(state)

      // All messages should be present (keep_full preserves everything)
      const texts = textsOf(result)
      expect(texts.some(t => t.includes('Round 1'))).toBe(true)
      expect(texts.some(t => t.includes('Round 2'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 12. round.retentionSettings.policy = 'summarize' WITH compressionData
  // -------------------------------------------------------------------------
  describe('round.retentionSettings.policy = summarize with compressionData', () => {
    it('messages are replaced with summary when policy=summarize and compressionData exists', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })

      const session1 = createTestSession({
        id: 's1',
        roundId: 'r1',
        isActive: false,
        completedAt: new Date(),
        compressionData: {
          summary: 'This is a summary of round 1',
          originalMessageCount: 5,
          summarizedAt: new Date(),
        },
      })
      const session2 = createTestSession({ id: 's2', roundId: 'r2', isActive: true })

      const messages = [
        createTestMessage({ role: 'user', content: 'Original question', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Original answer', agentId: 'a1', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Round 2 question', sessionId: 's2' }),
      ]

      const roundSummarize = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'summarize' } as any })
      const round2 = createTestRound({ id: 'r2', participants: [agent1] })

      const state = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundSummarize, round2],
        messages,
        sessions: [session1, session2],
        currentSessionId: 's2',
      })
      const result = MessageUtils.buildLlmMessages(state)

      const texts = textsOf(result)
      // Original messages should be replaced with summary
      expect(texts.some(t => t.includes('summary of round 1'))).toBe(true)
      expect(texts.some(t => t.includes('Original question'))).toBe(false)
      expect(texts.some(t => t.includes('Original answer'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 13. round.retentionSettings.policy = 'summarize' WITHOUT compressionData
  // -------------------------------------------------------------------------
  describe('round.retentionSettings.policy = summarize without compressionData', () => {
    it('falls back to full messages when policy=summarize but no compressionData', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })

      // No compressionData
      const session1 = createTestSession({ id: 's1', roundId: 'r1', isActive: false, completedAt: new Date() })
      const session2 = createTestSession({ id: 's2', roundId: 'r2', isActive: true })

      const messages = [
        createTestMessage({ role: 'user', content: 'Original question', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Original answer', agentId: 'a1', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Round 2 question', sessionId: 's2' }),
      ]

      const roundSummarize = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'summarize' } as any })
      const round2 = createTestRound({ id: 'r2', participants: [agent1] })

      const state = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundSummarize, round2],
        messages,
        sessions: [session1, session2],
        currentSessionId: 's2',
      })
      const result = MessageUtils.buildLlmMessages(state)

      const texts = textsOf(result)
      // Without compressionData, falls back to full messages (through sanitize)
      expect(texts.some(t => t.includes('Original'))).toBe(true)
      expect(texts.some(t => t.includes('summarizes'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 14. round.retentionSettings.policy = 'ignore'
  // -------------------------------------------------------------------------
  describe('round.retentionSettings.policy = ignore', () => {
    it('messages are dropped entirely when policy=ignore', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })

      const session1 = createTestSession({ id: 's1', roundId: 'r1', isActive: false, completedAt: new Date() })
      const session2 = createTestSession({ id: 's2', roundId: 'r2', isActive: true })

      const messages = [
        createTestMessage({ role: 'user', content: 'Ignored question', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Ignored answer', agentId: 'a1', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Round 2 question', sessionId: 's2' }),
        createTestMessage({ role: 'assistant', content: 'Round 2 answer', agentId: 'a1', sessionId: 's2' }),
      ]

      // policy = ignore for round 1
      const roundIgnore = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'ignore' } as any })
      // policy = keep_full for round 2
      const round2 = createTestRound({ id: 'r2', participants: [agent1], retentionSettings: { policy: 'keep_full' } as any })

      const stateIgnore = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundIgnore, round2],
        messages,
        sessions: [session1, session2],
        currentSessionId: 's2',
      })
      const resultIgnore = MessageUtils.buildLlmMessages(stateIgnore)

      // policy = keep_full for round 1 (for comparison)
      const roundKeep = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'keep_full' } as any })
      const stateKeep = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundKeep, round2],
        messages,
        sessions: [session1, session2],
        currentSessionId: 's2',
      })
      const resultKeep = MessageUtils.buildLlmMessages(stateKeep)

      // With ignore, round 1 messages are dropped
      const ignoreTexts = textsOf(resultIgnore)
      const keepTexts = textsOf(resultKeep)

      expect(keepTexts.some(t => t.includes('Ignored'))).toBe(true)
      expect(ignoreTexts.some(t => t.includes('Ignored'))).toBe(false)
      expect(resultKeep.length).toBeGreaterThan(resultIgnore.length)
    })
  })

  // -------------------------------------------------------------------------
  // 15. session.isActive — active sessions always use keep_full
  // -------------------------------------------------------------------------
  describe('session.isActive', () => {
    it('active sessions use keep_full regardless of round policy', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })

      const messages = [
        createTestMessage({ role: 'user', content: 'Hello there', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Hi from Alice', agentId: 'a1', sessionId: 's1' }),
      ]

      // Round with ignore policy — would normally drop messages
      const round = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'ignore' } as any })

      // Session is ACTIVE — should override ignore policy to keep_full
      const stateActive = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round,
        rounds: [round],
        messages,
        sessions: [createTestSession({ id: 's1', roundId: 'r1', isActive: true })],
        currentSessionId: 's1',
      })
      const resultActive = MessageUtils.buildLlmMessages(stateActive)

      // Session is NOT active — ignore policy takes effect
      const round2 = createTestRound({ id: 'r2', participants: [agent1] })
      const stateInactive = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [round, round2],
        messages,
        sessions: [
          createTestSession({ id: 's1', roundId: 'r1', isActive: false, completedAt: new Date() }),
          createTestSession({ id: 's2', roundId: 'r2', isActive: true }),
        ],
        currentSessionId: 's2',
      })
      const resultInactive = MessageUtils.buildLlmMessages(stateInactive)

      // Active session keeps messages, inactive with ignore drops them
      expect(resultActive.length).toBeGreaterThan(0)
      expect(resultActive.length).toBeGreaterThan(resultInactive.length)
      const activeTexts = textsOf(resultActive)
      expect(activeTexts.some(t => t.includes('Hello there') || t.includes('Alice'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 16. session.compressionData — used when policy=summarize
  // -------------------------------------------------------------------------
  describe('session.compressionData', () => {
    it('when compressionData is present and policy=summarize, summary replaces messages', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })

      const messages = [
        createTestMessage({ role: 'user', content: 'Original user msg', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Original agent msg', agentId: 'a1', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Active session msg', sessionId: 's2' }),
      ]

      const roundSummarize = createTestRound({ id: 'r1', participants: [agent1], retentionSettings: { policy: 'summarize' } as any })
      const round2 = createTestRound({ id: 'r2', participants: [agent1] })

      // WITH compressionData
      const stateWithCompression = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundSummarize, round2],
        messages,
        sessions: [
          createTestSession({
            id: 's1',
            roundId: 'r1',
            isActive: false,
            completedAt: new Date(),
            compressionData: {
              summary: 'Compressed summary text',
              originalMessageCount: 2,
              summarizedAt: new Date(),
            },
          }),
          createTestSession({ id: 's2', roundId: 'r2', isActive: true }),
        ],
        currentSessionId: 's2',
      })
      const resultWith = MessageUtils.buildLlmMessages(stateWithCompression)

      // WITHOUT compressionData — falls back to full messages
      const stateWithout = createTestChatState({
        agents: [agent1],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundSummarize, round2],
        messages,
        sessions: [
          createTestSession({ id: 's1', roundId: 'r1', isActive: false, completedAt: new Date() }),
          createTestSession({ id: 's2', roundId: 'r2', isActive: true }),
        ],
        currentSessionId: 's2',
      })
      const resultWithout = MessageUtils.buildLlmMessages(stateWithout)

      const withTexts = textsOf(resultWith)
      const withoutTexts = textsOf(resultWithout)

      // With compression, original messages are replaced with summary
      expect(withTexts.some(t => t.includes('Compressed summary text'))).toBe(true)
      expect(withTexts.some(t => t.includes('Original user msg'))).toBe(false)

      // Without compression, original messages are preserved (fallback)
      expect(withoutTexts.some(t => t.includes('Original'))).toBe(true)
      expect(withoutTexts.some(t => t.includes('Compressed summary text'))).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 17. session.compressionData.dialogues — dialogue-specific summaries
  // -------------------------------------------------------------------------
  describe('session.compressionData.dialogues', () => {
    it('only dialogues where agent participated are included in the summary', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const agent3 = createTestAgent({ id: 'a3', name: 'Charlie' })

      const messages = [
        createTestMessage({ role: 'user', content: 'Start dialogue round', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'Dialogue msg', agentId: 'a1', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Active round msg', sessionId: 's2' }),
      ]

      const roundDialogue = createTestRound({
        id: 'r1',
        type: 'dialogue' as any,
        participants: [agent1, agent2, agent3],
        retentionSettings: { policy: 'summarize' } as any,
      })
      const round2 = createTestRound({ id: 'r2', participants: [agent1, agent2, agent3] })

      const compressionData = {
        summarizedAt: new Date(),
        dialogues: {
          'a1||a2': {
            summary: 'Alice and Bob discussed topic X',
            originalMessageCount: 4,
            participants: ['a1', 'a2'] as [string, string],
          },
          'a2||a3': {
            summary: 'Bob and Charlie discussed topic Y',
            originalMessageCount: 3,
            participants: ['a2', 'a3'] as [string, string],
          },
        },
      }

      // Active agent is Alice (a1) — should only see a1||a2 dialogue summary
      const stateAlice = createTestChatState({
        agents: [agent1, agent2, agent3],
        activeAgent: agent1,
        activeRound: round2,
        rounds: [roundDialogue, round2],
        messages,
        sessions: [
          createTestSession({
            id: 's1',
            roundId: 'r1',
            isActive: false,
            completedAt: new Date(),
            compressionData,
          }),
          createTestSession({ id: 's2', roundId: 'r2', isActive: true }),
        ],
        currentSessionId: 's2',
      })
      const resultAlice = MessageUtils.buildLlmMessages(stateAlice)

      // Active agent is Charlie (a3) — should only see a2||a3 dialogue summary
      const stateCharlie = createTestChatState({
        agents: [agent1, agent2, agent3],
        activeAgent: agent3,
        activeRound: round2,
        rounds: [roundDialogue, round2],
        messages,
        sessions: [
          createTestSession({
            id: 's1',
            roundId: 'r1',
            isActive: false,
            completedAt: new Date(),
            compressionData,
          }),
          createTestSession({ id: 's2', roundId: 'r2', isActive: true }),
        ],
        currentSessionId: 's2',
      })
      const resultCharlie = MessageUtils.buildLlmMessages(stateCharlie)

      const aliceTexts = textsOf(resultAlice)
      const charlieTexts = textsOf(resultCharlie)

      // Alice sees her dialogue summary but not Charlie's
      expect(aliceTexts.some(t => t.includes('topic X'))).toBe(true)
      expect(aliceTexts.some(t => t.includes('topic Y'))).toBe(false)

      // Charlie sees his dialogue summary but not Alice's exclusive one
      expect(charlieTexts.some(t => t.includes('topic Y'))).toBe(true)
      expect(charlieTexts.some(t => t.includes('topic X'))).toBe(false)
    })

    it('Bob (a2) participates in both dialogues and sees both summaries', () => {
      const agent1 = createTestAgent({ id: 'a1', name: 'Alice' })
      const agent2 = createTestAgent({ id: 'a2', name: 'Bob' })
      const agent3 = createTestAgent({ id: 'a3', name: 'Charlie' })

      const messages = [
        createTestMessage({ role: 'user', content: 'Start', sessionId: 's1' }),
        createTestMessage({ role: 'assistant', content: 'msg', agentId: 'a2', sessionId: 's1' }),
        createTestMessage({ role: 'user', content: 'Active', sessionId: 's2' }),
      ]

      const roundDialogue = createTestRound({
        id: 'r1',
        type: 'dialogue' as any,
        participants: [agent1, agent2, agent3],
        retentionSettings: { policy: 'summarize' } as any,
      })
      const round2 = createTestRound({ id: 'r2', participants: [agent1, agent2, agent3] })

      const compressionData = {
        summarizedAt: new Date(),
        dialogues: {
          'a1||a2': {
            summary: 'Alice-Bob dialogue summary',
            originalMessageCount: 4,
            participants: ['a1', 'a2'] as [string, string],
          },
          'a2||a3': {
            summary: 'Bob-Charlie dialogue summary',
            originalMessageCount: 3,
            participants: ['a2', 'a3'] as [string, string],
          },
        },
      }

      // Active agent is Bob (a2) — participates in BOTH dialogues
      const stateBob = createTestChatState({
        agents: [agent1, agent2, agent3],
        activeAgent: agent2,
        activeRound: round2,
        rounds: [roundDialogue, round2],
        messages,
        sessions: [
          createTestSession({
            id: 's1',
            roundId: 'r1',
            isActive: false,
            completedAt: new Date(),
            compressionData,
          }),
          createTestSession({ id: 's2', roundId: 'r2', isActive: true }),
        ],
        currentSessionId: 's2',
      })
      const resultBob = MessageUtils.buildLlmMessages(stateBob)

      const bobTexts = textsOf(resultBob)
      expect(bobTexts.some(t => t.includes('Alice-Bob'))).toBe(true)
      expect(bobTexts.some(t => t.includes('Bob-Charlie'))).toBe(true)
    })
  })
})
