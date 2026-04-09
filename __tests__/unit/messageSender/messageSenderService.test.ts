/**
 * Unit tests for the pure-logic functions in MessageSenderService.
 *
 * Tested functions:
 *   - MessageSenderService.initializeMessageSenders()
 *   - MessageSenderService.shouldDetermineMessageSenders(progress, round)
 *   - MessageSenderService.resetMessageSenders(progress)
 *   - MessageSenderService.clearModeratorMessage(chatState)
 *
 * LLM-dependent methods (determineMessageSenders, askModeratorToSelectSenders,
 * setMessageSenderProgress) are excluded — they require mocking the AI SDK
 * and are better covered by integration tests.
 */

import { MessageSenderService } from '@/lib/chat/services/messageSender'
import {
  createTestChatState,
  createTestAgent,
  createTestRound,
  resetIdCounter,
} from '@/__tests__/factories'
import type { ChatProgress } from '@/lib/types/chat-progress'
import { createInitialProgress } from '@/lib/types/chat-progress'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/chat/services/LLM', () => ({
  LLMService: {
    generateTextForModerator: jest.fn(),
  },
}))

jest.mock('@/lib/chat/services/memory', () => ({
  MemoryService: {
    getMemoriesForPrompt: jest.fn().mockResolvedValue([]),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProgress(
  agentId = 'agent-1',
  mode: 'participant' | 'moderator' = 'participant',
  senders?: { allowed: string[]; determined: boolean }
): ChatProgress {
  const progress = createInitialProgress('round-1', 'api')
  progress.active.agent.id = agentId
  progress.active.agent.mode = mode
  if (senders) {
    progress.active.senders = senders
  }
  return progress
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetIdCounter()
  jest.clearAllMocks()
})

// =========================================================================
// initializeMessageSenders
// =========================================================================

describe('MessageSenderService.initializeMessageSenders', () => {
  it('returns an object with empty allowed array and determined: false', () => {
    const result = MessageSenderService.initializeMessageSenders()
    expect(result).toEqual({
      allowed: [],
      determined: false,
    })
  })

  it('returns a fresh object on every call (no shared references)', () => {
    const a = MessageSenderService.initializeMessageSenders()
    const b = MessageSenderService.initializeMessageSenders()
    expect(a).not.toBe(b)
    expect(a.allowed).not.toBe(b.allowed)
  })
})

// =========================================================================
// shouldDetermineMessageSenders
// =========================================================================

describe('MessageSenderService.shouldDetermineMessageSenders', () => {
  it('returns false when messageSenderMode is not moderator_decides', () => {
    const progress = buildProgress()
    const round = createTestRound({ messageSenderMode: 'all_participants' as any })
    expect(
      MessageSenderService.shouldDetermineMessageSenders(progress, round)
    ).toBe(false)
  })

  it('returns false when messageSenderMode is null (defaults to all_participants)', () => {
    const progress = buildProgress()
    const round = createTestRound({ messageSenderMode: null })
    expect(
      MessageSenderService.shouldDetermineMessageSenders(progress, round)
    ).toBe(false)
  })

  it('returns true when messageSenderMode is moderator_decides and not yet determined', () => {
    const progress = buildProgress('agent-1', 'participant', {
      allowed: [],
      determined: false,
    })
    const round = createTestRound({ messageSenderMode: 'moderator_decides' as any })
    expect(
      MessageSenderService.shouldDetermineMessageSenders(progress, round)
    ).toBe(true)
  })

  it('returns false when messageSenderMode is moderator_decides but already determined', () => {
    const progress = buildProgress('agent-1', 'participant', {
      allowed: ['agent-2'],
      determined: true,
    })
    const round = createTestRound({ messageSenderMode: 'moderator_decides' as any })
    expect(
      MessageSenderService.shouldDetermineMessageSenders(progress, round)
    ).toBe(false)
  })

  it('returns true when senders object is missing (not yet initialized)', () => {
    const progress = buildProgress()
    // Ensure senders is undefined
    delete progress.active.senders
    const round = createTestRound({ messageSenderMode: 'moderator_decides' as any })
    expect(
      MessageSenderService.shouldDetermineMessageSenders(progress, round)
    ).toBe(true)
  })
})

// =========================================================================
// resetMessageSenders
// =========================================================================

describe('MessageSenderService.resetMessageSenders', () => {
  it('resets allowed to empty array and determined to false when senders exist', () => {
    const progress = buildProgress('agent-1', 'participant', {
      allowed: ['agent-2', 'agent-3'],
      determined: true,
    })

    MessageSenderService.resetMessageSenders(progress)

    expect(progress.active.senders).toEqual({
      allowed: [],
      determined: false,
    })
  })

  it('creates senders object if missing', () => {
    const progress = buildProgress()
    delete progress.active.senders

    MessageSenderService.resetMessageSenders(progress)

    expect(progress.active.senders).toEqual({
      allowed: [],
      determined: false,
    })
  })

  it('does not affect other progress properties', () => {
    const progress = buildProgress('agent-1', 'participant', {
      allowed: ['agent-2'],
      determined: true,
    })
    progress.messageCount = 5
    progress.messageAuthors = ['agent-1', 'agent-2']

    MessageSenderService.resetMessageSenders(progress)

    expect(progress.messageCount).toBe(5)
    expect(progress.messageAuthors).toEqual(['agent-1', 'agent-2'])
    expect(progress.active.agent.id).toBe('agent-1')
  })
})

// =========================================================================
// clearModeratorMessage
// =========================================================================

describe('MessageSenderService.clearModeratorMessage', () => {
  it('deletes moderatorVerbatimMessage when it exists', () => {
    const state = createTestChatState({
      progress: buildProgress(),
    })
    state.moderatorVerbatimMessage = 'The moderator says hello'

    MessageSenderService.clearModeratorMessage(state)

    expect(state.moderatorVerbatimMessage).toBeUndefined()
    expect('moderatorVerbatimMessage' in state).toBe(false)
  })

  it('is a no-op when moderatorVerbatimMessage is not present', () => {
    const state = createTestChatState({
      progress: buildProgress(),
    })
    // Ensure it is not set
    delete state.moderatorVerbatimMessage

    // Should not throw
    MessageSenderService.clearModeratorMessage(state)

    expect(state.moderatorVerbatimMessage).toBeUndefined()
  })

  it('only clears moderatorVerbatimMessage without affecting other state', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({
      id: 'round-1',
      type: 'brainstorm' as any,
      participants: [agent],
    })
    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
    })
    state.moderatorVerbatimMessage = 'Selected agents: Alpha, Beta'

    MessageSenderService.clearModeratorMessage(state)

    // moderatorVerbatimMessage should be gone
    expect(state.moderatorVerbatimMessage).toBeUndefined()
    // but the rest of the state should be intact
    expect(state.activeRound.id).toBe('round-1')
    expect(state.activeRound.type).toBe('brainstorm')
    expect(state.activeAgent.id).toBe('agent-1')
    expect(state.chat.id).toBe('test-chat-id')
  })
})
