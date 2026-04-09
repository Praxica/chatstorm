import { getModality } from '@/lib/chat/modalities/ModalityRegistry'
import { ModalityRegistry } from '@/lib/chat/modalities/ModalityRegistry'
import { BaseModality } from '@/lib/chat/modalities/BaseModality'
import {
  createTestRound,
  createTestAgent,
  createTestChatState,
  resetIdCounter,
} from '../../factories'
import type { ChatProgress } from '@/lib/types/chat-progress'
import { createInitialProgress } from '@/lib/types/chat-progress'

beforeEach(() => resetIdCounter())

// ---------------------------------------------------------------------------
// Helper: build a ChatProgress with common defaults
// ---------------------------------------------------------------------------
function buildProgress(overrides: Partial<ChatProgress> = {}): ChatProgress {
  return {
    messageCount: 0,
    messageAuthors: [],
    active: {
      step: 'api',
      agent: { id: 'agent-1', mode: 'participant' },
      round: { id: 'round-1', isComplete: false },
      ...overrides.active,
    },
    next: {
      step: 'user',
      round: { id: 'round-1' },
      ...overrides.next,
    },
    ...overrides,
  } as ChatProgress
}

// ===========================================================================
// 1. ModalityRegistry
// ===========================================================================
describe('ModalityRegistry', () => {
  describe('getModality(type)', () => {
    it.each([
      'brainstorm',
      'debate',
      'dialogue',
      'explore',
      'critique',
      'review',
      'survey',
      'understand',
      'custom',
    ])('returns a modality instance for type "%s"', (type) => {
      const modality = getModality(type)
      expect(modality).toBeDefined()
      expect(modality.type).toBe(type)
    })

    it('returns the default BaseModality for an unknown type', () => {
      const modality = getModality('nonexistent-type')
      expect(modality).toBeDefined()
      // The default modality has type "default"
      expect(modality.type).toBe('default')
    })

    it('returns the same instance on subsequent calls (singleton registry)', () => {
      const first = getModality('brainstorm')
      const second = getModality('brainstorm')
      expect(first).toBe(second)
    })

    it('returns distinct instances for different types', () => {
      const brainstorm = getModality('brainstorm')
      const debate = getModality('debate')
      expect(brainstorm).not.toBe(debate)
      expect(brainstorm.type).toBe('brainstorm')
      expect(debate.type).toBe('debate')
    })

    it('ModalityRegistry.getInstance() is a singleton', () => {
      const a = ModalityRegistry.getInstance()
      const b = ModalityRegistry.getInstance()
      expect(a).toBe(b)
    })
  })
})

// ===========================================================================
// 2. BaseModality.isRoundComplete
// ===========================================================================
describe('BaseModality.isRoundComplete', () => {
  const modality = new BaseModality()

  describe('lengthType: "total"', () => {
    it('returns true when authorCount >= lengthNumber', () => {
      const round = createTestRound({
        lengthType: 'total' as any,
        lengthNumber: 5,
        participants: [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })],
      })
      expect(modality.isRoundComplete(round, 5)).toBe(true)
      expect(modality.isRoundComplete(round, 6)).toBe(true)
    })

    it('returns false when authorCount < lengthNumber', () => {
      const round = createTestRound({
        lengthType: 'total' as any,
        lengthNumber: 5,
        participants: [createTestAgent({ id: 'a1' })],
      })
      expect(modality.isRoundComplete(round, 4)).toBe(false)
      expect(modality.isRoundComplete(round, 0)).toBe(false)
    })

    it('treats null lengthNumber as 0 (JS coercion: authorCount >= null becomes authorCount >= 0)', () => {
      const round = createTestRound({
        lengthType: 'total' as any,
        lengthNumber: null,
        participants: [createTestAgent({ id: 'a1' })],
      })
      // In JS, null coerces to 0 in numeric comparisons: 10 >= null => 10 >= 0 => true
      expect(modality.isRoundComplete(round, 10)).toBe(true)
      expect(modality.isRoundComplete(round, 0)).toBe(true)
    })
  })

  describe('lengthType: "rounds"', () => {
    it('returns true when authorCount >= participants.length * lengthRounds', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({
        lengthType: 'rounds' as any,
        lengthRounds: 3,
        participants: agents,
      })
      // target = 2 participants * 3 rounds = 6
      expect(modality.isRoundComplete(round, 6)).toBe(true)
      expect(modality.isRoundComplete(round, 7)).toBe(true)
    })

    it('returns false when authorCount < participants.length * lengthRounds', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({
        lengthType: 'rounds' as any,
        lengthRounds: 3,
        participants: agents,
      })
      expect(modality.isRoundComplete(round, 5)).toBe(false)
    })

    it('handles single participant', () => {
      const round = createTestRound({
        lengthType: 'rounds' as any,
        lengthRounds: 2,
        participants: [createTestAgent({ id: 'a1' })],
      })
      // target = 1 * 2 = 2
      expect(modality.isRoundComplete(round, 1)).toBe(false)
      expect(modality.isRoundComplete(round, 2)).toBe(true)
    })

    it('uses effectiveParticipantCount from senders.allowed for non-dialogue moderator_decides', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
        createTestAgent({ id: 'a3' }),
      ]
      const round = createTestRound({
        type: 'brainstorm' as any,
        lengthType: 'rounds' as any,
        lengthRounds: 2,
        messageSenderMode: 'moderator_decides' as any,
        participants: agents,
      })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          active: {
            step: 'api',
            agent: { id: 'a1', mode: 'participant' },
            round: { id: round.id, isComplete: false },
            senders: { allowed: ['a1', 'a2'], determined: true },
          },
        }),
      })

      // effectiveParticipantCount = 2 (senders.allowed.length)
      // target = 2 * 2 = 4
      expect(modality.isRoundComplete(round, 3, chatState)).toBe(false)
      expect(modality.isRoundComplete(round, 4, chatState)).toBe(true)
    })

    it('falls back to participants.length when senders not determined', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
        createTestAgent({ id: 'a3' }),
      ]
      const round = createTestRound({
        type: 'brainstorm' as any,
        lengthType: 'rounds' as any,
        lengthRounds: 2,
        messageSenderMode: 'moderator_decides' as any,
        participants: agents,
      })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          active: {
            step: 'api',
            agent: { id: 'a1', mode: 'participant' },
            round: { id: round.id, isComplete: false },
            senders: { allowed: [], determined: false },
          },
        }),
      })

      // effectiveParticipantCount = 3 (participants.length, senders not determined)
      // target = 3 * 2 = 6
      expect(modality.isRoundComplete(round, 5, chatState)).toBe(false)
      expect(modality.isRoundComplete(round, 6, chatState)).toBe(true)
    })

    it('does NOT use senders for dialogue rounds (only non-dialogue)', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
        createTestAgent({ id: 'a3' }),
      ]
      const round = createTestRound({
        type: 'dialogue' as any,
        lengthType: 'rounds' as any,
        lengthRounds: 2,
        messageSenderMode: 'moderator_decides' as any,
        participants: agents,
      })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          active: {
            step: 'api',
            agent: { id: 'a1', mode: 'participant' },
            round: { id: round.id, isComplete: false },
            senders: { allowed: ['a1'], determined: true },
          },
        }),
      })

      // Since type is dialogue, effectiveParticipantCount stays at participants.length = 3
      // target = 3 * 2 = 6
      expect(modality.isRoundComplete(round, 5, chatState)).toBe(false)
      expect(modality.isRoundComplete(round, 6, chatState)).toBe(true)
    })

    it('returns false when authorCount is 0', () => {
      const round = createTestRound({
        lengthType: 'rounds' as any,
        lengthRounds: 1,
        participants: [createTestAgent({ id: 'a1' })],
      })
      // authorCount of 0 is falsy, so the inner `if (authorCount && ...)` check fails
      expect(modality.isRoundComplete(round, 0)).toBe(false)
    })

    it('handles 0 participants gracefully (target is 0, but authorCount 0 is falsy)', () => {
      const round = createTestRound({
        lengthType: 'rounds' as any,
        lengthRounds: 2,
        participants: [],
      })
      // target = 0 * 2 = 0, authorCount 0 is falsy
      expect(modality.isRoundComplete(round, 0)).toBe(false)
      // authorCount 1 >= 0, so truthy and >= target
      expect(modality.isRoundComplete(round, 1)).toBe(true)
    })

    it('treats null lengthRounds as 0 (JS coercion: 1 * null = 0, so any truthy authorCount completes)', () => {
      const round = createTestRound({
        lengthType: 'rounds' as any,
        lengthRounds: null,
        participants: [createTestAgent({ id: 'a1' })],
      })
      // In JS, 1 * null = 0, so targetMessageCount = 0
      // authorCount 10 is truthy and >= 0
      expect(modality.isRoundComplete(round, 10)).toBe(true)
      // authorCount 0 is falsy, so the `if (authorCount && ...)` check fails
      expect(modality.isRoundComplete(round, 0)).toBe(false)
    })
  })

  describe('lengthType: "moderator"', () => {
    it('always returns false (moderator decides externally)', () => {
      const round = createTestRound({
        lengthType: 'moderator' as any,
        participants: [createTestAgent({ id: 'a1' })],
      })
      expect(modality.isRoundComplete(round, 0)).toBe(false)
      expect(modality.isRoundComplete(round, 100)).toBe(false)
    })
  })

  describe('no chatState provided', () => {
    it('falls back to participants.length for rounds-based calculation', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({
        lengthType: 'rounds' as any,
        lengthRounds: 2,
        participants: agents,
      })
      // No chatState, so no senders override -> target = 2 * 2 = 4
      expect(modality.isRoundComplete(round, 3)).toBe(false)
      expect(modality.isRoundComplete(round, 4)).toBe(true)
    })
  })
})

// ===========================================================================
// 3. BaseModality.getRoundModerators
// ===========================================================================
describe('BaseModality.getRoundModerators', () => {
  const modality = new BaseModality()

  it('collects moderatorAgentId', () => {
    const round = createTestRound({ moderatorAgentId: 'mod-1' })
    expect(modality.getRoundModerators(round)).toContain('mod-1')
  })

  it('collects lengthModerator', () => {
    const round = createTestRound({ lengthModerator: 'lm-1' })
    expect(modality.getRoundModerators(round)).toContain('lm-1')
  })

  it('collects messageSenderModerator for non-dialogue rounds', () => {
    const round = createTestRound({
      type: 'brainstorm' as any,
      messageSenderModerator: 'msm-1',
    })
    expect(modality.getRoundModerators(round)).toContain('msm-1')
  })

  it('does NOT collect messageSenderModerator for dialogue rounds', () => {
    const round = createTestRound({
      type: 'dialogue' as any,
      messageSenderModerator: 'msm-1',
    })
    expect(modality.getRoundModerators(round)).not.toContain('msm-1')
  })

  it('collects transitionModerator', () => {
    const round = createTestRound({ transitionModerator: 'tm-1' })
    expect(modality.getRoundModerators(round)).toContain('tm-1')
  })

  it('collects all moderator fields when present', () => {
    const round = createTestRound({
      type: 'brainstorm' as any,
      moderatorAgentId: 'mod-1',
      lengthModerator: 'lm-1',
      messageSenderModerator: 'msm-1',
      transitionModerator: 'tm-1',
    })
    const mods = modality.getRoundModerators(round)
    expect(mods).toEqual(['mod-1', 'lm-1', 'msm-1', 'tm-1'])
  })

  it('filters out null/undefined moderator fields', () => {
    const round = createTestRound({
      moderatorAgentId: null,
      lengthModerator: null,
      messageSenderModerator: null,
      transitionModerator: null,
    })
    expect(modality.getRoundModerators(round)).toEqual([])
  })

  it('returns empty array when no moderator is configured', () => {
    const round = createTestRound()
    expect(modality.getRoundModerators(round)).toEqual([])
  })
})

// ===========================================================================
// 4. BaseModality.getAgentIdsForDeterminingNextAgent
// ===========================================================================
describe('BaseModality.getAgentIdsForDeterminingNextAgent', () => {
  const modality = new BaseModality()

  it('returns all participant IDs by default', () => {
    const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
    const round = createTestRound({ participants: agents, type: 'brainstorm' as any })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    expect(modality.getAgentIdsForDeterminingNextAgent(chatState)).toEqual(['a1', 'a2'])
  })

  it('filters by senders.allowed when determined for non-dialogue rounds', () => {
    const agents = [
      createTestAgent({ id: 'a1' }),
      createTestAgent({ id: 'a2' }),
      createTestAgent({ id: 'a3' }),
    ]
    const round = createTestRound({
      participants: agents,
      type: 'brainstorm' as any,
      messageSenderMode: 'moderator_decides' as any,
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress({
        active: {
          step: 'api',
          agent: { id: 'a1', mode: 'participant' },
          round: { id: round.id, isComplete: false },
          senders: { allowed: ['a1', 'a3'], determined: true },
        },
      }),
    })

    const result = modality.getAgentIdsForDeterminingNextAgent(chatState)
    expect(result).toEqual(['a1', 'a3'])
    expect(result).not.toContain('a2')
  })

  it('returns all participants when senders not yet determined', () => {
    const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
    const round = createTestRound({
      participants: agents,
      type: 'brainstorm' as any,
      messageSenderMode: 'moderator_decides' as any,
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress({
        active: {
          step: 'api',
          agent: { id: 'a1', mode: 'participant' },
          round: { id: round.id, isComplete: false },
          senders: { allowed: [], determined: false },
        },
      }),
    })

    expect(modality.getAgentIdsForDeterminingNextAgent(chatState)).toEqual(['a1', 'a2'])
  })

  it('does NOT filter senders for dialogue type (handled by DialogueModality)', () => {
    const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
    const round = createTestRound({
      participants: agents,
      type: 'dialogue' as any,
      messageSenderMode: 'moderator_decides' as any,
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress({
        active: {
          step: 'api',
          agent: { id: 'a1', mode: 'participant' },
          round: { id: round.id, isComplete: false },
          senders: { allowed: ['a1'], determined: true },
        },
      }),
    })

    // Dialogue rounds skip sender filtering in base modality
    expect(modality.getAgentIdsForDeterminingNextAgent(chatState)).toEqual(['a1', 'a2'])
  })

  it('returns empty array when no participants', () => {
    const round = createTestRound({ participants: [], type: 'brainstorm' as any })
    const chatState = createTestChatState({
      agents: [],
      activeRound: round,
      progress: buildProgress(),
    })

    expect(modality.getAgentIdsForDeterminingNextAgent(chatState)).toEqual([])
  })
})

// ===========================================================================
// 5. BaseModality.getAllModeratorIds / getAllNonModeratorIds
// ===========================================================================
describe('BaseModality.getAllModeratorIds & getAllNonModeratorIds', () => {
  const modality = new BaseModality()

  it('getAllModeratorIds delegates to getRoundModerators', () => {
    const agents = [
      createTestAgent({ id: 'mod-1' }),
      createTestAgent({ id: 'a2' }),
      createTestAgent({ id: 'a3' }),
    ]
    const round = createTestRound({
      type: 'brainstorm' as any,
      participants: agents,
      moderatorAgentId: 'mod-1',
      lengthModerator: 'a2',
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    expect(modality.getAllModeratorIds(chatState)).toEqual(['mod-1', 'a2'])
  })

  it('getAllNonModeratorIds returns participants excluding moderators', () => {
    const agents = [
      createTestAgent({ id: 'mod-1' }),
      createTestAgent({ id: 'a2' }),
      createTestAgent({ id: 'a3' }),
    ]
    const round = createTestRound({
      type: 'brainstorm' as any,
      participants: agents,
      moderatorAgentId: 'mod-1',
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    const nonMods = modality.getAllNonModeratorIds(chatState)
    expect(nonMods).toEqual(['a2', 'a3'])
    expect(nonMods).not.toContain('mod-1')
  })

  it('getAllNonModeratorIds returns all participants when no moderators configured', () => {
    const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
    const round = createTestRound({
      type: 'brainstorm' as any,
      participants: agents,
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    expect(modality.getAllNonModeratorIds(chatState)).toEqual(['a1', 'a2'])
  })

  it('correctly partitions when an agent has multiple moderator roles', () => {
    const agents = [
      createTestAgent({ id: 'mod-1' }),
      createTestAgent({ id: 'a2' }),
    ]
    const round = createTestRound({
      type: 'brainstorm' as any,
      participants: agents,
      moderatorAgentId: 'mod-1',
      lengthModerator: 'mod-1',
      transitionModerator: 'mod-1',
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    // mod-1 appears multiple times in moderators, but non-moderator list
    // should only exclude it once
    expect(modality.getAllModeratorIds(chatState)).toEqual(['mod-1', 'mod-1', 'mod-1'])
    expect(modality.getAllNonModeratorIds(chatState)).toEqual(['a2'])
  })
})

// ===========================================================================
// 6. BaseModality.getAgentIdsForModeratorSelection
// ===========================================================================
describe('BaseModality.getAgentIdsForModeratorSelection', () => {
  const modality = new BaseModality()

  it('returns participants excluding the moderatorAgentId', () => {
    const agents = [
      createTestAgent({ id: 'mod-1' }),
      createTestAgent({ id: 'a2' }),
      createTestAgent({ id: 'a3' }),
    ]
    const round = createTestRound({
      participants: agents,
      moderatorAgentId: 'mod-1',
    })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    const ids = modality.getAgentIdsForModeratorSelection(chatState)
    expect(ids).toEqual(['a2', 'a3'])
  })

  it('returns all participants when no moderatorAgentId is set', () => {
    const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
    const round = createTestRound({ participants: agents, moderatorAgentId: null })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    expect(modality.getAgentIdsForModeratorSelection(chatState)).toEqual(['a1', 'a2'])
  })
})

// ===========================================================================
// 7. BaseModality.getAgentIdsForModeratorCompletion
// ===========================================================================
describe('BaseModality.getAgentIdsForModeratorCompletion', () => {
  const modality = new BaseModality()

  it('returns all participant IDs', () => {
    const agents = [
      createTestAgent({ id: 'a1' }),
      createTestAgent({ id: 'a2' }),
      createTestAgent({ id: 'a3' }),
    ]
    const round = createTestRound({ participants: agents })
    const chatState = createTestChatState({
      agents,
      activeRound: round,
      progress: buildProgress(),
    })

    expect(modality.getAgentIdsForModeratorCompletion(chatState)).toEqual(['a1', 'a2', 'a3'])
  })
})

// ===========================================================================
// 8. Concrete modality: DialogueModality
// ===========================================================================
describe('DialogueModality', () => {
  const modality = getModality('dialogue')

  describe('getRoundModerators', () => {
    it('includes base moderators plus dialogue-specific moderators', () => {
      const round = createTestRound({
        type: 'dialogue' as any,
        moderatorAgentId: 'mod-1',
        dialogueLengthModerator: 'dlm-1',
        dialogueSenderModerator: 'dsm-1',
        dialogueReceiverModerator: 'drm-1',
      })
      const mods = modality.getRoundModerators(round)
      expect(mods).toContain('mod-1')
      expect(mods).toContain('dlm-1')
      expect(mods).toContain('dsm-1')
      expect(mods).toContain('drm-1')
    })

    it('does NOT include null dialogue moderators', () => {
      const round = createTestRound({
        type: 'dialogue' as any,
        moderatorAgentId: 'mod-1',
        dialogueLengthModerator: null,
        dialogueSenderModerator: null,
        dialogueReceiverModerator: null,
      })
      const mods = modality.getRoundModerators(round)
      expect(mods).toEqual(['mod-1'])
    })

    it('does NOT include messageSenderModerator for dialogue rounds (base modality skips it)', () => {
      const round = createTestRound({
        type: 'dialogue' as any,
        messageSenderModerator: 'msm-1',
      })
      const mods = modality.getRoundModerators(round)
      expect(mods).not.toContain('msm-1')
    })
  })

  describe('getAgentIdsForDeterminingNextAgent', () => {
    it('returns all participants when no dialogue progress exists', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress(),
      })

      const ids = modality.getAgentIdsForDeterminingNextAgent(chatState)
      expect(ids).toEqual(['a1', 'a2'])
    })

    it('returns sender when dialogue has active sender', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          dialogue: {
            senders: {
              'a1': {
                mode: 'dialogue',
                receivers: {
                  'a2': { mode: 'dialogue', messages: 2 },
                },
              },
            },
            mode: 'dialogue',
            sender: 'a1',
            receiver: 'a2',
          },
        }),
      })

      expect(modality.getAgentIdsForDeterminingNextAgent(chatState)).toEqual(['a1'])
    })

    it('picks first pending sender when mode is pending and no sender set', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
        createTestAgent({ id: 'a3' }),
      ]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const progress = buildProgress({
        dialogue: {
          senders: {
            'a2': {
              mode: 'pending',
              receivers: {
                'a3': { mode: 'pending', messages: 0 },
              },
            },
            'a1': {
              mode: 'complete',
              receivers: {},
            },
          },
          mode: 'pending',
          sender: undefined,
        },
      })

      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress,
      })

      const result = modality.getAgentIdsForDeterminingNextAgent(chatState)
      // Should pick 'a2' as the first pending sender
      expect(result).toEqual(['a2'])
      // Side-effect: sets the sender on progress
      expect(chatState.progress.dialogue?.sender).toBe('a2')
      expect(chatState.progress.dialogue?.mode).toBe('dialogue')
    })

    it('returns pending senders when no active sender', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
      ]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          dialogue: {
            senders: {
              'a1': { mode: 'pending', receivers: {} },
              'a2': { mode: 'dialogue', receivers: {} },
            },
            mode: 'dialogue',
            sender: undefined,
          },
        }),
      })

      const result = modality.getAgentIdsForDeterminingNextAgent(chatState)
      expect(result).toContain('a1')
      expect(result).toContain('a2')
    })
  })

  describe('getAgentIdsForModeratorSelection', () => {
    it('returns sender and receiver when both are set', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
        createTestAgent({ id: 'a3' }),
      ]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          dialogue: {
            senders: {
              'a1': { mode: 'dialogue', receivers: { 'a2': { mode: 'dialogue', messages: 0 } } },
            },
            mode: 'dialogue',
            sender: 'a1',
            receiver: 'a2',
          },
        }),
      })

      const result = modality.getAgentIdsForModeratorSelection(chatState)
      expect(result).toEqual(['a1', 'a2'])
    })

    it('returns receiver IDs when sender set but no receiver', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
        createTestAgent({ id: 'a3' }),
      ]
      const round = createTestRound({
        participants: agents,
        type: 'dialogue' as any,
        moderatorAgentId: null,
      })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          dialogue: {
            senders: {
              'a1': {
                mode: 'dialogue',
                receivers: {
                  'a2': { mode: 'pending', messages: 0 },
                  'a3': { mode: 'pending', messages: 0 },
                },
              },
            },
            mode: 'dialogue',
            sender: 'a1',
            receiver: undefined,
          },
        }),
      })

      const result = modality.getAgentIdsForModeratorSelection(chatState)
      expect(result).toEqual(['a2', 'a3'])
    })
  })

  describe('getAgentIdsForModeratorCompletion', () => {
    it('returns sender and receiver when active dialogue', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
      ]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const chatState = createTestChatState({
        agents,
        activeRound: round,
        progress: buildProgress({
          dialogue: {
            senders: {
              'a1': { mode: 'dialogue', receivers: { 'a2': { mode: 'dialogue', messages: 3 } } },
            },
            mode: 'dialogue',
            sender: 'a1',
            receiver: 'a2',
          },
        }),
      })

      expect(modality.getAgentIdsForModeratorCompletion(chatState)).toEqual(['a1', 'a2'])
    })
  })

  describe('getSystemPrompt', () => {
    it('includes DIALOGUE tags', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2', name: 'Bob' })]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({
          dialogue: {
            senders: {
              'a1': { mode: 'dialogue', receivers: { 'a2': { mode: 'dialogue', messages: 0 } } },
            },
            mode: 'dialogue',
            sender: 'a1',
            receiver: 'a2',
          },
        }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      expect(prompt).toContain('<DIALOGUE>')
      expect(prompt).toContain('</DIALOGUE>')
      expect(prompt).toContain('Bob')
    })

    it('includes dialogue system prompt when available', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({ participants: agents, type: 'dialogue' as any })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({
          dialogue: {
            senders: {
              'a1': { mode: 'dialogue', receivers: { 'a2': { mode: 'dialogue', messages: 0 } } },
            },
            mode: 'dialogue',
            sender: 'a1',
            receiver: 'a2',
            systemPrompt: 'Discuss the nature of consciousness.',
          },
        }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      expect(prompt).toContain('Discuss the nature of consciousness.')
    })
  })

  describe('getUserMessagePrefix', () => {
    it('returns empty string', () => {
      const progress = buildProgress()
      expect(modality.getUserMessagePrefix(progress)).toBe('')
    })
  })
})

// ===========================================================================
// 9. Concrete modality: DebateModality
// ===========================================================================
describe('DebateModality', () => {
  const modality = getModality('debate')

  describe('type', () => {
    it('has type "debate"', () => {
      expect(modality.type).toBe('debate')
    })
  })

  describe('getSystemPrompt', () => {
    it('includes DEBATE tags', () => {
      const agents = [createTestAgent({ id: 'a1', name: 'Alice' })]
      const round = createTestRound({ participants: agents, type: 'debate' as any })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({ messageAuthors: [] }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      expect(prompt).toContain('<DEBATE>')
      expect(prompt).toContain('</DEBATE>')
    })

    it('provides first-message instructions when agent has no prior messages', () => {
      const agents = [createTestAgent({ id: 'a1', name: 'Alice' })]
      const round = createTestRound({ participants: agents, type: 'debate' as any })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({ messageAuthors: [] }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      expect(prompt).toContain('argue for a position')
      expect(prompt).toContain('articulating your own position')
    })

    it('provides continuation instructions when agent has prior messages', () => {
      const agents = [createTestAgent({ id: 'a1', name: 'Alice' })]
      const round = createTestRound({ participants: agents, type: 'debate' as any })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({ messageAuthors: ['a1', 'a2'] }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      expect(prompt).toContain('determine your position')
      expect(prompt).toContain('Alice')
    })

    it('includes natural stance prompt when stanceType is not custom', () => {
      const agents = [createTestAgent({ id: 'a1' })]
      const round = createTestRound({
        participants: agents,
        type: 'debate' as any,
        stanceType: null,
      })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({ messageAuthors: [] }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      expect(prompt).toContain('natural result of your own judgement')
    })

    it('includes custom stance when stanceType is "custom" and agent has a stance', () => {
      const agents = [createTestAgent({ id: 'a1' })]
      const round = createTestRound({
        participants: agents,
        type: 'debate' as any,
        stanceType: 'custom',
        stances: [{ agentId: 'a1', stance: 'AI is beneficial to humanity' }] as any,
      })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({ messageAuthors: [] }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      expect(prompt).toContain('AI is beneficial to humanity')
      expect(prompt).toContain('<IMPORTANT>')
    })

    it('returns empty stance when stanceType is "custom" but no stance defined for agent', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({
        participants: agents,
        type: 'debate' as any,
        stanceType: 'custom',
        stances: [{ agentId: 'a2', stance: 'some other stance' }] as any,
      })
      const chatState = createTestChatState({
        agents,
        activeAgent: agents[0],
        activeRound: round,
        progress: buildProgress({ messageAuthors: [] }),
      })

      const prompt = modality.getSystemPrompt(chatState)
      // a1 has no stance -> getStancePrompt returns ''
      expect(prompt).not.toContain('some other stance')
    })
  })

  describe('getUserMessagePrefix', () => {
    it('returns debate prefix', () => {
      expect(modality.getUserMessagePrefix(buildProgress())).toBe(
        'Continue the debate with your perspective:'
      )
    })
  })

  describe('isRoundComplete', () => {
    it('uses base modality behavior (inherits)', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({
        type: 'debate' as any,
        lengthType: 'total' as any,
        lengthNumber: 4,
        participants: agents,
      })
      expect(modality.isRoundComplete(round, 3)).toBe(false)
      expect(modality.isRoundComplete(round, 4)).toBe(true)
    })
  })
})

// ===========================================================================
// 10. Concrete modality: BrainstormModality
// ===========================================================================
describe('BrainstormModality', () => {
  const modality = getModality('brainstorm')

  it('has type "brainstorm"', () => {
    expect(modality.type).toBe('brainstorm')
  })

  it('getUserMessagePrefix returns brainstorm prefix', () => {
    expect(modality.getUserMessagePrefix(buildProgress())).toBe(
      'Add your ideas to this brainstorming session:'
    )
  })

  it('getSystemPrompt includes BRAINSTORM tags', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({
      participants: agents,
      type: 'brainstorm' as any,
      outputNumber: 5,
      depth: 'medium' as any,
    })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).toContain('<BRAINSTORM>')
    expect(prompt).toContain('</BRAINSTORM>')
    expect(prompt).toContain('5 ideas')
  })

  it('getSystemPrompt includes key implications for medium/thorough/exhaustive depth', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const roundMedium = createTestRound({
      participants: agents,
      type: 'brainstorm' as any,
      depth: 'medium' as any,
      outputNumber: 3,
    })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: roundMedium,
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).toContain('key implications')
  })

  it('getSystemPrompt omits key implications for minimal/brief depth', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const roundBrief = createTestRound({
      participants: agents,
      type: 'brainstorm' as any,
      depth: 'brief' as any,
      outputNumber: 3,
    })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: roundBrief,
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).not.toContain('key implications')
  })

  it('getCompletionPrompt references outputNumber', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({
      participants: agents,
      type: 'brainstorm' as any,
      outputNumber: 7,
    })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress(),
    })

    const prompt = modality.getCompletionPrompt(chatState)
    expect(prompt).toContain('7')
  })

  it('isRoundComplete inherits from BaseModality', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({
      type: 'brainstorm' as any,
      lengthType: 'total' as any,
      lengthNumber: 3,
      participants: agents,
    })
    expect(modality.isRoundComplete(round, 2)).toBe(false)
    expect(modality.isRoundComplete(round, 3)).toBe(true)
  })
})

// ===========================================================================
// 11. Concrete modality: ExploreModality
// ===========================================================================
describe('ExploreModality', () => {
  const modality = getModality('explore')

  it('has type "explore"', () => {
    expect(modality.type).toBe('explore')
  })

  it('getUserMessagePrefix returns explore prefix', () => {
    expect(modality.getUserMessagePrefix(buildProgress())).toBe(
      'Add your thoughts to this exploration:'
    )
  })

  it('getSystemPrompt includes EXPLORE tags', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({ participants: agents, type: 'explore' as any })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).toContain('<EXPLORE>')
    expect(prompt).toContain('</EXPLORE>')
    expect(prompt).toContain('explore the user\'s question')
  })
})

// ===========================================================================
// 12. Concrete modality: CritiqueModality
// ===========================================================================
describe('CritiqueModality', () => {
  const modality = getModality('critique')

  it('has type "critique"', () => {
    expect(modality.type).toBe('critique')
  })

  it('getUserMessagePrefix returns critique prefix', () => {
    expect(modality.getUserMessagePrefix(buildProgress())).toBe('Share your critical analysis:')
  })

  it('getSystemPrompt includes CRITIQUE tags', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({ participants: agents, type: 'critique' as any })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).toContain('<CRITIQUE>')
    expect(prompt).toContain('</CRITIQUE>')
    expect(prompt).toContain('critique the previous ideas')
  })

  it('isRoundComplete inherits from BaseModality', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({
      type: 'critique' as any,
      lengthType: 'total' as any,
      lengthNumber: 2,
      participants: agents,
    })
    expect(modality.isRoundComplete(round, 1)).toBe(false)
    expect(modality.isRoundComplete(round, 2)).toBe(true)
  })
})

// ===========================================================================
// 13. Concrete modality: ReviewModality
// ===========================================================================
describe('ReviewModality', () => {
  const modality = getModality('review')

  it('has type "review"', () => {
    expect(modality.type).toBe('review')
  })

  describe('isRoundComplete', () => {
    it('always returns true (single response review)', () => {
      const round = createTestRound({
        type: 'review' as any,
        lengthType: 'total' as any,
        lengthNumber: 10,
        participants: [createTestAgent({ id: 'a1' })],
      })

      expect(modality.isRoundComplete(round, 0)).toBe(true)
      expect(modality.isRoundComplete(round, 1)).toBe(true)
      expect(modality.isRoundComplete(round, 100)).toBe(true)
    })
  })

  it('getUserMessagePrefix returns review prefix', () => {
    expect(modality.getUserMessagePrefix(buildProgress())).toBe('Share your review:')
  })

  it('getSystemPrompt includes REVIEW tags', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const prevRound = createTestRound({
      id: 'round-prev',
      participants: agents,
      type: 'brainstorm' as any,
      sequence: 0,
    })
    const round = createTestRound({
      participants: agents,
      type: 'review' as any,
      action: 'rank',
      sequence: 1,
    })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      rounds: [prevRound, round],
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).toContain('<REVIEW>')
    expect(prompt).toContain('</REVIEW>')
  })
})

// ===========================================================================
// 14. Concrete modality: SurveyModality
// ===========================================================================
describe('SurveyModality', () => {
  const modality = getModality('survey')

  it('has type "survey"', () => {
    expect(modality.type).toBe('survey')
  })

  describe('isRoundComplete', () => {
    it('returns true when authorCount >= participants.length', () => {
      const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
      const round = createTestRound({ participants: agents, type: 'survey' as any })

      expect(modality.isRoundComplete(round, 2)).toBe(true)
      expect(modality.isRoundComplete(round, 3)).toBe(true)
    })

    it('returns false when authorCount < participants.length', () => {
      const agents = [
        createTestAgent({ id: 'a1' }),
        createTestAgent({ id: 'a2' }),
        createTestAgent({ id: 'a3' }),
      ]
      const round = createTestRound({ participants: agents, type: 'survey' as any })

      expect(modality.isRoundComplete(round, 2)).toBe(false)
      expect(modality.isRoundComplete(round, 0)).toBe(false)
    })
  })

  it('getUserMessagePrefix returns survey prefix', () => {
    expect(modality.getUserMessagePrefix(buildProgress())).toBe(
      'Please provide your response to the survey question:'
    )
  })

  it('getSystemPrompt includes SURVEY tags', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({ participants: agents, type: 'survey' as any })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).toContain('<SURVEY>')
    expect(prompt).toContain('</SURVEY>')
  })
})

// ===========================================================================
// 15. Concrete modality: UnderstandModality
// ===========================================================================
describe('UnderstandModality', () => {
  const modality = getModality('understand')

  it('has type "understand"', () => {
    expect(modality.type).toBe('understand')
  })

  it('getUserMessagePrefix returns understand prefix', () => {
    expect(modality.getUserMessagePrefix(buildProgress())).toContain('understand')
  })

  it('getSystemPrompt includes UNDERSTAND tags', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({ participants: agents, type: 'understand' as any })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress(),
    })

    const prompt = modality.getSystemPrompt(chatState)
    expect(prompt).toContain('<UNDERSTAND>')
    expect(prompt).toContain('</UNDERSTAND>')
  })

  it('isRoundComplete inherits from BaseModality', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({
      type: 'understand' as any,
      lengthType: 'total' as any,
      lengthNumber: 3,
      participants: agents,
    })
    expect(modality.isRoundComplete(round, 2)).toBe(false)
    expect(modality.isRoundComplete(round, 3)).toBe(true)
  })
})

// ===========================================================================
// 16. Concrete modality: CustomModality
// ===========================================================================
describe('CustomModality', () => {
  const modality = getModality('custom')

  it('has type "custom"', () => {
    expect(modality.type).toBe('custom')
  })

  it('getUserMessagePrefix returns custom prefix', () => {
    expect(modality.getUserMessagePrefix(buildProgress())).toBe('Follow your prompt instructions.')
  })

  it('getSystemPrompt returns empty string', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({ participants: agents, type: 'custom' as any })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress(),
    })

    expect(modality.getSystemPrompt(chatState)).toBe('')
  })

  it('isRoundComplete inherits from BaseModality', () => {
    const agents = [createTestAgent({ id: 'a1' })]
    const round = createTestRound({
      type: 'custom' as any,
      lengthType: 'rounds' as any,
      lengthRounds: 2,
      participants: agents,
    })
    expect(modality.isRoundComplete(round, 1)).toBe(false)
    expect(modality.isRoundComplete(round, 2)).toBe(true)
  })
})

// ===========================================================================
// 17. Cross-cutting: getUserMessagePrefix & getCompletionPrompt
// ===========================================================================
describe('Cross-cutting modality interface compliance', () => {
  const allTypes = [
    'brainstorm',
    'debate',
    'dialogue',
    'explore',
    'critique',
    'review',
    'survey',
    'understand',
    'custom',
  ]

  it.each(allTypes)('%s implements getUserMessagePrefix returning a string', (type) => {
    const modality = getModality(type)
    const result = modality.getUserMessagePrefix(buildProgress())
    expect(typeof result).toBe('string')
  })

  it.each(allTypes)('%s implements getSystemPrompt returning a string', (type) => {
    const modality = getModality(type)
    const agents = [createTestAgent({ id: 'a1', name: 'TestAgent' })]
    const round = createTestRound({
      participants: agents,
      type: type as any,
      outputNumber: 3,
      depth: 'medium' as any,
    })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      rounds: [
        createTestRound({ id: 'round-0', participants: agents, sequence: 0 }),
        round,
      ],
      progress: buildProgress({ messageAuthors: [] }),
    })

    const result = modality.getSystemPrompt(chatState)
    expect(typeof result).toBe('string')
  })

  it.each(allTypes)('%s implements getCompletionPrompt returning a string', (type) => {
    const modality = getModality(type)
    const agents = [createTestAgent({ id: 'a1' }), createTestAgent({ id: 'a2' })]
    const round = createTestRound({
      participants: agents,
      type: type as any,
    })
    const chatState = createTestChatState({
      agents,
      activeAgent: agents[0],
      activeRound: round,
      progress: buildProgress({
        dialogue: {
          senders: {
            'a1': { mode: 'dialogue', receivers: { 'a2': { mode: 'dialogue', messages: 3 } } },
          },
          mode: 'dialogue',
          sender: 'a1',
          receiver: 'a2',
        },
      }),
    })

    const result = modality.getCompletionPrompt(chatState)
    expect(typeof result).toBe('string')
  })

  it.each(allTypes)('%s implements isRoundComplete returning a boolean', (type) => {
    const modality = getModality(type)
    const round = createTestRound({
      type: type as any,
      lengthType: 'total' as any,
      lengthNumber: 5,
      participants: [createTestAgent({ id: 'a1' })],
    })
    const result = modality.isRoundComplete(round, 3)
    expect(typeof result).toBe('boolean')
  })

  it.each(allTypes)('%s implements getRoundModerators returning an array', (type) => {
    const modality = getModality(type)
    const round = createTestRound({ type: type as any })
    const result = modality.getRoundModerators(round)
    expect(Array.isArray(result)).toBe(true)
  })
})
