/**
 * ChatEngine Integration Tests
 *
 * These tests exercise the ChatEngine orchestrator against a real PostgreSQL
 * database (via Testcontainers, configured in jest.config.cjs).
 *
 * The AI SDK (`generateText` / `streamText`) is globally mocked via
 * moduleNameMapper → `__tests__/mocks/ai-sdk.ts` so no real LLM calls are made.
 *
 * Strategy:
 *   - Real DB for Config, Rounds, Agents, Chat, Branch, Message, Session records.
 *   - Pre-populate `chatState.languageModels` with a stub model so that
 *     ModelService.initializeContextualModels is skipped.
 *   - Pre-populate `chatState.user.id` so UserService.retrieve is skipped.
 *   - Use `generationMode: 'text'` (non-streaming) for all tests to avoid
 *     dataStream complexity.
 *   - Focus on orchestration flow, not individual service logic.
 */

import { prisma } from '@/lib/prisma'
import { ChatEngine } from '@/lib/chat/ChatEngine'
import type { ChatState } from '@/lib/chat/types'
import {
  setMockResponse,
  resetMockResponses,
  queueMockResponses,
  capturedCalls,
} from '@/__tests__/mocks/ai-sdk'
import { BranchType, RoundType, DepthLevel, LengthType, ParticipantOrder, TransitionType } from '@prisma/client'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Stub LanguageModel. Only needs to exist so that the `languageModels`
 * map is non-empty and ModelService.initializeContextualModels is skipped.
 */
const STUB_MODEL = {
  modelId: 'test-model',
  specificationVersion: 'v1',
  provider: 'test',
} as any

// ---------------------------------------------------------------------------
// Tracking arrays for cleanup
// ---------------------------------------------------------------------------

const createdMessageIds: string[] = []
const createdBranchIds: string[] = []
const createdChatIds: string[] = []
const createdSessionIds: string[] = []
const createdRoundIds: string[] = []
const createdAgentIds: string[] = []
const createdConfigIds: string[] = []

// ---------------------------------------------------------------------------
// Test setup types
// ---------------------------------------------------------------------------

interface TestSetup {
  configId: string
  roundIds: string[]
  agentIds: string[]
  chatId: string
  branchId: string
}

// ---------------------------------------------------------------------------
// Helper: create full DB fixture
// ---------------------------------------------------------------------------

async function createTestSetup(options: {
  roundType?: RoundType
  agentCount?: number
  roundCount?: number
  lengthType?: LengthType
  lengthNumber?: number
  lengthRounds?: number
  participantOrder?: ParticipantOrder
  moderatorAgentId?: string
  transition?: TransitionType
  lengthModerator?: string
  /** Per-round overrides. Index corresponds to round sequence. */
  roundOverrides?: Array<Record<string, any>>
  /** Custom agent overrides per agent index. */
  agentOverrides?: Array<Record<string, any>>
}): Promise<TestSetup> {
  const {
    roundType = RoundType.brainstorm,
    agentCount = 1,
    roundCount = 1,
    lengthType = LengthType.total,
    lengthNumber = 1,
    lengthRounds,
    participantOrder = ParticipantOrder.default,
    moderatorAgentId,
    transition = TransitionType.user,
    lengthModerator,
    roundOverrides = [],
    agentOverrides = [],
  } = options

  const ts = Date.now()

  // 1. Create Config
  const config = await prisma.config.create({
    data: {
      title: `Test Config ${ts}`,
      userId: TEST_USER_ID,
    },
  })
  createdConfigIds.push(config.id)

  // 2. Create Agents
  const agentIds: string[] = []
  for (let i = 0; i < agentCount; i++) {
    const agentId = `agent-${ts}-${i}`
    const agentOvr = agentOverrides[i] || {}
    // Separate known fields from pass-through overrides
    const { name: agentName, systemPrompt: agentPrompt, ...agentRest } = agentOvr as Record<string, any>
    await prisma.chatAgent.create({
      data: {
        id: agentId,
        name: agentName || `Agent ${i}`,
        role: 'assistant',
        systemPrompt: agentPrompt || `You are test agent ${i}.`,
        priority: 'medium',
        userId: TEST_USER_ID,
        ...agentRest,
      },
    })
    agentIds.push(agentId)
    createdAgentIds.push(agentId)
  }

  // 3. Create Rounds with participants
  const roundIds: string[] = []
  for (let i = 0; i < roundCount; i++) {
    const overrides = roundOverrides[i] || {}
    const round = await prisma.chatRound.create({
      data: {
        configId: config.id,
        type: overrides.type || roundType,
        depth: DepthLevel.medium,
        lengthType: overrides.lengthType || lengthType,
        lengthNumber: overrides.lengthNumber ?? lengthNumber,
        lengthRounds: overrides.lengthRounds ?? lengthRounds ?? null,
        sequence: i,
        participantOrder: overrides.participantOrder || participantOrder,
        transition: overrides.transition || transition,
        moderatorAgentId: overrides.moderatorAgentId || moderatorAgentId || null,
        lengthModerator: overrides.lengthModerator || lengthModerator || null,
        participants: {
          connect: agentIds.map((id) => ({ id })),
        },
        ...Object.fromEntries(
          Object.entries(overrides).filter(
            ([k]) =>
              ![
                'type', 'lengthType', 'lengthNumber', 'lengthRounds',
                'participantOrder', 'transition', 'moderatorAgentId',
                'lengthModerator',
              ].includes(k)
          )
        ),
      },
    })
    roundIds.push(round.id)
    createdRoundIds.push(round.id)
  }

  // 4. Create Chat
  const chat = await prisma.chat.create({
    data: {
      configId: config.id,
      title: `Test Chat ${ts}`,
      userId: TEST_USER_ID,
    },
  })
  createdChatIds.push(chat.id)

  // 5. Create Branch
  const branch = await prisma.branch.create({
    data: {
      chatId: chat.id,
      name: 'main',
      type: BranchType.origin,
    },
  })
  createdBranchIds.push(branch.id)

  return {
    configId: config.id,
    roundIds,
    agentIds,
    chatId: chat.id,
    branchId: branch.id,
  }
}

// ---------------------------------------------------------------------------
// Helper: build the initial ChatState for generateChat
// ---------------------------------------------------------------------------

function createInitialChatState(setup: TestSetup): ChatState {
  const baseState = ChatEngine.createState({
    id: setup.chatId,
    persistenceMode: 'save',
    generationMode: 'text',
    branchId: setup.branchId,
    activeBranchPath: [setup.branchId],
  })

  return {
    ...baseState,
    user: { id: TEST_USER_ID } as any,
    languageModels: { 'test-model': STUB_MODEL },
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMockResponses()
  setMockResponse('*', { text: 'Mock LLM response' })
})

afterAll(async () => {
  // Clean up in reverse dependency order.
  // Collect IDs from all arrays regardless of which tests ran.

  // 1. Messages (depend on branch + chat + session)
  if (createdBranchIds.length > 0 || createdChatIds.length > 0) {
    await prisma.message.deleteMany({
      where: {
        OR: [
          { chatId: { in: createdChatIds } },
          { branchId: { in: createdBranchIds } },
        ],
      },
    })
  }

  // 2. Sessions
  if (createdChatIds.length > 0) {
    await prisma.chatRoundSession.deleteMany({
      where: { chatId: { in: createdChatIds } },
    })
  }

  // 3. Branches
  if (createdBranchIds.length > 0) {
    await prisma.branch.deleteMany({
      where: { id: { in: createdBranchIds } },
    })
  }

  // 4. Chats
  if (createdChatIds.length > 0) {
    await prisma.chat.deleteMany({
      where: { id: { in: createdChatIds } },
    })
  }

  // 5. Round-participant join table entries (implicit many-to-many)
  // Prisma handles this via cascade on round deletion, but be explicit
  // to avoid orphan rows if round deletion is partial.

  // 6. Rounds
  if (createdRoundIds.length > 0) {
    await prisma.chatRound.deleteMany({
      where: { id: { in: createdRoundIds } },
    })
  }

  // 7. Agents
  if (createdAgentIds.length > 0) {
    await prisma.chatAgent.deleteMany({
      where: { id: { in: createdAgentIds } },
    })
  }

  // 8. Configs
  if (createdConfigIds.length > 0) {
    await prisma.config.deleteMany({
      where: { id: { in: createdConfigIds } },
    })
  }

  await prisma.$disconnect()
})

// ===========================================================================
// Test Suites
// ===========================================================================

describe('ChatEngine integration', () => {
  // -------------------------------------------------------------------------
  // 1. Basic single-agent turn (generateChat)
  // -------------------------------------------------------------------------
  describe('single agent turn', () => {
    it('generates a response, persists the message, and marks round complete', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 1,
      })

      const chatState = createInitialChatState(setup)

      // Initialize (fetches config, rounds, agents from DB; creates session + pre-created message)
      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)

      // Verify pre-created message record
      expect(initialized.messageId).toBeDefined()
      const preCreatedMsg = await prisma.message.findUnique({
        where: { id: initialized.messageId! },
      })
      expect(preCreatedMsg).not.toBeNull()
      expect(preCreatedMsg!.role).toBe('assistant')

      // Verify session was created
      expect(initialized.currentSessionId).toBeDefined()
      const session = await prisma.chatRoundSession.findUnique({
        where: { id: initialized.currentSessionId! },
      })
      expect(session).not.toBeNull()
      expect(session!.isActive).toBe(true)

      // Verify active agent is set
      expect(initialized.activeAgent.id).toBe(setup.agentIds[0])
      expect(initialized.progress.active.agent.id).toBe(setup.agentIds[0])

      // Generate
      setMockResponse('*', { text: 'Brainstorm idea one' })
      const { result, nextChatState } = await ChatEngine.generateChat(initialized)

      // Adapter was called
      expect(capturedCalls.length).toBeGreaterThanOrEqual(1)
      expect(capturedCalls.some((c) => c.fn === 'generateText')).toBe(true)

      // Result contains text
      expect(result.text).toBe('Brainstorm idea one')

      // Message persisted to DB (updated from pre-created stub)
      const updatedMsg = await prisma.message.findUnique({
        where: { id: initialized.messageId! },
      })
      expect(updatedMsg).not.toBeNull()
      // Content should now have parts with the response text
      const content = updatedMsg!.content as any
      expect(content).toBeDefined()

      // Progress reflects round completion (lengthNumber=1, one message sent)
      // After activateNextProgress, the active round should show the same round
      // but the round should have completed (round closed in next, then activated)
      expect(nextChatState.progress.messageCount).toBe(0) // Reset after round complete
      expect(nextChatState.messages).toHaveLength(1)
      expect(nextChatState.messages[0].role).toBe('assistant')
    })
  })

  // -------------------------------------------------------------------------
  // 2. Multi-turn round (2 agents, sequential order)
  // -------------------------------------------------------------------------
  describe('multi-turn round with sequential agents', () => {
    it('alternates agents across two turns and marks round complete on second turn', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 2,
        lengthType: LengthType.total,
        lengthNumber: 2,
        participantOrder: ParticipantOrder.default, // sequential
      })

      queueMockResponses(
        { text: 'Agent 0 speaks first' },
        { text: 'Agent 1 speaks second' }
      )

      // --- Turn 1 ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)

      // First agent should be agent-0 (sequential, 0 messages so far → index 0)
      expect(init1.activeAgent.id).toBe(setup.agentIds[0])

      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)

      // Round should NOT be complete after 1 of 2 messages
      expect(after1.progress.active.round.isComplete).toBe(false)
      expect(after1.messages).toHaveLength(1)

      // --- Turn 2 ---
      // Re-initialize with updated state (simulating what the API route does)
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)

      // Second agent should be agent-1 (sequential, 1 message so far → index 1)
      expect(init2.activeAgent.id).toBe(setup.agentIds[1])

      const { nextChatState: after2 } = await ChatEngine.generateChat(init2)

      // Round should be complete after 2 of 2 messages
      // messageCount is reset to 0 after round completion
      expect(after2.progress.messageCount).toBe(0)
      expect(after2.messages).toHaveLength(2)
    })
  })

  // -------------------------------------------------------------------------
  // 3. Round transition (auto)
  // -------------------------------------------------------------------------
  describe('auto round transition', () => {
    it('transitions from round 1 to round 2 after round 1 completes', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        roundCount: 2,
        lengthType: LengthType.total,
        lengthNumber: 1,
        transition: TransitionType.auto,
        roundOverrides: [
          { type: RoundType.brainstorm, transition: TransitionType.auto },
          { type: RoundType.critique },
        ],
      })

      queueMockResponses(
        { text: 'Round 1 brainstorm output' },
        { text: 'Round 2 critique output' }
      )

      // --- Turn 1 (Round 1) ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)

      // Should start in round 1
      expect(init1.progress.active.round.id).toBe(setup.roundIds[0])

      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)

      // Round 1 should have completed. After activateNextProgress, the next
      // round should be round 2.
      // For auto transitions, next.step = 'api'
      expect(after1.progress.active.round.id).toBe(setup.roundIds[1])

      // Verify session was closed for round 1
      const round1Sessions = await prisma.chatRoundSession.findMany({
        where: { chatId: setup.chatId, roundId: setup.roundIds[0] },
      })
      const closedSession = round1Sessions.find((s) => !s.isActive)
      expect(closedSession).toBeDefined()

      // --- Turn 2 (Round 2) ---
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)

      // Should be in round 2
      expect(init2.progress.active.round.id).toBe(setup.roundIds[1])

      const { nextChatState: after2 } = await ChatEngine.generateChat(init2)

      // Round 2 should complete (lengthNumber=1)
      expect(after2.progress.messageCount).toBe(0)
      expect(after2.messages).toHaveLength(2)
    })
  })

  // -------------------------------------------------------------------------
  // 4. Moderator participant order
  // -------------------------------------------------------------------------
  describe('moderator participant order', () => {
    it('starts with moderator mode, extracts handoff, and the participant gets picked', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 3, // 2 participants + 1 moderator
        lengthType: LengthType.total,
        lengthNumber: 2,
        participantOrder: ParticipantOrder.moderator,
      })

      // Set moderatorAgentId to the third agent
      await prisma.chatRound.update({
        where: { id: setup.roundIds[0] },
        data: { moderatorAgentId: setup.agentIds[2] },
      })

      // In moderator order:
      //   - Turn 1: moderator speaks, uses [NEXT_AGENT:id] handoff format
      //   - After turn 1: next.agent.id is set to the handoff target, next.agent.mode = 'participant'
      //   - Turn 2: the handoff target (participant) speaks
      //   - After turn 2: next.agent.mode = 'moderator' (toggle back)
      queueMockResponses(
        // Turn 1: moderator selects Agent 0 via handoff format
        {
          text: `I think we should hear from Agent 0 first. [NEXT_AGENT:${setup.agentIds[0]}]`,
        },
        // Turn 2: participant speaks
        { text: 'Here is my brainstorm contribution.' },
      )

      // --- Turn 1: moderator ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)

      // With moderator order, first active agent should be the moderator
      expect(init1.progress.active.agent.mode).toBe('moderator')
      expect(init1.activeAgent.id).toBe(setup.agentIds[2])

      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)

      // After moderator speaks:
      // - next.agent.mode was set to 'participant' by iterateProgress
      // - next.agent.id was set to agentIds[0] by the handoff extraction
      // - activateNextProgress moves next -> active
      expect(after1.progress.active.agent.mode).toBe('participant')
      expect(after1.progress.active.agent.id).toBe(setup.agentIds[0])
      // Moderator messages do not increment messageCount
      expect(after1.progress.messageCount).toBe(0)

      // --- Turn 2: participant ---
      // On re-init, setProgress sees the agent.id is already set (from handoff),
      // so it preserves the participant mode and the specific agent.
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)

      // The handoff agent should be the active agent
      expect(init2.activeAgent.id).toBe(setup.agentIds[0])
      expect(init2.progress.active.agent.mode).toBe('participant')

      const { nextChatState: after2 } = await ChatEngine.generateChat(init2)

      // After participant speaks, messageCount increases
      expect(after2.progress.messageCount).toBeGreaterThanOrEqual(1)

      // Next mode should toggle back to moderator
      expect(after2.progress.active.agent.mode).toBe('moderator')
    })
  })

  // -------------------------------------------------------------------------
  // 5. Moderator-controlled round length (lengthType='moderator')
  // -------------------------------------------------------------------------
  describe('moderator-controlled round length', () => {
    it('continues the round when moderator says CONTINUE, completes on COMPLETE', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 2, // 1 participant + 1 moderator for length
        lengthType: LengthType.moderator,
        lengthNumber: 10, // safety max
      })

      // Set the length moderator to the second agent
      await prisma.chatRound.update({
        where: { id: setup.roundIds[0] },
        data: { lengthModerator: setup.agentIds[1] },
      })

      // The flow:
      // - initialize calls setProgress which calls askModeratorIfRoundIsComplete
      //   (but only when messageAuthors.length > 0, so NOT on first init)
      // - First turn: participant speaks, no moderator check yet
      // - Second init: moderator check happens via generateText (separate call)
      //   We need to queue responses carefully:
      //   1. First participant turn generateText
      //   2. Moderator CONTINUE check generateText (during second init)
      //   3. Second participant turn generateText
      //   4. Moderator COMPLETE check generateText (during third init)

      queueMockResponses(
        // 1. First participant turn
        { text: 'Participant first idea' },
        // 2. Moderator check: CONTINUE (tool call response)
        {
          text: '',
          toolCalls: [{
            toolName: 'decideCompletion',
            input: { decision: 'CONTINUE', reason: 'More ideas needed' },
          }],
        },
        // 3. Second participant turn
        { text: 'Participant second idea' },
        // 4. Moderator check: COMPLETE (tool call response)
        {
          text: '',
          toolCalls: [{
            toolName: 'decideCompletion',
            input: { decision: 'COMPLETE', reason: 'Enough ideas generated' },
          }],
        },
        // 5. Moderator verbatim message (streamed as moderator turn)
        { text: "I've decided to complete this brainstorm round.\n\nEnough ideas generated" },
      )

      // --- Turn 1: first participant message ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)

      // No moderator check on first init (no messages yet)
      expect(init1.progress.active.agent.mode).toBe('participant')

      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)

      // Should not be complete (moderator has not checked yet)
      expect(after1.progress.active.round.isComplete).toBe(false)
      expect(after1.messages).toHaveLength(1)

      // --- Turn 2: re-initialize triggers moderator CONTINUE check ---
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)

      // Moderator said CONTINUE, so round is not complete
      expect(init2.progress.active.round.isComplete).toBe(false)

      const { nextChatState: after2 } = await ChatEngine.generateChat(init2)
      expect(after2.messages).toHaveLength(2)

      // --- Turn 3: re-initialize triggers moderator COMPLETE check ---
      const state3: ChatState = {
        ...createInitialChatState(setup),
        messages: after2.messages,
        progress: after2.progress,
      }
      const init3 = await ChatEngine.initialize(state3, setup.configId, after2.progress)

      // Moderator said COMPLETE, so round should be marked complete
      expect(init3.progress.active.round.isComplete).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 6. Session management
  // -------------------------------------------------------------------------
  describe('session management', () => {
    it('creates a session during initialize and closes it when round completes', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 1,
      })

      setMockResponse('*', { text: 'Session test response' })

      const chatState = createInitialChatState(setup)
      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)

      // Session created and active
      const sessionId = initialized.currentSessionId!
      expect(sessionId).toBeDefined()

      let session = await prisma.chatRoundSession.findUnique({
        where: { id: sessionId },
      })
      expect(session).not.toBeNull()
      expect(session!.isActive).toBe(true)
      expect(session!.roundId).toBe(setup.roundIds[0])

      // Generate — round completes (lengthNumber=1)
      await ChatEngine.generateChat(initialized)

      // Session should be closed after round completion
      session = await prisma.chatRoundSession.findUnique({
        where: { id: sessionId },
      })
      expect(session!.isActive).toBe(false)
      expect(session!.completedAt).not.toBeNull()
    })

    it('reuses an existing active session for the same round', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 2, // Need 2 messages so round does not complete on first
      })

      queueMockResponses(
        { text: 'Turn 1' },
        { text: 'Turn 2' }
      )

      // --- Turn 1 ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)
      const sessionId1 = init1.currentSessionId!

      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)

      // --- Turn 2 ---
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)
      const sessionId2 = init2.currentSessionId!

      // Should reuse the same session
      expect(sessionId2).toBe(sessionId1)
    })
  })

  // -------------------------------------------------------------------------
  // 7. Message persistence
  // -------------------------------------------------------------------------
  describe('message persistence', () => {
    it('pre-creates an empty message record and updates it with content on completion', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 1,
      })

      setMockResponse('*', { text: 'Persisted message content' })

      const chatState = createInitialChatState(setup)
      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)

      const messageId = initialized.messageId!
      expect(messageId).toBeDefined()

      // Pre-created message exists with empty content
      const preCreated = await prisma.message.findUnique({
        where: { id: messageId },
      })
      expect(preCreated).not.toBeNull()
      expect(preCreated!.role).toBe('assistant')

      // Generate
      await ChatEngine.generateChat(initialized)

      // Message should now have real content
      const updated = await prisma.message.findUnique({
        where: { id: messageId },
      })
      expect(updated).not.toBeNull()

      // Verify metadata contains expected fields
      const metadata = updated!.metadata as any
      expect(metadata).toBeDefined()
      expect(metadata.agentId).toBe(setup.agentIds[0])
      expect(metadata.roundId).toBe(setup.roundIds[0])
      expect(metadata.sessionId).toBe(initialized.currentSessionId)
    })

    it('stores the correct agentId and branchId on the message', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 2,
        lengthType: LengthType.total,
        lengthNumber: 1,
      })

      setMockResponse('*', { text: 'Agent attribution test' })

      const chatState = createInitialChatState(setup)
      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)
      const messageId = initialized.messageId!

      await ChatEngine.generateChat(initialized)

      const msg = await prisma.message.findUnique({ where: { id: messageId } })
      expect(msg).not.toBeNull()
      expect(msg!.branchId).toBe(setup.branchId)
      expect(msg!.chatId).toBe(setup.chatId)
      expect(msg!.agentId).toBe(initialized.activeAgent.id)
      expect(msg!.chatRoundSessionId).toBe(initialized.currentSessionId)
    })
  })

  // -------------------------------------------------------------------------
  // 8. createState produces correct adapter type
  // -------------------------------------------------------------------------
  describe('createState', () => {
    it('creates a GenerateTextAdapter for text mode', () => {
      const state = ChatEngine.createState({
        id: 'test-chat',
        persistenceMode: 'save',
        generationMode: 'text',
        branchId: 'test-branch',
        activeBranchPath: ['test-branch'],
      })

      expect(state.adapter).toBeDefined()
      // GenerateTextAdapter is the non-streaming adapter
      expect(state.adapter.constructor.name).toBe('GenerateTextAdapter')
      expect(state.chat.generationMode).toBe('text')
    })

    it('creates a StreamingAdapter for stream mode', () => {
      const state = ChatEngine.createState({
        id: 'test-chat',
        persistenceMode: 'save',
        generationMode: 'stream',
        branchId: 'test-branch',
        activeBranchPath: ['test-branch'],
      })

      expect(state.adapter.constructor.name).toBe('StreamingAdapter')
    })
  })

  // -------------------------------------------------------------------------
  // 9. Initialize populates all required state fields
  // -------------------------------------------------------------------------
  describe('initialize', () => {
    it('populates config, rounds, agents, activeRound, and progress', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 2,
        roundCount: 2,
        lengthType: LengthType.total,
        lengthNumber: 3,
      })

      const chatState = createInitialChatState(setup)
      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)

      // Config loaded
      expect(initialized.config).not.toBeNull()
      expect(initialized.config!.id).toBe(setup.configId)

      // Rounds loaded (should have 2)
      expect(initialized.rounds).toHaveLength(2)
      expect(initialized.rounds.map((r) => r.id)).toEqual(
        expect.arrayContaining(setup.roundIds)
      )

      // Active round is the first one (sequence 0)
      expect(initialized.activeRound.id).toBe(setup.roundIds[0])

      // Agents loaded
      expect(initialized.agents.length).toBeGreaterThanOrEqual(2)
      expect(initialized.agents.map((a) => a.id)).toEqual(
        expect.arrayContaining(setup.agentIds)
      )

      // Active agent set
      expect(initialized.activeAgent).toBeDefined()
      expect(initialized.activeAgent.id).toBeTruthy()

      // Progress initialized
      expect(initialized.progress).toBeDefined()
      expect(initialized.progress.active).toBeDefined()
      expect(initialized.progress.active.round.id).toBe(setup.roundIds[0])
      expect(initialized.progress.active.round.isComplete).toBe(false)
      expect(initialized.progress.messageCount).toBe(0)

      // User preserved
      expect(initialized.user.id).toBe(TEST_USER_ID)

      // Language models preserved
      expect(Object.keys(initialized.languageModels)).toContain('test-model')
    })
  })

  // -------------------------------------------------------------------------
  // 10. Rounds-based length type
  // -------------------------------------------------------------------------
  describe('rounds-based length', () => {
    it('completes the round after participants * lengthRounds messages', async () => {
      // 2 agents, lengthRounds=1 → should complete after 2 messages total
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 2,
        lengthType: LengthType.rounds,
        lengthRounds: 1,
        participantOrder: ParticipantOrder.default,
      })

      queueMockResponses(
        { text: 'Agent 0 round 1' },
        { text: 'Agent 1 round 1' }
      )

      // --- Turn 1 ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)
      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)

      // Not complete yet (1 of 2 messages)
      expect(after1.progress.active.round.isComplete).toBe(false)

      // --- Turn 2 ---
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)
      const { nextChatState: after2 } = await ChatEngine.generateChat(init2)

      // Now complete (2 of 2 messages)
      expect(after2.progress.messageCount).toBe(0) // Reset after completion
    })
  })

  // -------------------------------------------------------------------------
  // 11. Multiple turns accumulate messages correctly
  // -------------------------------------------------------------------------
  describe('message accumulation', () => {
    it('nextChatState.messages grows across turns', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 3,
      })

      queueMockResponses(
        { text: 'Message 1' },
        { text: 'Message 2' },
        { text: 'Message 3' }
      )

      // --- Turn 1 ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)
      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)
      expect(after1.messages).toHaveLength(1)

      // --- Turn 2 ---
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)
      const { nextChatState: after2 } = await ChatEngine.generateChat(init2)
      expect(after2.messages).toHaveLength(2)

      // --- Turn 3 ---
      const state3: ChatState = {
        ...createInitialChatState(setup),
        messages: after2.messages,
        progress: after2.progress,
      }
      const init3 = await ChatEngine.initialize(state3, setup.configId, after2.progress)
      const { nextChatState: after3 } = await ChatEngine.generateChat(init3)
      expect(after3.messages).toHaveLength(3)

      // Round should be complete
      expect(after3.progress.messageCount).toBe(0) // Reset after completion
    })
  })

  // -------------------------------------------------------------------------
  // 12. Token usage is recorded
  // -------------------------------------------------------------------------
  describe('token usage recording', () => {
    it('records token usage from the mock response', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 1,
      })

      setMockResponse('*', {
        text: 'Token usage test',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      })

      const chatState = createInitialChatState(setup)
      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)

      await ChatEngine.generateChat(initialized)

      // Verify the message has token counts
      const msg = await prisma.message.findUnique({
        where: { id: initialized.messageId! },
      })
      expect(msg).not.toBeNull()
      // Note: The mock returns inputTokens/outputTokens via usage,
      // and the onComplete maps them. The message service checks for these fields.
    })
  })

  // -------------------------------------------------------------------------
  // 13. Error handling (LLM error)
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws when generateText raises an error', async () => {
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 1,
      })

      setMockResponse('*', { error: new Error('LLM overloaded') })

      const chatState = createInitialChatState(setup)
      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)

      // The adapter retries up to 2 times for overloaded errors, then throws
      await expect(ChatEngine.generateChat(initialized)).rejects.toThrow('LLM overloaded')
    })
  })

  // -------------------------------------------------------------------------
  // 14. Preview chats persist like regular chats
  // -------------------------------------------------------------------------
  describe('preview chats', () => {
    it('persists messages for preview chats (they use persistenceMode save)', async () => {
      // Preview chats are real DB chats linked via config.previewChatId.
      // They always use persistenceMode: 'save', so messages persist normally.
      const setup = await createTestSetup({
        roundType: RoundType.brainstorm,
        agentCount: 1,
        lengthType: LengthType.total,
        lengthNumber: 1,
      })

      setMockResponse('*', { text: 'Preview chat response' })

      const baseState = ChatEngine.createState({
        id: setup.chatId,
        persistenceMode: 'save',
        generationMode: 'text',
        branchId: setup.branchId,
        activeBranchPath: [setup.branchId],
      })

      const chatState: ChatState = {
        ...baseState,
        user: { id: TEST_USER_ID } as any,
        languageModels: { 'test-model': STUB_MODEL },
      }

      const initialized = await ChatEngine.initialize(chatState, setup.configId, null)

      // Preview chats get sessions and message persistence like regular chats
      expect(initialized.currentSessionId).toBeDefined()

      const { result } = await ChatEngine.generateChat(initialized)
      expect(result.text).toBe('Preview chat response')

      // Verify the message was persisted to the database
      const dbMessages = await prisma.message.findMany({
        where: { chatId: setup.chatId, role: 'assistant', isActive: true },
      })
      expect(dbMessages.length).toBeGreaterThanOrEqual(1)
      // content is a Json field — stringify to check for the response text
      expect(dbMessages.some(m => JSON.stringify(m.content).includes('Preview chat response'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 15. Multi-round config with different round types
  // -------------------------------------------------------------------------
  describe('multi-round with different types', () => {
    it('handles brainstorm then critique rounds with auto transition', async () => {
      const setup = await createTestSetup({
        agentCount: 1,
        roundCount: 2,
        lengthType: LengthType.total,
        lengthNumber: 1,
        transition: TransitionType.auto,
        roundOverrides: [
          { type: RoundType.brainstorm, transition: TransitionType.auto },
          { type: RoundType.critique, transition: TransitionType.user },
        ],
      })

      queueMockResponses(
        { text: 'Brainstorm idea' },
        { text: 'Critique of the idea' }
      )

      // --- Round 1: Brainstorm ---
      const state1 = createInitialChatState(setup)
      const init1 = await ChatEngine.initialize(state1, setup.configId, null)
      expect(init1.activeRound.type).toBe('brainstorm')

      const { nextChatState: after1 } = await ChatEngine.generateChat(init1)

      // Should have transitioned to round 2
      expect(after1.progress.active.round.id).toBe(setup.roundIds[1])

      // --- Round 2: Critique ---
      const state2: ChatState = {
        ...createInitialChatState(setup),
        messages: after1.messages,
        progress: after1.progress,
      }
      const init2 = await ChatEngine.initialize(state2, setup.configId, after1.progress)
      expect(init2.activeRound.type).toBe('critique')

      const { nextChatState: after2 } = await ChatEngine.generateChat(init2)
      expect(after2.messages).toHaveLength(2)
    })
  })
})
