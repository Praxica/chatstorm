/**
 * Unit tests for the pure-logic and DB-touching functions in MemoryService.
 *
 * Tested functions:
 *   - MemoryService.shouldEnableMemoryCreation(chatState)
 *   - MemoryService.shouldEnableMemoryUpdates(chatState)
 *   - MemoryService.getCreatableMemories(chatState)
 *   - MemoryService.getMemoriesForPrompt(chatState)
 *   - MemoryService.processMessageResultMemories(chatState, result, messageId)
 *
 * Prisma is fully mocked so these tests never hit a real database.
 */

import { MemoryService } from '@/lib/chat/services/memory'
import {
  createTestChatState,
  createTestAgent,
  createTestRound,
  resetIdCounter,
} from '@/__tests__/factories'
import type { ChatState } from '@/lib/chat/types'
import type { MemorySettings } from '@/lib/schemas/prisma-typed'
import { createInitialProgress } from '@/lib/types/chat-progress'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/prisma', () => ({
  prisma: {
    chatMemory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

// Pull the mocked prisma so we can configure return values per-test
import { prisma } from '@/lib/prisma'
const mockedPrisma = prisma as jest.Mocked<typeof prisma>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal MemorySettings with one memory entry */
function buildMemorySettings(
  overrides: Partial<NonNullable<MemorySettings['memories']>[number]>[] = []
): MemorySettings {
  return {
    memories: overrides.length > 0
      ? overrides.map((o, i) => ({
          id: o.id ?? `mem-${i + 1}`,
          name: o.name ?? `Memory ${i + 1}`,
          memorizeRound: o.memorizeRound ?? 'round-1',
          memorizeInstructions: o.memorizeInstructions ?? 'Remember this',
          rememberWhen: o.rememberWhen ?? 'every_round',
          rememberRounds: o.rememberRounds,
          rememberInstructions: o.rememberInstructions,
          rememberWho: o.rememberWho ?? 'every_agent',
          updateEnabled: o.updateEnabled ?? false,
          updateWhen: o.updateWhen ?? 'every_round',
          updateRounds: o.updateRounds,
          updateInstructions: o.updateInstructions,
          updateWho: o.updateWho ?? 'every_agent',
        }))
      : [],
  }
}

function buildProgress(agentId = 'agent-1', mode: 'participant' | 'moderator' = 'participant') {
  const progress = createInitialProgress('round-1', 'api')
  progress.active.agent.id = agentId
  progress.active.agent.mode = mode
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
// shouldEnableMemoryCreation
// =========================================================================

describe('MemoryService.shouldEnableMemoryCreation', () => {
  it('returns false when config is null', () => {
    const state = createTestChatState({ config: null })
    expect(MemoryService.shouldEnableMemoryCreation(state)).toBe(false)
  })

  it('returns false when memorySettings is null', () => {
    const state = createTestChatState()
    // default factory config has memorySettings: null
    expect(MemoryService.shouldEnableMemoryCreation(state)).toBe(false)
  })

  it('returns false when memories array is empty', () => {
    const state = createTestChatState({
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryCreation(state)).toBe(false)
  })

  it('returns true when a memory memorizeRound matches the active round', () => {
    const round = createTestRound({ id: 'round-1' })
    const state = createTestChatState({
      activeRound: round,
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([{ memorizeRound: 'round-1' }]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryCreation(state)).toBe(true)
  })

  it('returns false when no memory memorizeRound matches the active round', () => {
    const round = createTestRound({ id: 'round-1' })
    const state = createTestChatState({
      activeRound: round,
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([{ memorizeRound: 'round-other' }]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryCreation(state)).toBe(false)
  })
})

// =========================================================================
// shouldEnableMemoryUpdates
// =========================================================================

describe('MemoryService.shouldEnableMemoryUpdates', () => {
  it('returns false when config is null', () => {
    const state = createTestChatState({ config: null })
    expect(MemoryService.shouldEnableMemoryUpdates(state)).toBe(false)
  })

  it('returns false when memorySettings is null', () => {
    const state = createTestChatState()
    expect(MemoryService.shouldEnableMemoryUpdates(state)).toBe(false)
  })

  it('returns false when memories array is empty', () => {
    const state = createTestChatState({
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryUpdates(state)).toBe(false)
  })

  it('returns true when updateEnabled and updateWhen is every_round', () => {
    const round = createTestRound({ id: 'round-1' })
    const state = createTestChatState({
      activeRound: round,
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { updateEnabled: true, updateWhen: 'every_round' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryUpdates(state)).toBe(true)
  })

  it('returns true when updateEnabled and updateWhen is specific_rounds matching current round', () => {
    const round = createTestRound({ id: 'round-1' })
    const state = createTestChatState({
      activeRound: round,
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            updateEnabled: true,
            updateWhen: 'specific_rounds',
            updateRounds: [{ roundId: 'round-1', instructions: 'update it' }],
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryUpdates(state)).toBe(true)
  })

  it('returns false when updateEnabled but specific_rounds does not match', () => {
    const round = createTestRound({ id: 'round-1' })
    const state = createTestChatState({
      activeRound: round,
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            updateEnabled: true,
            updateWhen: 'specific_rounds',
            updateRounds: [{ roundId: 'round-other', instructions: 'nope' }],
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryUpdates(state)).toBe(false)
  })

  it('returns false when updateEnabled is false even if rounds match', () => {
    const round = createTestRound({ id: 'round-1' })
    const state = createTestChatState({
      activeRound: round,
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { updateEnabled: false, updateWhen: 'every_round' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })
    expect(MemoryService.shouldEnableMemoryUpdates(state)).toBe(false)
  })
})

// =========================================================================
// getCreatableMemories
// =========================================================================

describe('MemoryService.getCreatableMemories', () => {
  it('returns empty array when config is null', async () => {
    const state = createTestChatState({ config: null, progress: buildProgress() })
    const result = await MemoryService.getCreatableMemories(state)
    expect(result).toEqual([])
  })

  it('returns empty array when memorySettings is null', async () => {
    const state = createTestChatState({ progress: buildProgress() })
    const result = await MemoryService.getCreatableMemories(state)
    expect(result).toEqual([])
  })

  it('returns matching memories when memorizeRound matches and no existing memory', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });
    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue(null)

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1', name: 'My Memory' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = await MemoryService.getCreatableMemories(state)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('mem-1')
    expect(result[0].name).toBe('My Memory')
  })

  it('excludes memories that already exist in the database', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });
    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-memory',
      content: 'already stored',
    })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = await MemoryService.getCreatableMemories(state)
    expect(result).toHaveLength(0)
  })

  it('filters out memories whose memorizeRound does not match', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });
    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue(null)

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-other' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = await MemoryService.getCreatableMemories(state)
    expect(result).toHaveLength(0)
  })

  it('queries with createdByAgentId when rememberWho is original_agent', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });
    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue(null)

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1', rememberWho: 'original_agent' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    await MemoryService.getCreatableMemories(state)

    expect(mockedPrisma.chatMemory.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        createdByAgentId: 'agent-1',
      }),
    })
  })
})

// =========================================================================
// getMemoriesForPrompt
// =========================================================================

describe('MemoryService.getMemoriesForPrompt', () => {
  it('returns empty array when config is null', async () => {
    const state = createTestChatState({
      config: null,
      progress: buildProgress(),
    })
    const result = await MemoryService.getMemoriesForPrompt(state)
    expect(result).toEqual([])
  })

  it('returns empty array when memorySettings is null', async () => {
    const state = createTestChatState({ progress: buildProgress() })
    const result = await MemoryService.getMemoriesForPrompt(state)
    expect(result).toEqual([])
  })

  it('returns formatted memories for every_round rememberWhen', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue({
      id: 'rec-1',
      content: 'The user prefers blue.',
      version: 1,
    })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            id: 'mem-1',
            name: 'User Prefs',
            memorizeRound: 'round-0',
            rememberWhen: 'every_round',
            rememberWho: 'every_agent',
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = await MemoryService.getMemoriesForPrompt(state)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('[MEMORY: User Prefs]')
    expect(result[0]).toContain('The user prefers blue.')
  })

  it('returns formatted memories for specific_rounds matching current round', async () => {
    const round = createTestRound({ id: 'round-2' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue({
      id: 'rec-2',
      content: 'Summary from round 1',
      version: 1,
    })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            id: 'mem-1',
            name: 'Round 1 Summary',
            memorizeRound: 'round-1',
            rememberWhen: 'specific_rounds',
            rememberRounds: [{ roundId: 'round-2', instructions: 'Use this context' }],
            rememberWho: 'every_agent',
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = await MemoryService.getMemoriesForPrompt(state)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('[MEMORY: Round 1 Summary]')
    expect(result[0]).toContain('Instructions: Use this context')
    expect(result[0]).toContain('Summary from round 1')
  })

  it('filters memories by specific_rounds - does not include non-matching rounds', async () => {
    const round = createTestRound({ id: 'round-3' })
    const agent = createTestAgent({ id: 'agent-1' })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            id: 'mem-1',
            name: 'Restricted',
            memorizeRound: 'round-1',
            rememberWhen: 'specific_rounds',
            rememberRounds: [{ roundId: 'round-2', instructions: 'only round 2' }],
            rememberWho: 'every_agent',
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = await MemoryService.getMemoriesForPrompt(state)
    expect(result).toHaveLength(0)
    // prisma should not have been called at all (no relevant memories)
    expect(mockedPrisma.chatMemory.findFirst).not.toHaveBeenCalled()
  })

  it('respects rememberWho: original_agent by including createdByAgentId in query', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue(null)

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            id: 'mem-1',
            name: 'Private Memory',
            memorizeRound: 'round-0',
            rememberWhen: 'every_round',
            rememberWho: 'original_agent',
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    await MemoryService.getMemoriesForPrompt(state)

    expect(mockedPrisma.chatMemory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdByAgentId: 'agent-1',
        }),
      })
    )
  })

  it('does not include createdByAgentId when rememberWho is every_agent', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue(null)

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            id: 'mem-1',
            name: 'Public Memory',
            memorizeRound: 'round-0',
            rememberWhen: 'every_round',
            rememberWho: 'every_agent',
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    await MemoryService.getMemoriesForPrompt(state)

    expect(mockedPrisma.chatMemory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          createdByAgentId: expect.anything(),
        }),
      })
    )
  })

  it('includes rememberInstructions when no round-specific instructions', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue({
      id: 'rec-1',
      content: 'Stored memory content',
      version: 1,
    })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          {
            id: 'mem-1',
            name: 'With Default Instructions',
            memorizeRound: 'round-0',
            rememberWhen: 'every_round',
            rememberInstructions: 'Apply this carefully',
            rememberWho: 'every_agent',
          },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = await MemoryService.getMemoriesForPrompt(state)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Instructions: Apply this carefully')
  })
})

// =========================================================================
// processMessageResultMemories
// =========================================================================

describe('MemoryService.processMessageResultMemories', () => {
  it('returns immediately when result has no tool calls', async () => {
    const state = createTestChatState({ progress: buildProgress() })
    await MemoryService.processMessageResultMemories(state, {}, 'msg-1')
    expect(mockedPrisma.chatMemory.create).not.toHaveBeenCalled()
    expect(mockedPrisma.chatMemory.update).not.toHaveBeenCalled()
  })

  it('returns immediately when result is null/undefined', async () => {
    const state = createTestChatState({ progress: buildProgress() })
    await MemoryService.processMessageResultMemories(state, null, 'msg-1')
    expect(mockedPrisma.chatMemory.create).not.toHaveBeenCalled()
  })

  it('processes createMemory tool calls from top-level toolCalls array', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.create as jest.Mock).mockResolvedValue({ id: 'created-mem' })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1', name: 'Test Memory' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = {
      toolCalls: [
        {
          toolName: 'createMemory',
          input: { memoryName: 'Test Memory', content: 'Important fact' },
          result: {
            memoryOperation: {
              type: 'create',
              memoryName: 'Test Memory',
              content: 'Important fact',
              memoryConfigId: 'mem-1',
            },
          },
        },
      ],
    }

    await MemoryService.processMessageResultMemories(state, result, 'msg-1')
    expect(mockedPrisma.chatMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chatId: 'test-chat-id',
        memoryConfigId: 'mem-1',
        content: 'Important fact',
        messageId: 'msg-1',
      }),
    })
  })

  it('processes updateMemory tool calls from top-level toolCalls array', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-mem',
      version: 1,
    });
    (mockedPrisma.chatMemory.update as jest.Mock).mockResolvedValue({});
    (mockedPrisma.chatMemory.create as jest.Mock).mockResolvedValue({ id: 'updated-mem' })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1', name: 'Test Memory' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = {
      toolCalls: [
        {
          toolName: 'updateMemory',
          input: { memoryName: 'Test Memory', newContent: 'Updated fact' },
          result: {
            memoryOperation: {
              type: 'update',
              memoryName: 'Test Memory',
              content: 'Updated fact',
              memoryConfigId: 'mem-1',
            },
          },
        },
      ],
    }

    await MemoryService.processMessageResultMemories(state, result, 'msg-1')
    // Should deactivate old memory and create new version
    expect(mockedPrisma.chatMemory.update).toHaveBeenCalledWith({
      where: { id: 'existing-mem' },
      data: { isActive: false },
    })
    expect(mockedPrisma.chatMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'Updated fact',
        version: 2,
      }),
    })
  })

  it('processes tool calls constructed from input when result has no memoryOperation', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.create as jest.Mock).mockResolvedValue({ id: 'created-mem' })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1', name: 'Fallback Memory' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    // No memoryOperation in result - should fall back to input-based construction
    const result = {
      toolCalls: [
        {
          toolName: 'createMemory',
          input: { memoryName: 'Fallback Memory', content: 'Fallback content' },
          result: {},
        },
      ],
    }

    await MemoryService.processMessageResultMemories(state, result, 'msg-1')
    expect(mockedPrisma.chatMemory.create).toHaveBeenCalled()
  })

  it('processes memory tool results from steps array', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.create as jest.Mock).mockResolvedValue({ id: 'step-mem' })

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1', name: 'Step Memory' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = {
      toolCalls: [],
      steps: [
        {
          content: [
            {
              type: 'tool-result',
              toolName: 'createMemory',
              output: {
                memoryOperation: {
                  type: 'create',
                  memoryName: 'Step Memory',
                  content: 'From a step',
                  memoryConfigId: 'mem-1',
                },
              },
            },
          ],
        },
      ],
    }

    await MemoryService.processMessageResultMemories(state, result, 'msg-1')
    expect(mockedPrisma.chatMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'From a step',
        memoryConfigId: 'mem-1',
      }),
    })
  })

  it('skips non-memory tool calls in the toolCalls array', async () => {
    const state = createTestChatState({ progress: buildProgress() })

    const result = {
      toolCalls: [
        {
          toolName: 'someOtherTool',
          input: { foo: 'bar' },
          result: { data: 'stuff' },
        },
      ],
    }

    await MemoryService.processMessageResultMemories(state, result, 'msg-1')
    expect(mockedPrisma.chatMemory.create).not.toHaveBeenCalled()
    expect(mockedPrisma.chatMemory.update).not.toHaveBeenCalled()
  })

  it('handles errors in individual tool call processing gracefully', async () => {
    const round = createTestRound({ id: 'round-1' })
    const agent = createTestAgent({ id: 'agent-1' });

    (mockedPrisma.chatMemory.create as jest.Mock).mockRejectedValue(new Error('DB error'))

    const state = createTestChatState({
      activeRound: round,
      activeAgent: agent,
      agents: [agent],
      progress: buildProgress('agent-1'),
      config: {
        id: 'cfg-1',
        title: 'T',
        userId: 'u',
        chatInstructions: null,
        examplePrompts: [],
        retentionSettings: null,
        memorySettings: buildMemorySettings([
          { id: 'mem-1', memorizeRound: 'round-1', name: 'Error Memory' },
        ]),
        designSettings: null,
        spaceId: null,
        previewChatId: null,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    })

    const result = {
      toolCalls: [
        {
          toolName: 'createMemory',
          input: { memoryName: 'Error Memory', content: 'will fail' },
          result: {
            memoryOperation: {
              type: 'create',
              memoryName: 'Error Memory',
              content: 'will fail',
              memoryConfigId: 'mem-1',
            },
          },
        },
      ],
    }

    // Should not throw
    await expect(
      MemoryService.processMessageResultMemories(state, result, 'msg-1')
    ).resolves.not.toThrow()
  })
})
