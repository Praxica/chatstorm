/**
 * Unit tests for the progress service functions.
 *
 * Tested functions:
 *   - createInitialProgress(roundId, initialStep)    from lib/types/chat-progress.ts
 *   - normalizeProgress(progress)                     from lib/types/chat-progress.ts
 *   - activateNextProgress(progress)                  from lib/chat/services/progress.ts
 *   - isRoundCompleteAfterNextMessage(progress, round) from lib/chat/services/progress.ts
 *   - determineNextRound(chatState)                   from lib/chat/services/progress.ts
 *   - iterateProgress(chatState, result)              from lib/chat/services/progress.ts
 *
 * Mocked modules:
 *   - @/lib/chat/modalities/ModalityRegistry (for isRoundComplete via RoundUtils)
 *   - @/lib/chat/services/dialogue (DialogueService)
 *   - @/lib/chat/services/messageSender (MessageSenderService)
 */

import { createInitialProgress, normalizeProgress } from '@/lib/types/chat-progress'
import type { ChatProgress } from '@/lib/types/chat-progress'
import {
  activateNextProgress,
  isRoundCompleteAfterNextMessage,
  determineNextRound,
  iterateProgress,
} from '@/lib/chat/services/progress'
import {
  createTestRound,
  createTestAgent,
  createTestChatState,
  resetIdCounter,
} from '@/__tests__/factories'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/chat/modalities/ModalityRegistry', () => ({
  getModality: jest.fn(() => ({
    isRoundComplete: jest.fn(() => false),
    getAgentIdsForDeterminingNextAgent: jest.fn(() => []),
  })),
}))

jest.mock('@/lib/chat/services/dialogue', () => ({
  DialogueService: {
    iterateDialogueProgress: jest.fn((chatState: any) => chatState),
    shouldCountAsSenderCompletion: jest.fn(() => false),
    setDialogueProgress: jest.fn(async (chatState: any) => chatState),
    initializeDialogueProgress: jest.fn(() => ({ senders: {}, mode: 'pending' })),
  },
}))

jest.mock('@/lib/chat/services/messageSender', () => ({
  MessageSenderService: {
    clearModeratorMessage: jest.fn(),
    resetMessageSenders: jest.fn((progress: any) => {
      if (progress.active?.senders) {
        progress.active.senders.allowed = []
        progress.active.senders.determined = false
      }
    }),
    initializeMessageSenders: jest.fn(() => ({ allowed: [], determined: false })),
    setMessageSenderProgress: jest.fn(async (chatState: any) => chatState),
  },
}))

// Import mocked modules for assertions
const { getModality } = jest.requireMock('@/lib/chat/modalities/ModalityRegistry')
const { DialogueService } = jest.requireMock('@/lib/chat/services/dialogue')
const { MessageSenderService } = jest.requireMock('@/lib/chat/services/messageSender')

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetIdCounter()
  jest.clearAllMocks()
})

// ===========================================================================
// createInitialProgress
// ===========================================================================

describe('createInitialProgress', () => {
  it('creates progress with default "user" initial step', () => {
    const progress = createInitialProgress('round-1')

    expect(progress.messageCount).toBe(0)
    expect(progress.messageAuthors).toEqual([])
    expect(progress.active.step).toBe('user')
    expect(progress.active.agent).toEqual({ id: '', mode: 'participant' })
    expect(progress.active.round).toEqual({ id: 'round-1', isComplete: false })
    expect(progress.next.step).toBe('api')
    expect(progress.next.round).toEqual({ id: 'round-1' })
  })

  it('creates progress with "api" initial step when specified', () => {
    const progress = createInitialProgress('round-2', 'api')

    expect(progress.active.step).toBe('api')
    expect(progress.next.step).toBe('user')
  })

  it('creates progress with "user" initial step when explicitly specified', () => {
    const progress = createInitialProgress('round-3', 'user')

    expect(progress.active.step).toBe('user')
    expect(progress.next.step).toBe('api')
  })

  it('uses the provided roundId for both active and next', () => {
    const progress = createInitialProgress('my-custom-round')

    expect(progress.active.round.id).toBe('my-custom-round')
    expect(progress.next.round.id).toBe('my-custom-round')
  })

  it('has no dialogue state', () => {
    const progress = createInitialProgress('round-1')
    expect(progress.dialogue).toBeUndefined()
  })

  it('has no senders state', () => {
    const progress = createInitialProgress('round-1')
    expect(progress.active.senders).toBeUndefined()
  })

  it('has no next agent', () => {
    const progress = createInitialProgress('round-1')
    expect(progress.next.agent).toBeUndefined()
  })
})

// ===========================================================================
// normalizeProgress
// ===========================================================================

describe('normalizeProgress', () => {
  it('fills in all defaults when given an empty object', () => {
    const normalized = normalizeProgress({})

    expect(normalized.messageCount).toBe(0)
    expect(normalized.messageAuthors).toEqual([])
    expect(normalized.active.step).toBe('user')
    expect(normalized.active.agent.id).toBe('')
    expect(normalized.active.agent.mode).toBe('participant')
    expect(normalized.active.round.id).toBe('')
    expect(normalized.active.round.isComplete).toBe(false)
    expect(normalized.active.round.status).toBe('active')
    expect(normalized.next.step).toBe('api')
    expect(normalized.next.round.id).toBe('')
    expect(normalized.next.round.status).toBe('active')
  })

  it('preserves existing messageCount', () => {
    const normalized = normalizeProgress({ messageCount: 5 })
    expect(normalized.messageCount).toBe(5)
  })

  it('preserves existing messageAuthors', () => {
    const authors = ['agent-1', 'agent-2']
    const normalized = normalizeProgress({ messageAuthors: authors })
    expect(normalized.messageAuthors).toEqual(authors)
  })

  it('preserves active step and round id', () => {
    const normalized = normalizeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-x', mode: 'moderator' },
        round: { id: 'round-42', isComplete: true },
      },
      next: {
        step: 'user',
        round: { id: 'round-43' },
      },
    })

    expect(normalized.active.step).toBe('api')
    expect(normalized.active.agent.id).toBe('agent-x')
    expect(normalized.active.agent.mode).toBe('moderator')
    expect(normalized.active.round.id).toBe('round-42')
    expect(normalized.active.round.isComplete).toBe(true)
    expect(normalized.next.step).toBe('user')
    expect(normalized.next.round.id).toBe('round-43')
  })

  it('sets agent mode to "participant" if not present', () => {
    const normalized = normalizeProgress({
      active: {
        step: 'user',
        agent: { id: 'agent-1' } as any,
        round: { id: 'r1', isComplete: false },
      },
      next: { step: 'api', round: { id: 'r1' } },
    })

    expect(normalized.active.agent.mode).toBe('participant')
  })

  it('preserves dialogue state if it exists', () => {
    const dialogueState = {
      senders: {
        'agent-1': {
          mode: 'dialogue' as const,
          receivers: {
            'agent-2': { mode: 'dialogue' as const, messages: 3 },
          },
        },
      },
      mode: 'dialogue' as const,
      sender: 'agent-1',
      receiver: 'agent-2',
    }

    const normalized = normalizeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'r1', isComplete: false },
      },
      next: { step: 'user', round: { id: 'r1' } },
      dialogue: dialogueState,
    })

    expect((normalized as any).dialogue).toEqual(dialogueState)
  })

  it('does not add dialogue when not present', () => {
    const normalized = normalizeProgress({
      active: {
        step: 'user',
        agent: { id: '', mode: 'participant' },
        round: { id: 'r1', isComplete: false },
      },
      next: { step: 'api', round: { id: 'r1' } },
    })

    expect((normalized as any).dialogue).toBeUndefined()
  })

  it('preserves senders state from active', () => {
    const senders = { allowed: ['agent-1', 'agent-2'], determined: true }
    const normalized = normalizeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'r1', isComplete: false },
        senders,
      },
      next: { step: 'user', round: { id: 'r1' } },
    })

    expect(normalized.active.senders).toEqual(senders)
  })

  it('preserves next agent when provided', () => {
    const normalized = normalizeProgress({
      active: {
        step: 'user',
        agent: { id: '', mode: 'participant' },
        round: { id: 'r1', isComplete: false },
      },
      next: {
        step: 'api',
        agent: { id: 'agent-2', mode: 'moderator' },
        round: { id: 'r1' },
      },
    })

    expect(normalized.next.agent).toBeDefined()
    expect(normalized.next.agent!.id).toBe('agent-2')
    expect(normalized.next.agent!.mode).toBe('moderator')
  })

  it('sets next.round.status to "active" if not present', () => {
    const normalized = normalizeProgress({
      next: { step: 'api', round: { id: 'r1' } },
    })

    expect(normalized.next.round.status).toBe('active')
  })
})

// ===========================================================================
// activateNextProgress
// ===========================================================================

describe('activateNextProgress', () => {
  it('returns progress unchanged if next.round is missing', () => {
    const progress = { next: {} } as any
    const result = activateNextProgress(progress)
    expect(result).toBe(progress)
  })

  it('moves next to active for same-round transition', () => {
    const progress: ChatProgress = {
      messageCount: 3,
      messageAuthors: ['a1', 'a2', 'a1'],
      active: {
        step: 'user',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
        senders: { allowed: ['a1', 'a2'], determined: true },
      },
      next: {
        step: 'api',
        agent: { id: 'agent-2', mode: 'participant' },
        round: { id: 'round-1', status: 'active' },
      },
    }

    const result = activateNextProgress(progress)

    expect(result.active.step).toBe('api')
    expect(result.active.agent).toEqual({ id: 'agent-2', mode: 'participant' })
    expect(result.active.round.id).toBe('round-1')
    expect(result.active.round.isComplete).toBe(false)
    expect(result.active.round.status).toBe('active')
    // Senders preserved within same round
    expect(result.active.senders).toEqual({ allowed: ['a1', 'a2'], determined: true })
    // Next is reset
    expect(result.next).toEqual({ step: 'api', round: { id: '' } })
  })

  it('handles round transition: clears senders and dialogue', () => {
    const progress: ChatProgress = {
      messageCount: 5,
      messageAuthors: ['a1', 'a2'],
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'closed' },
        senders: { allowed: ['a1', 'a2'], determined: true },
      },
      next: {
        step: 'api',
        agent: { id: 'agent-3', mode: 'moderator' },
        round: { id: 'round-2', status: 'active' },
      },
      dialogue: {
        senders: {},
        mode: 'complete',
      },
    }

    const result = activateNextProgress(progress)

    // Active becomes next
    expect(result.active.step).toBe('api')
    expect(result.active.agent).toEqual({ id: 'agent-3', mode: 'moderator' })
    expect(result.active.round.id).toBe('round-2')
    expect(result.active.round.isComplete).toBe(false)
    // Senders cleared on round transition
    expect(result.active.senders).toBeUndefined()
    // Dialogue cleared on round transition
    expect(result.dialogue).toBeUndefined()
    // MessageSenderService.resetMessageSenders called
    expect(MessageSenderService.resetMessageSenders).toHaveBeenCalledWith(result)
  })

  it('does not clear dialogue for same-round transition', () => {
    const dialogueState = {
      senders: {
        'agent-1': {
          mode: 'dialogue' as const,
          receivers: {
            'agent-2': { mode: 'dialogue' as const, messages: 2 },
          },
        },
      },
      mode: 'dialogue' as const,
      sender: 'agent-1',
      receiver: 'agent-2',
    }

    const progress: ChatProgress = {
      messageCount: 2,
      messageAuthors: ['a1'],
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: false, status: 'active' },
      },
      next: {
        step: 'api',
        agent: { id: 'agent-2', mode: 'participant' },
        round: { id: 'round-1', status: 'active' },
      },
      dialogue: dialogueState,
    }

    const result = activateNextProgress(progress)

    expect(result.dialogue).toEqual(dialogueState)
  })

  it('does not call resetMessageSenders for same-round transition', () => {
    const progress: ChatProgress = {
      messageCount: 1,
      messageAuthors: ['a1'],
      active: {
        step: 'user',
        agent: { id: 'a1', mode: 'participant' },
        round: { id: 'round-1', isComplete: false },
      },
      next: {
        step: 'api',
        round: { id: 'round-1' },
      },
    }

    activateNextProgress(progress)
    expect(MessageSenderService.resetMessageSenders).not.toHaveBeenCalled()
  })

  it('resets next to defaults after activation', () => {
    const progress: ChatProgress = {
      messageCount: 0,
      messageAuthors: [],
      active: {
        step: 'user',
        agent: { id: '', mode: 'participant' },
        round: { id: 'round-1', isComplete: false },
      },
      next: {
        step: 'api',
        agent: { id: 'agent-5', mode: 'moderator' },
        round: { id: 'round-1', status: 'active' },
      },
    }

    const result = activateNextProgress(progress)

    expect(result.next).toEqual({ step: 'api', round: { id: '' } })
  })

  it('preserves session for same-round transition from active', () => {
    const progress: ChatProgress = {
      messageCount: 1,
      messageAuthors: ['a1'],
      active: {
        step: 'user',
        agent: { id: 'a1', mode: 'participant' },
        round: { id: 'round-1', isComplete: false },
        session: 'session-abc',
      } as any,
      next: {
        step: 'api',
        round: { id: 'round-1' },
      },
    }

    const result = activateNextProgress(progress)
    expect((result.active as any).session).toBe('session-abc')
  })

  it('uses next.session for round transition, not active.session', () => {
    const progress: ChatProgress = {
      messageCount: 3,
      messageAuthors: ['a1'],
      active: {
        step: 'api',
        agent: { id: 'a1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'closed' },
        session: 'session-old',
      } as any,
      next: {
        step: 'api',
        round: { id: 'round-2' },
        session: 'session-new',
      } as any,
    }

    const result = activateNextProgress(progress)
    expect((result.active as any).session).toBe('session-new')
  })

  it('does not set session if next has no session on round transition', () => {
    const progress: ChatProgress = {
      messageCount: 3,
      messageAuthors: ['a1'],
      active: {
        step: 'api',
        agent: { id: 'a1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'closed' },
        session: 'session-old',
      } as any,
      next: {
        step: 'api',
        round: { id: 'round-2' },
      },
    }

    const result = activateNextProgress(progress)
    expect((result.active as any).session).toBeUndefined()
  })

  it('defaults agent to { id: "", mode: "participant" } when next has no agent', () => {
    const progress: ChatProgress = {
      messageCount: 0,
      messageAuthors: [],
      active: {
        step: 'user',
        agent: { id: 'a1', mode: 'moderator' },
        round: { id: 'round-1', isComplete: false },
      },
      next: {
        step: 'api',
        round: { id: 'round-1' },
      },
    }

    const result = activateNextProgress(progress)
    expect(result.active.agent).toEqual({ id: '', mode: 'participant' })
  })
})

// ===========================================================================
// isRoundCompleteAfterNextMessage
// ===========================================================================

describe('isRoundCompleteAfterNextMessage', () => {
  it('returns false when agent mode is moderator', () => {
    const progress: ChatProgress = {
      messageCount: 10,
      messageAuthors: ['a1', 'a2', 'a3'],
      active: {
        step: 'api',
        agent: { id: 'mod-1', mode: 'moderator' },
        round: { id: 'r1', isComplete: false },
      },
      next: { step: 'api', round: { id: 'r1' } },
    }
    const round = createTestRound({ id: 'r1', lengthType: 'messages' as any, lengthNumber: 3 })

    expect(isRoundCompleteAfterNextMessage(progress, round)).toBe(false)
  })

  describe('lengthType = "moderator"', () => {
    it('returns true when messageAuthors.length + 1 >= lengthNumber', () => {
      const progress: ChatProgress = {
        messageCount: 9,
        messageAuthors: Array(9).fill('agent-1'),
        active: {
          step: 'api',
          agent: { id: 'agent-1', mode: 'participant' },
          round: { id: 'r1', isComplete: false },
        },
        next: { step: 'api', round: { id: 'r1' } },
      }
      const round = createTestRound({ id: 'r1', lengthType: 'moderator' as any, lengthNumber: 10 })

      expect(isRoundCompleteAfterNextMessage(progress, round)).toBe(true)
    })

    it('returns false when messageAuthors.length + 1 < lengthNumber', () => {
      const progress: ChatProgress = {
        messageCount: 5,
        messageAuthors: Array(5).fill('agent-1'),
        active: {
          step: 'api',
          agent: { id: 'agent-1', mode: 'participant' },
          round: { id: 'r1', isComplete: false },
        },
        next: { step: 'api', round: { id: 'r1' } },
      }
      const round = createTestRound({ id: 'r1', lengthType: 'moderator' as any, lengthNumber: 10 })

      expect(isRoundCompleteAfterNextMessage(progress, round)).toBe(false)
    })

    it('uses default max of 10 when lengthNumber is null', () => {
      const progress: ChatProgress = {
        messageCount: 9,
        messageAuthors: Array(9).fill('agent-1'),
        active: {
          step: 'api',
          agent: { id: 'agent-1', mode: 'participant' },
          round: { id: 'r1', isComplete: false },
        },
        next: { step: 'api', round: { id: 'r1' } },
      }
      const round = createTestRound({ id: 'r1', lengthType: 'moderator' as any, lengthNumber: null })

      // Default is 10, 9 + 1 = 10 >= 10
      expect(isRoundCompleteAfterNextMessage(progress, round)).toBe(true)
    })

    it('returns false when below default max and lengthNumber is null', () => {
      const progress: ChatProgress = {
        messageCount: 3,
        messageAuthors: Array(3).fill('agent-1'),
        active: {
          step: 'api',
          agent: { id: 'agent-1', mode: 'participant' },
          round: { id: 'r1', isComplete: false },
        },
        next: { step: 'api', round: { id: 'r1' } },
      }
      const round = createTestRound({ id: 'r1', lengthType: 'moderator' as any, lengthNumber: null })

      expect(isRoundCompleteAfterNextMessage(progress, round)).toBe(false)
    })

    it('returns true when exactly at limit (lengthNumber = 1, zero messages so far)', () => {
      const progress: ChatProgress = {
        messageCount: 0,
        messageAuthors: [],
        active: {
          step: 'api',
          agent: { id: 'agent-1', mode: 'participant' },
          round: { id: 'r1', isComplete: false },
        },
        next: { step: 'api', round: { id: 'r1' } },
      }
      const round = createTestRound({ id: 'r1', lengthType: 'moderator' as any, lengthNumber: 1 })

      // 0 + 1 >= 1 => true
      expect(isRoundCompleteAfterNextMessage(progress, round)).toBe(true)
    })
  })

  describe('non-moderator lengthType', () => {
    it('delegates to RoundUtils.isRoundComplete via getModality', () => {
      const mockIsRoundComplete = jest.fn(() => true)
      ;(getModality as jest.Mock).mockReturnValue({
        isRoundComplete: mockIsRoundComplete,
      })

      const progress: ChatProgress = {
        messageCount: 4,
        messageAuthors: ['a1', 'a2', 'a1', 'a2'],
        active: {
          step: 'api',
          agent: { id: 'agent-1', mode: 'participant' },
          round: { id: 'r1', isComplete: false },
        },
        next: { step: 'api', round: { id: 'r1' } },
      }
      const round = createTestRound({ id: 'r1', lengthType: 'messages' as any, lengthNumber: 5 })

      const result = isRoundCompleteAfterNextMessage(progress, round)

      expect(getModality).toHaveBeenCalledWith(round.type)
      // RoundUtils calls modality.isRoundComplete(round, messageAuthors.length + 1, chatState)
      expect(mockIsRoundComplete).toHaveBeenCalledWith(
        round,
        5, // messageAuthors.length + 1 = 4 + 1
        expect.objectContaining({ activeRound: round, progress })
      )
      expect(result).toBe(true)
    })

    it('returns false when modality says round is not complete', () => {
      ;(getModality as jest.Mock).mockReturnValue({
        isRoundComplete: jest.fn(() => false),
      })

      const progress: ChatProgress = {
        messageCount: 1,
        messageAuthors: ['a1'],
        active: {
          step: 'api',
          agent: { id: 'agent-1', mode: 'participant' },
          round: { id: 'r1', isComplete: false },
        },
        next: { step: 'api', round: { id: 'r1' } },
      }
      const round = createTestRound({ id: 'r1', lengthType: 'messages' as any, lengthNumber: 10 })

      expect(isRoundCompleteAfterNextMessage(progress, round)).toBe(false)
    })
  })
})

// ===========================================================================
// determineNextRound
// ===========================================================================

describe('determineNextRound', () => {
  it('returns current round when rounds array is empty', () => {
    const round = createTestRound({ id: 'r1' })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [],
    })

    const result = determineNextRound(chatState)
    expect(result.id).toBe('r1')
  })

  it('returns current round when round is not found in rounds array', () => {
    const round = createTestRound({ id: 'r-missing' })
    const r1 = createTestRound({ id: 'r1' })
    const r2 = createTestRound({ id: 'r2' })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [r1, r2],
    })

    const result = determineNextRound(chatState)
    expect(result.id).toBe('r-missing')
  })

  it('returns current round if it is the only round', () => {
    const round = createTestRound({ id: 'r1' })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
    })

    const result = determineNextRound(chatState)
    expect(result.id).toBe('r1')
  })

  it('returns next round in sequence', () => {
    const r1 = createTestRound({ id: 'r1' })
    const r2 = createTestRound({ id: 'r2' })
    const r3 = createTestRound({ id: 'r3' })
    const chatState = createTestChatState({
      activeRound: r1,
      rounds: [r1, r2, r3],
    })

    const result = determineNextRound(chatState)
    expect(result.id).toBe('r2')
  })

  it('returns round after current in the middle of the array', () => {
    const r1 = createTestRound({ id: 'r1' })
    const r2 = createTestRound({ id: 'r2' })
    const r3 = createTestRound({ id: 'r3' })
    const chatState = createTestChatState({
      activeRound: r2,
      rounds: [r1, r2, r3],
    })

    const result = determineNextRound(chatState)
    expect(result.id).toBe('r3')
  })

  it('cycles back to first round when at end', () => {
    const r1 = createTestRound({ id: 'r1' })
    const r2 = createTestRound({ id: 'r2' })
    const r3 = createTestRound({ id: 'r3' })
    const chatState = createTestChatState({
      activeRound: r3,
      rounds: [r1, r2, r3],
    })

    const result = determineNextRound(chatState)
    expect(result.id).toBe('r1')
  })

  it('handles two rounds: returns the other round', () => {
    const r1 = createTestRound({ id: 'r1' })
    const r2 = createTestRound({ id: 'r2' })
    const chatState = createTestChatState({
      activeRound: r1,
      rounds: [r1, r2],
    })

    const result = determineNextRound(chatState)
    expect(result.id).toBe('r2')
  })

  it('returns current round when activeRound is undefined', () => {
    const chatState = createTestChatState()
    ;(chatState as any).activeRound = undefined
    ;(chatState as any).rounds = []

    const result = determineNextRound(chatState)
    expect(result).toBeUndefined()
  })
})

// ===========================================================================
// iterateProgress
// ===========================================================================

describe('iterateProgress', () => {
  // Helper to build a base progress for iterateProgress tests
  function makeProgress(overrides: Partial<ChatProgress> = {}): ChatProgress {
    return {
      messageCount: 0,
      messageAuthors: [],
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: false, status: 'active' },
        ...overrides.active,
      } as any,
      next: {
        step: 'user',
        agent: { id: '', mode: 'participant' as const },
        round: { id: 'round-1', status: 'active' },
        ...overrides.next,
      } as any,
      ...overrides,
    }
  }

  it('increments messageCount and pushes to messageAuthors for participant', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1' })
    const progress = makeProgress()
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Hello' })

    expect(result.messageCount).toBe(1)
    expect(result.messageAuthors).toContain('agent-1')
  })

  it('does not increment messageCount for moderator', () => {
    const agent = createTestAgent({ id: 'mod-1' })
    const round = createTestRound({ id: 'round-1', participantOrder: 'moderator' as any, moderatorAgentId: 'mod-1' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'mod-1', mode: 'moderator' },
        round: { id: 'round-1', isComplete: false, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Selecting next agent' })

    expect(result.messageCount).toBe(0)
    expect(result.messageAuthors).toEqual([])
  })

  it('sets next.step to "api"', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1' })
    const progress = makeProgress()
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Hello' })

    expect(result.next.step).toBe('api')
  })

  it('sets active.round.status to "closed" when round is complete (non-conditional)', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'auto' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Last message' })

    expect(result.active.round.status).toBe('closed')
  })

  it('sets next.round.status to "transition" for conditional transition on first completion', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'conditional' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Conditional complete' })

    expect(result.next.round.status).toBe('transition')
    // Should NOT close the active round yet - waiting for moderator
    expect(result.active.round.status).toBe('active')
  })

  it('resets messageCount and messageAuthors on round transition (closed)', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'auto' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      messageCount: 5,
      messageAuthors: ['a1', 'a2', 'a1', 'a2', 'a1'],
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Done' })

    expect(result.messageCount).toBe(0)
    expect(result.messageAuthors).toEqual([])
  })

  it('sets next.round.id to the next round on auto transition', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'auto' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Done' })

    expect(result.next.round.id).toBe('round-2')
  })

  it('sets next.step to "user" on user transition type', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'user' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Done' })

    expect(result.next.step).toBe('user')
  })

  it('sets next.step to "api" on auto transition type', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'auto' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Done' })

    expect(result.next.step).toBe('api')
  })

  it('toggles moderator -> participant for moderator participantOrder', () => {
    const modAgent = createTestAgent({ id: 'mod-1' })
    const partAgent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({
      id: 'round-1',
      participantOrder: 'moderator' as any,
      moderatorAgentId: 'mod-1',
    })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'mod-1', mode: 'moderator' },
        round: { id: 'round-1', isComplete: false, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [modAgent, partAgent],
      activeAgent: modAgent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'I choose agent-1' })

    expect(result.next.agent!.mode).toBe('participant')
  })

  it('toggles participant -> moderator for moderator participantOrder', () => {
    const modAgent = createTestAgent({ id: 'mod-1' })
    const partAgent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({
      id: 'round-1',
      participantOrder: 'moderator' as any,
      moderatorAgentId: 'mod-1',
    })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: false, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [modAgent, partAgent],
      activeAgent: partAgent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'My response' })

    expect(result.next.agent!.mode).toBe('moderator')
    expect(result.next.agent!.id).toBe('')
  })

  it('calls DialogueService.iterateDialogueProgress for dialogue rounds', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', type: 'dialogue' as any })
    const progress = makeProgress()
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    iterateProgress(chatState, { text: 'Dialogue message' })

    expect(DialogueService.iterateDialogueProgress).toHaveBeenCalledWith(
      chatState,
      'Dialogue message'
    )
  })

  it('calls MessageSenderService.clearModeratorMessage', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1' })
    const progress = makeProgress()
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    iterateProgress(chatState, { text: 'Hi' })

    expect(MessageSenderService.clearModeratorMessage).toHaveBeenCalledWith(chatState)
  })

  it('resets next.agent.id on round completion', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'auto' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Done' })

    expect(result.next.agent!.id).toBe('')
  })

  it('calls MessageSenderService.resetMessageSenders on round completion', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'auto' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    iterateProgress(chatState, { text: 'Done' })

    expect(MessageSenderService.resetMessageSenders).toHaveBeenCalled()
  })

  it('sets next.agent.mode to moderator when next round uses moderator participantOrder', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'auto' as any })
    const r2 = createTestRound({
      id: 'round-2',
      participantOrder: 'moderator' as any,
      moderatorAgentId: 'mod-1',
    })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Done' })

    expect(result.next.agent!.mode).toBe('moderator')
  })

  it('keeps current round when not complete', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1' })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: false, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Not done yet' })

    expect(result.next.round.id).toBe('round-1')
  })

  it('does not toggle moderator mode when round is complete', () => {
    const modAgent = createTestAgent({ id: 'mod-1' })
    const round = createTestRound({
      id: 'round-1',
      participantOrder: 'moderator' as any,
      moderatorAgentId: 'mod-1',
      transition: 'auto' as any,
    })
    const r2 = createTestRound({ id: 'round-2' })
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2],
      agents: [modAgent],
      activeAgent: modAgent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Final message' })

    // When complete, mode is set based on next round, not toggled
    // r2 does not have moderator participantOrder, so should be participant
    expect(result.next.agent!.mode).toBe('participant')
  })

  it('uses conditional round selection when transition is conditional and status is closed', () => {
    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', transition: 'conditional' as any })
    const r2 = createTestRound({ id: 'round-2' })
    const r3 = createTestRound({ id: 'round-3' })
    // Simulate moderator already chose round-3 via progress.next.round.id
    const progress = makeProgress({
      active: {
        step: 'api',
        agent: { id: 'agent-1', mode: 'participant' },
        round: { id: 'round-1', isComplete: true, status: 'closed' },
      },
      next: {
        step: 'api',
        agent: { id: '', mode: 'participant' as const },
        round: { id: 'round-3', status: 'active' },
      },
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round, r2, r3],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'After moderator decision' })

    // Should go to round-3 as chosen by moderator
    expect(result.next.round.id).toBe('round-3')
  })

  it('dialogue rounds: does not increment when shouldCountAsSenderCompletion returns false', () => {
    ;(DialogueService.shouldCountAsSenderCompletion as jest.Mock).mockReturnValue(false)

    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', type: 'dialogue' as any })
    const progress = makeProgress({
      messageCount: 2,
      messageAuthors: ['a1', 'a2'],
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Dialogue mid-message' })

    expect(result.messageCount).toBe(2)
    expect(result.messageAuthors).toEqual(['a1', 'a2'])
  })

  it('dialogue rounds: increments when shouldCountAsSenderCompletion returns true', () => {
    ;(DialogueService.shouldCountAsSenderCompletion as jest.Mock).mockReturnValue(true)

    const agent = createTestAgent({ id: 'agent-1' })
    const round = createTestRound({ id: 'round-1', type: 'dialogue' as any })
    const progress = makeProgress({
      messageCount: 2,
      messageAuthors: ['a1', 'a2'],
    })
    const chatState = createTestChatState({
      activeRound: round,
      rounds: [round],
      agents: [agent],
      activeAgent: agent,
      progress,
    })

    const result = iterateProgress(chatState, { text: 'Sender complete' })

    expect(result.messageCount).toBe(3)
    expect(result.messageAuthors).toContain('agent-1')
  })
})
