/**
 * Unit tests for the pure-logic functions in DialogueService.
 *
 * Tested functions:
 *   - initializeDialogueProgress()
 *   - shouldDetermineSendingAgents(progress)
 *   - shouldCheckSenderDecision(progress)
 *   - shouldDetermineReceivers(progress)
 *   - dialogueHasReachedCountLimit(chatState)
 *   - extractDialogueEndDecision(content)
 *   - processAgentDialogueEndDecision(chatState, messageContent)
 *   - findNextPendingSender(progress)
 *   - findNextPendingReceiver(senderId, progress)
 *   - findAndSetupNextSender(progress, chatState)
 *   - iterateDialogueProgress(chatState, messageContent)
 *   - shouldCountAsSenderCompletion(chatState)
 *
 * LLM-dependent methods (determineSendingAgents, determineReceivers,
 * askModeratorToSelectSenders, generateDialogueInstructions, etc.)
 * are intentionally excluded — they require the AI SDK and are better
 * covered by integration tests.
 */

jest.mock('@/lib/chat/services/LLM', () => ({
  LLMService: {
    generateTextForModerator: jest.fn(),
    generateTextWithAI: jest.fn(),
  },
}))

jest.mock('@/lib/chat/services/memory', () => ({
  MemoryService: {
    getMemoriesForPrompt: jest.fn().mockResolvedValue([]),
  },
}))

import { DialogueService, type DialogueProgress } from '@/lib/chat/services/dialogue'
import { createTestChatState, createTestAgent, createTestRound, resetIdCounter } from '@/__tests__/factories'
import type { ChatProgress } from '@/lib/types/chat-progress'
import type { ChatState } from '@/lib/chat/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ChatProgress with dialogue state */
function makeProgress(overrides: Partial<ChatProgress> = {}): ChatProgress {
  return {
    messageCount: 0,
    messageAuthors: [],
    active: {
      step: 'api',
      agent: { id: 'agent-1', mode: 'participant' },
      round: { id: 'round-1', isComplete: false },
    },
    next: {
      step: 'user',
      round: { id: 'round-1' },
    },
    ...overrides,
  }
}

/** Build a dialogue progress structure with senders/receivers */
function makeDialogue(overrides: Partial<DialogueProgress> = {}): DialogueProgress {
  return {
    senders: {},
    mode: 'pending',
    ...overrides,
  }
}

/** Build a ChatState configured for a dialogue round */
function makeDialogueChatState(overrides: Partial<ChatState> & {
  dialogueLengthMode?: string
  dialogueLength?: number
  dialogueSenderMode?: string
  dialogueReceiverMode?: string
  dialogueSelectedReceivers?: string[]
  dialogueProgress?: DialogueProgress
} = {}): ChatState {
  const agent1 = createTestAgent({ id: 'sender-1', name: 'Sender One' })
  const agent2 = createTestAgent({ id: 'receiver-1', name: 'Receiver One' })
  const agent3 = createTestAgent({ id: 'receiver-2', name: 'Receiver Two' })
  const agents = overrides.agents ?? [agent1, agent2, agent3]

  const round = createTestRound({
    id: 'round-1',
    type: 'dialogue' as any,
    participants: agents,
    dialogueLengthMode: overrides.dialogueLengthMode ?? 'fixed',
    dialogueLength: overrides.dialogueLength ?? 5,
    dialogueSenderMode: overrides.dialogueSenderMode ?? 'all_participants',
    dialogueReceiverMode: overrides.dialogueReceiverMode ?? 'all_participants',
    dialogueSelectedReceivers: overrides.dialogueSelectedReceivers ?? [],
  } as any)

  const progress = makeProgress({
    dialogue: overrides.dialogueProgress ?? makeDialogue({
      mode: 'dialogue',
      sender: 'sender-1',
      receiver: 'receiver-1',
      senders: {
        'sender-1': {
          mode: 'dialogue',
          receivers: {
            'receiver-1': { mode: 'dialogue', messages: 0 },
            'receiver-2': { mode: 'pending', messages: 0 },
          },
        },
        'sender-2': {
          mode: 'pending',
          receivers: {},
        },
      },
    }),
  })

  return createTestChatState({
    agents,
    activeAgent: agent1,
    activeRound: round,
    progress,
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetIdCounter()
})

// ===========================
// initializeDialogueProgress
// ===========================
describe('initializeDialogueProgress', () => {
  it('returns an empty senders map and pending mode', () => {
    const result = DialogueService.initializeDialogueProgress()
    expect(result).toEqual({
      senders: {},
      mode: 'pending',
    })
  })

  it('does not include sender or receiver fields', () => {
    const result = DialogueService.initializeDialogueProgress()
    expect(result.sender).toBeUndefined()
    expect(result.receiver).toBeUndefined()
  })
})

// ===========================
// shouldDetermineSendingAgents
// ===========================
describe('shouldDetermineSendingAgents', () => {
  it('returns true when dialogue has no senders yet', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({ senders: {}, mode: 'pending' }),
    })
    expect(DialogueService.shouldDetermineSendingAgents(progress)).toBe(true)
  })

  it('returns false when senders already exist', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': { mode: 'pending', receivers: {} },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldDetermineSendingAgents(progress)).toBe(false)
  })

  it('returns false when dialogue mode is complete', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({ senders: {}, mode: 'complete' }),
    })
    expect(DialogueService.shouldDetermineSendingAgents(progress)).toBe(false)
  })

  it('returns true when dialogue is undefined (no senders)', () => {
    const progress = makeProgress({ dialogue: undefined })
    expect(DialogueService.shouldDetermineSendingAgents(progress)).toBe(true)
  })
})

// ===========================
// shouldCheckSenderDecision
// ===========================
describe('shouldCheckSenderDecision', () => {
  it('returns true when sender exists and mode is pending', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: 'sender-1',
        senders: {
          'sender-1': { mode: 'pending', receivers: {} },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldCheckSenderDecision(progress)).toBe(true)
  })

  it('returns false when sender mode is dialogue (already decided)', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: 'sender-1',
        senders: {
          'sender-1': { mode: 'dialogue', receivers: {} },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldCheckSenderDecision(progress)).toBe(false)
  })

  it('returns false when sender mode is complete', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: 'sender-1',
        senders: {
          'sender-1': { mode: 'complete', receivers: {} },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldCheckSenderDecision(progress)).toBe(false)
  })

  it('returns false when no sender is set', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: undefined,
        senders: {
          'sender-1': { mode: 'pending', receivers: {} },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldCheckSenderDecision(progress)).toBe(false)
  })

  it('returns false when dialogue is undefined', () => {
    const progress = makeProgress({ dialogue: undefined })
    expect(DialogueService.shouldCheckSenderDecision(progress)).toBe(false)
  })
})

// ===========================
// shouldDetermineReceivers
// ===========================
describe('shouldDetermineReceivers', () => {
  it('returns true when sender is in dialogue mode and has no receivers', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: 'sender-1',
        senders: {
          'sender-1': { mode: 'dialogue', receivers: {} },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldDetermineReceivers(progress)).toBe(true)
  })

  it('returns false when sender already has receivers', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: 'sender-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'pending', messages: 0 },
            },
          },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldDetermineReceivers(progress)).toBe(false)
  })

  it('returns false when sender mode is pending (not yet decided)', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: 'sender-1',
        senders: {
          'sender-1': { mode: 'pending', receivers: {} },
        },
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldDetermineReceivers(progress)).toBe(false)
  })

  it('returns false when no sender is set', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        sender: undefined,
        senders: {},
        mode: 'dialogue',
      }),
    })
    expect(DialogueService.shouldDetermineReceivers(progress)).toBe(false)
  })
})

// ===========================
// dialogueHasReachedCountLimit
// ===========================
describe('dialogueHasReachedCountLimit', () => {
  it('returns true when message count equals the fixed limit', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 4,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 4 },
            },
          },
        },
      }),
    })
    expect(DialogueService.dialogueHasReachedCountLimit(chatState)).toBe(true)
  })

  it('returns true when message count exceeds the fixed limit', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 3,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 5 },
            },
          },
        },
      }),
    })
    expect(DialogueService.dialogueHasReachedCountLimit(chatState)).toBe(true)
  })

  it('returns false when message count is below the limit', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 6,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 3 },
            },
          },
        },
      }),
    })
    expect(DialogueService.dialogueHasReachedCountLimit(chatState)).toBe(false)
  })

  it('returns false when length mode is not fixed', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'moderator_decides',
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 100 },
            },
          },
        },
      }),
    })
    expect(DialogueService.dialogueHasReachedCountLimit(chatState)).toBe(false)
  })

  it('returns false when dialogue is not active', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 2,
      dialogueProgress: makeDialogue({
        mode: 'complete',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'complete',
            receivers: {
              'receiver-1': { mode: 'complete', messages: 5 },
            },
          },
        },
      }),
    })
    expect(DialogueService.dialogueHasReachedCountLimit(chatState)).toBe(false)
  })

  it('returns false when no sender is set', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 2,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: undefined,
        receiver: undefined,
        senders: {},
      }),
    })
    expect(DialogueService.dialogueHasReachedCountLimit(chatState)).toBe(false)
  })

  it('defaults to limit of 5 when dialogueLength is not set', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: undefined as any,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 5 },
            },
          },
        },
      }),
    })
    expect(DialogueService.dialogueHasReachedCountLimit(chatState)).toBe(true)
  })
})

// ===========================
// extractDialogueEndDecision
// ===========================
describe('extractDialogueEndDecision', () => {
  it('extracts end decision with reason', () => {
    const result = DialogueService.extractDialogueEndDecision(
      'Some message text [END_DIALOGUE: We have reached consensus] more text'
    )
    expect(result).toEqual({
      end: true,
      reason: 'We have reached consensus',
    })
  })

  it('extracts end decision case-insensitively', () => {
    const result = DialogueService.extractDialogueEndDecision(
      '[end_dialogue: Topic exhausted]'
    )
    expect(result).toEqual({
      end: true,
      reason: 'Topic exhausted',
    })
  })

  it('returns null when no end marker is present', () => {
    const result = DialogueService.extractDialogueEndDecision(
      'This is a normal message with no special markers.'
    )
    expect(result).toBeNull()
  })

  it('returns null for CONTINUE_DIALOGUE marker (not supported)', () => {
    const result = DialogueService.extractDialogueEndDecision(
      '[CONTINUE_DIALOGUE: Keep going]'
    )
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = DialogueService.extractDialogueEndDecision('')
    expect(result).toBeNull()
  })

  it('handles end marker at the end of the content', () => {
    const result = DialogueService.extractDialogueEndDecision(
      'Final thoughts. [END_DIALOGUE: Done]'
    )
    expect(result).toEqual({
      end: true,
      reason: 'Done',
    })
  })
})

// ===========================
// processAgentDialogueEndDecision
// ===========================
describe('processAgentDialogueEndDecision', () => {
  it('marks receiver and sender complete when END_DIALOGUE found in agent_decides mode', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'agent_decides',
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 3 },
            },
          },
        },
      }),
    })

    const result = DialogueService.processAgentDialogueEndDecision(
      chatState,
      'OK, I think we are done. [END_DIALOGUE: Consensus reached]'
    )

    const dialogue = result.progress.dialogue!
    // Receiver is marked complete
    expect(dialogue.senders['sender-1'].receivers['receiver-1'].mode).toBe('complete')
    // No more receivers, sender should be marked complete
    expect(dialogue.senders['sender-1'].mode).toBe('complete')
    // Sender and receiver cleared
    expect(dialogue.sender).toBeUndefined()
    expect(dialogue.receiver).toBeUndefined()
    // All senders complete => overall dialogue complete
    expect(dialogue.mode).toBe('complete')
  })

  it('moves to next receiver when more pending receivers exist', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'agent_decides',
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 3 },
              'receiver-2': { mode: 'pending', messages: 0 },
            },
          },
        },
      }),
    })

    const result = DialogueService.processAgentDialogueEndDecision(
      chatState,
      '[END_DIALOGUE: Moving on]'
    )

    const dialogue = result.progress.dialogue!
    expect(dialogue.senders['sender-1'].receivers['receiver-1'].mode).toBe('complete')
    // Sender stays in dialogue since there are pending receivers
    expect(dialogue.senders['sender-1'].mode).toBe('dialogue')
    // Receiver cleared to allow next one
    expect(dialogue.receiver).toBeUndefined()
  })

  it('does nothing when length mode is not agent_decides', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 3 },
            },
          },
        },
      }),
    })

    const result = DialogueService.processAgentDialogueEndDecision(
      chatState,
      '[END_DIALOGUE: Should be ignored]'
    )

    // Nothing changed
    expect(result.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].mode).toBe('dialogue')
  })

  it('does nothing when message has no END_DIALOGUE marker', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'agent_decides',
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 3 },
            },
          },
        },
      }),
    })

    const result = DialogueService.processAgentDialogueEndDecision(
      chatState,
      'Normal message without end marker'
    )

    expect(result.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].mode).toBe('dialogue')
    expect(result.progress.dialogue!.sender).toBe('sender-1')
    expect(result.progress.dialogue!.receiver).toBe('receiver-1')
  })

  it('returns chatState unchanged when dialogue is not active', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'agent_decides',
      dialogueProgress: makeDialogue({
        mode: 'complete',
        sender: undefined,
        receiver: undefined,
        senders: {},
      }),
    })

    const result = DialogueService.processAgentDialogueEndDecision(
      chatState,
      '[END_DIALOGUE: Too late]'
    )

    expect(result.progress.dialogue!.mode).toBe('complete')
  })
})

// ===========================
// findNextPendingSender
// ===========================
describe('findNextPendingSender', () => {
  it('returns the first sender with pending mode', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': { mode: 'complete', receivers: {} },
          'sender-2': { mode: 'pending', receivers: {} },
          'sender-3': { mode: 'pending', receivers: {} },
        },
      }),
    })
    expect(DialogueService.findNextPendingSender(progress)).toBe('sender-2')
  })

  it('returns null when all senders are complete', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': { mode: 'complete', receivers: {} },
          'sender-2': { mode: 'complete', receivers: {} },
        },
      }),
    })
    expect(DialogueService.findNextPendingSender(progress)).toBeNull()
  })

  it('returns null when there are no senders', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({ senders: {} }),
    })
    expect(DialogueService.findNextPendingSender(progress)).toBeNull()
  })

  it('returns null when dialogue is undefined', () => {
    const progress = makeProgress({ dialogue: undefined })
    expect(DialogueService.findNextPendingSender(progress)).toBeNull()
  })

  it('skips senders in dialogue or skip mode', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': { mode: 'dialogue', receivers: {} },
          'sender-2': { mode: 'skip', receivers: {} },
          'sender-3': { mode: 'pending', receivers: {} },
        },
      }),
    })
    expect(DialogueService.findNextPendingSender(progress)).toBe('sender-3')
  })
})

// ===========================
// findNextPendingReceiver
// ===========================
describe('findNextPendingReceiver', () => {
  it('returns the first pending receiver', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'complete', messages: 5 },
              'receiver-2': { mode: 'pending', messages: 0 },
              'receiver-3': { mode: 'pending', messages: 0 },
            },
          },
        },
      }),
    })
    expect(DialogueService.findNextPendingReceiver('sender-1', progress)).toBe('receiver-2')
  })

  it('returns null when all receivers are complete', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'complete', messages: 5 },
              'receiver-2': { mode: 'complete', messages: 4 },
            },
          },
        },
      }),
    })
    expect(DialogueService.findNextPendingReceiver('sender-1', progress)).toBeNull()
  })

  it('returns null when sender has no receivers', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': { mode: 'dialogue', receivers: {} },
        },
      }),
    })
    expect(DialogueService.findNextPendingReceiver('sender-1', progress)).toBeNull()
  })

  it('returns null for unknown sender', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: { 'receiver-1': { mode: 'pending', messages: 0 } },
          },
        },
      }),
    })
    expect(DialogueService.findNextPendingReceiver('unknown-sender', progress)).toBeNull()
  })

  it('returns null when dialogue is undefined', () => {
    const progress = makeProgress({ dialogue: undefined })
    expect(DialogueService.findNextPendingReceiver('sender-1', progress)).toBeNull()
  })

  it('skips receivers whose reverse dialogue already has messages (duplicate prevention)', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'sender-2': { mode: 'pending', messages: 0 },
            },
          },
          // sender-2 already dialogued with sender-1 (reverse)
          'sender-2': {
            mode: 'complete',
            receivers: {
              'sender-1': { mode: 'complete', messages: 4 },
            },
          },
        },
      }),
    })
    // sender-2 as receiver of sender-1 should be skipped because
    // sender-2->sender-1 reverse already has messages
    expect(DialogueService.findNextPendingReceiver('sender-1', progress)).toBeNull()
  })

  it('returns pending receiver when reverse dialogue has no messages', () => {
    const progress = makeProgress({
      dialogue: makeDialogue({
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'sender-2': { mode: 'pending', messages: 0 },
            },
          },
          'sender-2': {
            mode: 'pending',
            receivers: {
              'sender-1': { mode: 'pending', messages: 0 },
            },
          },
        },
      }),
    })
    // No reverse messages yet, should be returned
    expect(DialogueService.findNextPendingReceiver('sender-1', progress)).toBe('sender-2')
  })
})

// ===========================
// findAndSetupNextSender
// ===========================
describe('findAndSetupNextSender', () => {
  it('sets up next pending sender and its receivers for all_participants mode', () => {
    const agent1 = createTestAgent({ id: 'sender-1', name: 'Agent 1' })
    const agent2 = createTestAgent({ id: 'sender-2', name: 'Agent 2' })
    const agent3 = createTestAgent({ id: 'sender-3', name: 'Agent 3' })
    const round = createTestRound({
      id: 'round-1',
      type: 'dialogue' as any,
      participants: [agent1, agent2, agent3],
      dialogueReceiverMode: 'all_participants',
    } as any)

    const progress = makeProgress({
      dialogue: makeDialogue({
        mode: 'dialogue',
        senders: {
          'sender-1': { mode: 'complete', receivers: {} },
          'sender-2': {
            mode: 'pending',
            receivers: {},
          },
          'sender-3': { mode: 'pending', receivers: {} },
        },
      }),
    })

    const chatState = createTestChatState({
      agents: [agent1, agent2, agent3],
      activeRound: round,
      progress,
    })

    const result = DialogueService.findAndSetupNextSender(progress, chatState)
    expect(result).toBe('sender-2')
    expect(progress.dialogue!.sender).toBe('sender-2')
    // Receivers should be set up (all except sender-2)
    const sender2 = progress.dialogue!.senders['sender-2']
    expect(Object.keys(sender2.receivers)).toContain('sender-1')
    expect(Object.keys(sender2.receivers)).toContain('sender-3')
    // First receiver should be set
    expect(progress.dialogue!.receiver).toBeDefined()
  })

  it('returns null when no pending senders remain', () => {
    const round = createTestRound({
      id: 'round-1',
      type: 'dialogue' as any,
      dialogueReceiverMode: 'all_participants',
    } as any)

    const progress = makeProgress({
      dialogue: makeDialogue({
        mode: 'dialogue',
        senders: {
          'sender-1': { mode: 'complete', receivers: {} },
          'sender-2': { mode: 'complete', receivers: {} },
        },
      }),
    })

    const chatState = createTestChatState({
      activeRound: round,
      progress,
    })

    const result = DialogueService.findAndSetupNextSender(progress, chatState)
    expect(result).toBeNull()
  })

  it('skips senders whose receivers are all duplicates (reverse already dialogued)', () => {
    const agent1 = createTestAgent({ id: 'sender-1', name: 'Agent 1' })
    const agent2 = createTestAgent({ id: 'sender-2', name: 'Agent 2' })
    const round = createTestRound({
      id: 'round-1',
      type: 'dialogue' as any,
      participants: [agent1, agent2],
      dialogueReceiverMode: 'all_participants',
    } as any)

    const progress = makeProgress({
      dialogue: makeDialogue({
        mode: 'dialogue',
        senders: {
          'sender-1': {
            mode: 'complete',
            receivers: {
              'sender-2': { mode: 'complete', messages: 4 },
            },
          },
          'sender-2': {
            mode: 'pending',
            receivers: {},
          },
        },
      }),
    })

    const chatState = createTestChatState({
      agents: [agent1, agent2],
      activeRound: round,
      progress,
    })

    // sender-2 -> sender-1 is a reverse of sender-1 -> sender-2 which already has messages
    const result = DialogueService.findAndSetupNextSender(progress, chatState)
    expect(result).toBeNull()
    // sender-2 should be marked complete since all receivers are duplicates
    expect(progress.dialogue!.senders['sender-2'].mode).toBe('complete')
  })

  it('just sets sender for moderator_decides receiver mode (no receiver setup)', () => {
    const agent1 = createTestAgent({ id: 'sender-1', name: 'Agent 1' })
    const agent2 = createTestAgent({ id: 'sender-2', name: 'Agent 2' })
    const round = createTestRound({
      id: 'round-1',
      type: 'dialogue' as any,
      participants: [agent1, agent2],
      dialogueReceiverMode: 'moderator_decides',
    } as any)

    const progress = makeProgress({
      dialogue: makeDialogue({
        mode: 'dialogue',
        senders: {
          'sender-1': { mode: 'complete', receivers: {} },
          'sender-2': { mode: 'pending', receivers: {} },
        },
      }),
    })

    const chatState = createTestChatState({
      agents: [agent1, agent2],
      activeRound: round,
      progress,
    })

    const result = DialogueService.findAndSetupNextSender(progress, chatState)
    expect(result).toBe('sender-2')
    // No receivers populated (moderator will decide later)
    expect(Object.keys(progress.dialogue!.senders['sender-2'].receivers)).toHaveLength(0)
  })
})

// ===========================
// iterateDialogueProgress
// ===========================
describe('iterateDialogueProgress', () => {
  it('increments message count for current dialogue', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 10,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 2 },
              'receiver-2': { mode: 'pending', messages: 0 },
            },
          },
        },
      }),
    })

    DialogueService.iterateDialogueProgress(chatState, 'A normal message')

    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].messages).toBe(3)
  })

  it('does not increment message count for moderator messages', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 10,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 2 },
            },
          },
        },
      }),
    })
    chatState.progress.active.agent.mode = 'moderator'

    DialogueService.iterateDialogueProgress(chatState, 'Moderator speaking')

    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].messages).toBe(2)
  })

  it('marks receiver complete when fixed message count is reached', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 3,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 2 },
              'receiver-2': { mode: 'pending', messages: 0 },
            },
          },
        },
      }),
    })

    DialogueService.iterateDialogueProgress(chatState, 'Third message')

    // Message count incremented to 3 (equals limit)
    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].messages).toBe(3)
    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].mode).toBe('complete')
    // Next receiver should be set up
    expect(chatState.progress.dialogue!.receiver).toBe('receiver-2')
  })

  it('marks sender complete when all receivers are done', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 2,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 1 },
              // No other receivers pending
            },
          },
          'sender-2': {
            mode: 'pending',
            receivers: {},
          },
        },
      }),
    })

    DialogueService.iterateDialogueProgress(chatState, 'Completing message')

    // receiver-1 is complete (messages now 2 = limit)
    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].mode).toBe('complete')
    // sender-1 should be complete since no more receivers
    expect(chatState.progress.dialogue!.senders['sender-1'].mode).toBe('complete')
  })

  it('marks overall dialogue complete when all senders done', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 1,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 0 },
            },
          },
          // No other senders
        },
      }),
    })

    DialogueService.iterateDialogueProgress(chatState, 'Final message')

    expect(chatState.progress.dialogue!.mode).toBe('complete')
    expect(chatState.progress.active.round.isComplete).toBe(true)
  })

  it('does nothing for non-dialogue round types', () => {
    const round = createTestRound({
      id: 'round-1',
      type: 'brainstorm' as any,
    })
    const chatState = createTestChatState({
      activeRound: round,
      progress: makeProgress({
        dialogue: makeDialogue({
          mode: 'dialogue',
          sender: 'sender-1',
          receiver: 'receiver-1',
          senders: {
            'sender-1': {
              mode: 'dialogue',
              receivers: {
                'receiver-1': { mode: 'dialogue', messages: 0 },
              },
            },
          },
        }),
      }),
    })

    const result = DialogueService.iterateDialogueProgress(chatState, 'Message')

    // Nothing changed
    expect(result.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].messages).toBe(0)
  })

  it('handles end decision extraction for agent_decides mode', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'agent_decides',
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 3 },
              'receiver-2': { mode: 'pending', messages: 0 },
            },
          },
        },
      }),
    })

    DialogueService.iterateDialogueProgress(
      chatState,
      'Final thoughts [END_DIALOGUE: We agree]'
    )

    // Message count incremented
    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].messages).toBe(4)
    // Receiver marked complete by processAgentDialogueEndDecision
    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].mode).toBe('complete')
    // Next receiver set
    expect(chatState.progress.dialogue!.receiver).toBe('receiver-2')
  })

  it('clears dialogue systemPrompt after iteration', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 100,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'dialogue', messages: 0 },
            },
          },
        },
      }),
    })
    chatState.progress.dialogue!.systemPrompt = 'Some instructions'

    DialogueService.iterateDialogueProgress(chatState, 'Hello')

    expect(chatState.progress.dialogue!.systemPrompt).toBeUndefined()
  })

  it('returns chatState unchanged when dialogue has no active sender/receiver', () => {
    const chatState = makeDialogueChatState({
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: undefined,
        receiver: undefined,
        senders: {},
      }),
    })

    const result = DialogueService.iterateDialogueProgress(chatState, 'Orphan message')

    // No crash, state unchanged
    expect(result.progress.dialogue!.mode).toBe('dialogue')
  })

  it('does not increment messages for already-complete receivers', () => {
    const chatState = makeDialogueChatState({
      dialogueLengthMode: 'fixed',
      dialogueLength: 10,
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        receiver: 'receiver-1',
        senders: {
          'sender-1': {
            mode: 'dialogue',
            receivers: {
              'receiver-1': { mode: 'complete', messages: 5 },
              'receiver-2': { mode: 'pending', messages: 0 },
            },
          },
        },
      }),
    })

    DialogueService.iterateDialogueProgress(chatState, 'After complete')

    // Message count should not increase since receiver is already complete
    expect(chatState.progress.dialogue!.senders['sender-1'].receivers['receiver-1'].messages).toBe(5)
    // Should move to next receiver
    expect(chatState.progress.dialogue!.receiver).toBe('receiver-2')
  })
})

// ===========================
// shouldCountAsSenderCompletion
// ===========================
describe('shouldCountAsSenderCompletion', () => {
  it('returns true when sender is undefined and some senders are complete', () => {
    const chatState = makeDialogueChatState({
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: undefined,
        senders: {
          'sender-1': { mode: 'complete', receivers: {} },
          'sender-2': { mode: 'pending', receivers: {} },
        },
      }),
    })
    expect(DialogueService.shouldCountAsSenderCompletion(chatState)).toBe(true)
  })

  it('returns false when a sender is currently active', () => {
    const chatState = makeDialogueChatState({
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: 'sender-1',
        senders: {
          'sender-1': { mode: 'dialogue', receivers: {} },
        },
      }),
    })
    expect(DialogueService.shouldCountAsSenderCompletion(chatState)).toBe(false)
  })

  it('returns false when no senders are complete', () => {
    const chatState = makeDialogueChatState({
      dialogueProgress: makeDialogue({
        mode: 'dialogue',
        sender: undefined,
        senders: {
          'sender-1': { mode: 'pending', receivers: {} },
          'sender-2': { mode: 'pending', receivers: {} },
        },
      }),
    })
    expect(DialogueService.shouldCountAsSenderCompletion(chatState)).toBe(false)
  })

  it('returns false for non-dialogue round types', () => {
    const round = createTestRound({
      id: 'round-1',
      type: 'brainstorm' as any,
    })
    const chatState = createTestChatState({
      activeRound: round,
      progress: makeProgress({
        dialogue: makeDialogue({
          mode: 'dialogue',
          sender: undefined,
          senders: {
            'sender-1': { mode: 'complete', receivers: {} },
          },
        }),
      }),
    })
    expect(DialogueService.shouldCountAsSenderCompletion(chatState)).toBe(false)
  })

  it('returns false when dialogue is undefined', () => {
    const round = createTestRound({
      id: 'round-1',
      type: 'dialogue' as any,
    } as any)
    const chatState = createTestChatState({
      activeRound: round,
      progress: makeProgress({ dialogue: undefined }),
    })
    expect(DialogueService.shouldCountAsSenderCompletion(chatState)).toBe(false)
  })
})
