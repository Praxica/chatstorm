/**
 * Unit tests for BatchService concurrency control and chat chaining.
 *
 * These tests verify that:
 *   1. startBatch() respects the concurrency limit for initial chat starts
 *   2. updateBatchChatStatus() correctly chains the next chat on completion
 *   3. Batches larger than the concurrency limit (>5) eventually start all chats
 *   4. Race conditions when multiple chats complete simultaneously are handled
 *   5. Duplicate chats are not created when concurrent completions race
 *
 * All external dependencies (Prisma, ChatEngine, ChatService, etc.) are mocked.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports due to jest.mock hoisting
// ---------------------------------------------------------------------------

jest.mock('@/lib/prisma', () => ({
  prisma: {
    chatBatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    batchChat: {
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    config: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(require('@/lib/prisma').prisma)),
  },
}))

jest.mock('@/lib/chat/ChatEngine', () => ({
  ChatEngine: {
    createState: jest.fn(() => ({
      chat: { id: 'chat-1', persistenceMode: 'save', generationMode: 'text', branchId: 'branch-1', activeBranchPath: [] },
      messages: [],
      progress: {},
      rounds: [],
      agents: [],
      sessions: [],
    })),
    initialize: jest.fn(async (state: any) => ({
      ...state,
      rounds: [{ id: 'round-1', sequence: 0 }],
      progress: { active: { round: { id: 'round-1' }, step: 'user' }, next: { round: null } },
    })),
    generateChat: jest.fn(async (state: any) => ({
      nextChatState: {
        ...state,
        rounds: [{ id: 'round-1', sequence: 0 }],
        progress: { active: { round: { id: 'round-1' }, step: 'user' }, next: { round: null } },
      },
    })),
  },
}))

jest.mock('@/lib/services/ChatService', () => ({
  ChatService: {
    createInitialChat: jest.fn(async () => ({
      id: `chat-${Date.now()}`,
      activeBranch: 'branch-1',
      activeBranchPath: [],
    })),
  },
}))

jest.mock('@/lib/chat/services/messages', () => ({
  MessageServices: {
    saveChatMessage: jest.fn(async () => ({})),
  },
}))

jest.mock('@/lib/chat/services/progress', () => ({
  createInitialProgress: jest.fn(() => ({
    active: { round: { id: 'round-1' }, step: 'user' },
    next: { round: null },
  })),
}))

jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn(() => ({})),
}))

// Import after mocks are declared
import { BatchService } from '@/lib/services/BatchService'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as any

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBatch(overrides: Record<string, any> = {}) {
  return {
    id: 'batch-1',
    configId: 'config-1',
    userId: 'user-1',
    name: 'Test Batch',
    totalChats: 5,
    completedChats: 0,
    status: 'RUNNING',
    batchMode: 'count',
    roundMessages: [{ chatRoundId: 'round-1', content: 'Hello', type: 'manual', sequence: 0, roundMessageId: 'rm-1' }],
    variableData: null,
    batchChats: [],
    config: { id: 'config-1', rounds: [{ id: 'round-1' }] },
    ...overrides,
  }
}

function createMockBatchChat(overrides: Record<string, any> = {}) {
  return {
    id: 'batch-chat-1',
    batchId: 'batch-1',
    chatId: 'chat-1',
    status: 'RUNNING',
    batch: createMockBatch(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BatchService', () => {
  let service: BatchService

  beforeEach(() => {
    jest.clearAllMocks()
    BatchService.resetTrackers()
    service = new BatchService()

    // Default prisma mock behavior
    mockPrisma.config.findUnique.mockResolvedValue({
      id: 'config-1',
      rounds: [{ id: 'round-1' }],
    })
  })

  // =========================================================================
  // startBatch — concurrency limit
  // =========================================================================
  describe('startBatch()', () => {
    it('starts exactly concurrencyLimit (5) chats when totalChats > 5', async () => {
      const batch = createMockBatch({ totalChats: 10, batchChats: [] })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)
      mockPrisma.batchChat.count.mockResolvedValue(0)
      mockPrisma.batchChat.create.mockImplementation(async ({ data }: any) => ({
        id: `bc-${Date.now()}-${Math.random()}`,
        ...data,
        status: 'RUNNING',
      }))

      // Spy on startBatchChat to count how many times it's called
      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null) // Don't actually run chat logic

      await service.startBatch('batch-1')

      // Should start exactly 5 chats (the concurrency limit), not all 10
      expect(startBatchChatSpy).toHaveBeenCalledTimes(5)

      startBatchChatSpy.mockRestore()
    })

    it('starts all chats when totalChats <= concurrencyLimit', async () => {
      const batch = createMockBatch({ totalChats: 3, batchChats: [] })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.startBatch('batch-1')

      expect(startBatchChatSpy).toHaveBeenCalledTimes(3)

      startBatchChatSpy.mockRestore()
    })

    it('passes correct sequence numbers to each initial chat', async () => {
      const batch = createMockBatch({ totalChats: 8, batchChats: [] })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.startBatch('batch-1')

      // Verify sequence numbers are 1, 2, 3, 4, 5
      const sequenceNumbers = startBatchChatSpy.mock.calls.map(
        (call) => call[0].sequenceNumber
      )
      expect(sequenceNumbers).toEqual([1, 2, 3, 4, 5])

      startBatchChatSpy.mockRestore()
    })

    it('does not start chats when batch already has enough', async () => {
      // Batch of 5 that already has 5 batchChats created
      const existingChats = Array.from({ length: 5 }, (_, i) => ({
        id: `bc-${i}`,
        status: 'COMPLETED',
      }))
      const batch = createMockBatch({ totalChats: 5, batchChats: existingChats })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.startBatch('batch-1')

      expect(startBatchChatSpy).not.toHaveBeenCalled()

      startBatchChatSpy.mockRestore()
    })
  })

  // =========================================================================
  // updateBatchChatStatus — completion chaining
  // =========================================================================
  describe('updateBatchChatStatus()', () => {
    it('starts next chat when one completes and more remain', async () => {
      // Batch of 8: 5 created so far, 1 just completed
      const batchChat = createMockBatchChat({
        batch: createMockBatch({ totalChats: 8, completedChats: 0 }),
      })
      mockPrisma.batchChat.findUnique.mockResolvedValue(batchChat)
      mockPrisma.batchChat.update.mockResolvedValue(batchChat)
      mockPrisma.chatBatch.update.mockResolvedValue({
        ...batchChat.batch,
        completedChats: 1,
      })
      // After this completion, there are 5 batchChats total, need 8
      mockPrisma.chatBatch.findUnique.mockResolvedValue({
        ...batchChat.batch,
        completedChats: 1,
        _count: { batchChats: 5 },
      })

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.updateBatchChatStatus('batch-chat-1', 'COMPLETED' as any)

      // Should start the next chat (chat #6)
      expect(startBatchChatSpy).toHaveBeenCalledTimes(1)
      expect(startBatchChatSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: 'batch-1',
          sequenceNumber: 6,
        })
      )

      startBatchChatSpy.mockRestore()
    })

    it('marks batch COMPLETED when all chats are done', async () => {
      // Batch of 6: this is the last chat completing
      const batchChat = createMockBatchChat({
        batch: createMockBatch({ totalChats: 6, completedChats: 5 }),
      })
      mockPrisma.batchChat.findUnique.mockResolvedValue(batchChat)
      mockPrisma.batchChat.update.mockResolvedValue(batchChat)
      // After atomic increment, completedChats = 6 = totalChats
      mockPrisma.chatBatch.update.mockResolvedValue({
        ...batchChat.batch,
        completedChats: 6,
        totalChats: 6,
      })

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.updateBatchChatStatus('batch-chat-1', 'COMPLETED' as any)

      // Should NOT start any new chats
      expect(startBatchChatSpy).not.toHaveBeenCalled()

      // Should mark batch as COMPLETED
      expect(mockPrisma.chatBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'COMPLETED' },
        })
      )

      startBatchChatSpy.mockRestore()
    })

    it('does not start chats when all have already been created', async () => {
      // Batch of 6: all 6 batchChats exist, but only 3 completed so far
      const batchChat = createMockBatchChat({
        batch: createMockBatch({ totalChats: 6, completedChats: 2 }),
      })
      mockPrisma.batchChat.findUnique.mockResolvedValue(batchChat)
      mockPrisma.batchChat.update.mockResolvedValue(batchChat)
      mockPrisma.chatBatch.update.mockResolvedValue({
        ...batchChat.batch,
        completedChats: 3,
      })
      // All 6 batchChats already created
      mockPrisma.chatBatch.findUnique.mockResolvedValue({
        ...batchChat.batch,
        completedChats: 3,
        _count: { batchChats: 6 },
      })

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.updateBatchChatStatus('batch-chat-1', 'COMPLETED' as any)

      // Should NOT start new chats since all 6 already created
      expect(startBatchChatSpy).not.toHaveBeenCalled()

      startBatchChatSpy.mockRestore()
    })

    it('chains next chat even when a chat fails (not just completes)', async () => {
      const batchChat = createMockBatchChat({
        batch: createMockBatch({ totalChats: 8, completedChats: 0 }),
      })
      mockPrisma.batchChat.findUnique.mockResolvedValue(batchChat)
      mockPrisma.batchChat.update.mockResolvedValue(batchChat)
      mockPrisma.chatBatch.update.mockResolvedValue({
        ...batchChat.batch,
        completedChats: 1,
      })
      mockPrisma.chatBatch.findUnique.mockResolvedValue({
        ...batchChat.batch,
        completedChats: 1,
        _count: { batchChats: 5 },
      })

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.updateBatchChatStatus('batch-chat-1', 'FAILED' as any)

      // Should still start next chat even on failure
      expect(startBatchChatSpy).toHaveBeenCalledTimes(1)

      startBatchChatSpy.mockRestore()
    })
  })

  // =========================================================================
  // Race condition: multiple concurrent completions
  // =========================================================================
  describe('concurrent completions (race condition)', () => {
    it('does not create duplicate chats when multiple complete simultaneously', async () => {
      /**
       * Scenario: Batch of 6, all 5 initial chats complete at the same time.
       * Each calls updateBatchChatStatus concurrently.
       * Only ONE new chat (#6) should be started total, not 5.
       *
       * This test simulates the race by calling updateBatchChatStatus 5 times
       * concurrently and checking the total number of startBatchChat calls.
       */
      const startedChats: string[] = []

      // Each concurrent call reads the DB state — simulate the race where
      // they all see the same count before any new chat is created
      let batchChatCallCount = 0
      mockPrisma.batchChat.findUnique.mockImplementation(async () => {
        return createMockBatchChat({
          id: `bc-completing-${++batchChatCallCount}`,
          batch: createMockBatch({ totalChats: 6, completedChats: 0 }),
        })
      })
      mockPrisma.batchChat.update.mockResolvedValue({})

      // Simulate atomic increment — each call gets a different completedChats value
      let completedCounter = 0
      mockPrisma.chatBatch.update.mockImplementation(async ({ data }: any) => {
        if (data?.completedChats?.increment) {
          completedCounter++
          return {
            ...createMockBatch({ totalChats: 6 }),
            completedChats: completedCounter,
          }
        }
        return createMockBatch({ totalChats: 6 })
      })

      // The _count read — this is where the race matters.
      // All 5 concurrent reads happen before any new batchChat is created,
      // so they ALL see count=5
      mockPrisma.chatBatch.findUnique.mockResolvedValue({
        ...createMockBatch({ totalChats: 6 }),
        status: 'RUNNING',
        _count: { batchChats: 5 },
      })

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockImplementation(async (params) => {
          startedChats.push(`chat-${params.sequenceNumber}`)
          return null
        })

      // Fire 5 concurrent completions
      const completionPromises = Array.from({ length: 5 }, (_, i) =>
        service.updateBatchChatStatus(`bc-${i}`, 'COMPLETED' as any)
      )
      await Promise.all(completionPromises)

      // FIXED: The in-memory tracker prevents duplicate starts.
      // All 5 concurrent completions synchronously check the tracker,
      // and only the first one gets to claim the slot for chat #6.
      expect(startBatchChatSpy).toHaveBeenCalledTimes(1)
      expect(startBatchChatSpy.mock.calls[0][0].sequenceNumber).toBe(6)

      startBatchChatSpy.mockRestore()
    })

    it('should start exactly 1 new chat when multiple complete simultaneously [EXPECTED FIX]', async () => {
      /**
       * This is the DESIRED behavior after the fix.
       * Currently marked as failing to drive TDD.
       */
      let batchChatCallCount = 0
      mockPrisma.batchChat.findUnique.mockImplementation(async () => {
        return createMockBatchChat({
          id: `bc-completing-${++batchChatCallCount}`,
          batch: createMockBatch({ totalChats: 6, completedChats: 0 }),
        })
      })
      mockPrisma.batchChat.update.mockResolvedValue({})

      let completedCounter = 0
      mockPrisma.chatBatch.update.mockImplementation(async ({ data }: any) => {
        if (data?.completedChats?.increment) {
          completedCounter++
          return {
            ...createMockBatch({ totalChats: 6 }),
            completedChats: completedCounter,
          }
        }
        return createMockBatch({ totalChats: 6 })
      })

      // All concurrent reads see count=5
      mockPrisma.chatBatch.findUnique.mockResolvedValue({
        ...createMockBatch({ totalChats: 6 }),
        status: 'RUNNING',
        _count: { batchChats: 5 },
      })

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      // Fire 5 concurrent completions
      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          service.updateBatchChatStatus(`bc-${i}`, 'COMPLETED' as any)
        )
      )

      // DESIRED: exactly 1 new chat should be started
      // This test will FAIL until the race condition is fixed
      expect(startBatchChatSpy).toHaveBeenCalledTimes(1)

      startBatchChatSpy.mockRestore()
    })
  })

  // =========================================================================
  // startBatchChat — duplicate prevention guard
  // =========================================================================
  describe('startBatchChat()', () => {
    it('refuses to create chat when count >= totalChats', async () => {
      mockPrisma.chatBatch.findUnique.mockResolvedValue(
        createMockBatch({ totalChats: 6, status: 'RUNNING' })
      )
      // Already 6 batchChats exist
      mockPrisma.batchChat.count.mockResolvedValue(6)

      const result = await service.startBatchChat({
        batchId: 'batch-1',
        configId: 'config-1',
        userId: 'user-1',
        sequenceNumber: 7,
      })

      expect(result).toBeNull()
      // Should NOT have tried to create a chat
      expect(mockPrisma.batchChat.create).not.toHaveBeenCalled()
    })

    it('allows creating chat when count < totalChats', async () => {
      mockPrisma.chatBatch.findUnique.mockResolvedValue(
        createMockBatch({ totalChats: 6, status: 'RUNNING' })
      )
      mockPrisma.batchChat.count.mockResolvedValue(5) // 5 < 6, one more allowed
      mockPrisma.batchChat.create.mockResolvedValue({
        id: 'bc-new',
        batchId: 'batch-1',
        chatId: 'chat-new',
        status: 'RUNNING',
      })

      const result = await service.startBatchChat({
        batchId: 'batch-1',
        configId: 'config-1',
        userId: 'user-1',
        sequenceNumber: 6,
      })

      expect(result).not.toBeNull()
    })

    it('returns null when batch is cancelled', async () => {
      mockPrisma.chatBatch.findUnique.mockResolvedValue(
        createMockBatch({ status: 'CANCELLED' })
      )

      const result = await service.startBatchChat({
        batchId: 'batch-1',
        configId: 'config-1',
        userId: 'user-1',
      })

      expect(result).toBeNull()
    })
  })

  // =========================================================================
  // End-to-end batch lifecycle with >5 chats
  // =========================================================================
  describe('batch lifecycle with >5 chats', () => {
    it('tracks that batch of 6 requires chaining beyond initial concurrency limit', async () => {
      const batch = createMockBatch({ totalChats: 6, batchChats: [] })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.startBatch('batch-1')

      // Initial burst: 5 chats (not 6)
      expect(startBatchChatSpy).toHaveBeenCalledTimes(5)

      // The 6th chat must come from updateBatchChatStatus chaining.
      // This verifies the design requires chaining for batches > 5.
      const maxSequenceStarted = Math.max(
        ...startBatchChatSpy.mock.calls.map(c => c[0].sequenceNumber ?? 0)
      )
      expect(maxSequenceStarted).toBe(5) // Only 1-5 started, #6 needs chaining

      startBatchChatSpy.mockRestore()
    })

    it('correctly calculates remaining chats when some already exist', async () => {
      // Batch of 10 that was partially started (e.g., after a restart)
      const existingChats = Array.from({ length: 3 }, (_, i) => ({
        id: `bc-${i}`,
        status: 'COMPLETED',
      }))
      const batch = createMockBatch({ totalChats: 10, batchChats: existingChats })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)

      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockResolvedValue(null)

      await service.startBatch('batch-1')

      // 10 total - 3 existing = 7 remaining, but capped at concurrencyLimit=5
      expect(startBatchChatSpy).toHaveBeenCalledTimes(5)

      // Sequence numbers should continue from existing: 4, 5, 6, 7, 8
      const sequenceNumbers = startBatchChatSpy.mock.calls.map(c => c[0].sequenceNumber)
      expect(sequenceNumbers).toEqual([4, 5, 6, 7, 8])

      startBatchChatSpy.mockRestore()
    })
  })

  // =========================================================================
  // Regression: "batch stops midway" — all chats must eventually run
  // =========================================================================
  describe('batch stops midway regression', () => {
    it('starts all 10 unique chats when all 5 initial chats complete simultaneously', async () => {
      /**
       * Reproduces the reported bug: batch of 10, first 5 complete at the
       * same time, and chats #7-10 never start because the race causes
       * 5 duplicate copies of chat #6 (inflating _count to 10).
       *
       * After the fix, each completion claims a unique slot synchronously,
       * so we get chats #6-#10 with unique sequence numbers.
       */

      // --- Phase 1: startBatch creates the tracker and fires 5 initial chats ---
      const batch = createMockBatch({ id: 'batch-regression', totalChats: 10, batchChats: [] })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)

      const allCalls: Array<{ sequenceNumber: number }> = []
      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockImplementation(async (params) => {
          allCalls.push({ sequenceNumber: params.sequenceNumber! })
          return null
        })

      await service.startBatch('batch-regression')
      expect(allCalls).toHaveLength(5) // chats 1-5

      // --- Phase 2: all 5 complete simultaneously ---
      // Re-mock prisma for the updateBatchChatStatus path
      let completedCounter = 0
      mockPrisma.batchChat.findUnique.mockImplementation(async ({ where }: any) => ({
        id: where.id,
        batchId: 'batch-regression',
        chatId: `chat-${where.id}`,
        status: 'RUNNING',
        batch: { ...batch, status: 'RUNNING' },
      }))
      mockPrisma.batchChat.update.mockResolvedValue({})
      mockPrisma.chatBatch.update.mockImplementation(async ({ data }: any) => {
        if (data?.completedChats?.increment) {
          completedCounter++
          return { ...batch, completedChats: completedCounter }
        }
        return batch
      })

      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          service.updateBatchChatStatus(`bc-${i}`, 'COMPLETED' as any)
        )
      )

      // --- Assertions ---
      // Total: 5 initial + 5 chained = 10
      expect(allCalls).toHaveLength(10)

      // Every sequence number from 1 to 10 must appear exactly once
      const seqNums = allCalls.map(c => c.sequenceNumber).sort((a, b) => a - b)
      expect(seqNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

      // No duplicates
      expect(new Set(seqNums).size).toBe(10)

      startBatchChatSpy.mockRestore()
    })

    it('starts all 6 unique chats when all 5 initial chats complete simultaneously', async () => {
      /**
       * Batch of 6 variant: 5 complete at once, only 1 more should start.
       * With the old bug, 5 copies of chat #6 would be created.
       */
      const batch = createMockBatch({ id: 'batch-6-reg', totalChats: 6, batchChats: [] })
      mockPrisma.chatBatch.findUnique.mockResolvedValue(batch)
      mockPrisma.chatBatch.update.mockResolvedValue(batch)

      const allCalls: Array<{ sequenceNumber: number }> = []
      const startBatchChatSpy = jest.spyOn(service, 'startBatchChat')
        .mockImplementation(async (params) => {
          allCalls.push({ sequenceNumber: params.sequenceNumber! })
          return null
        })

      await service.startBatch('batch-6-reg')
      expect(allCalls).toHaveLength(5) // chats 1-5

      let completedCounter = 0
      mockPrisma.batchChat.findUnique.mockImplementation(async ({ where }: any) => ({
        id: where.id,
        batchId: 'batch-6-reg',
        chatId: `chat-${where.id}`,
        status: 'RUNNING',
        batch: { ...batch, status: 'RUNNING' },
      }))
      mockPrisma.batchChat.update.mockResolvedValue({})
      mockPrisma.chatBatch.update.mockImplementation(async ({ data }: any) => {
        if (data?.completedChats?.increment) {
          completedCounter++
          return { ...batch, completedChats: completedCounter }
        }
        return batch
      })

      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          service.updateBatchChatStatus(`bc-${i}`, 'COMPLETED' as any)
        )
      )

      // Total: 5 initial + 1 chained = 6 (NOT 5 + 5 duplicates)
      expect(allCalls).toHaveLength(6)

      const seqNums = allCalls.map(c => c.sequenceNumber).sort((a, b) => a - b)
      expect(seqNums).toEqual([1, 2, 3, 4, 5, 6])
      expect(new Set(seqNums).size).toBe(6) // no duplicates

      startBatchChatSpy.mockRestore()
    })
  })
})
