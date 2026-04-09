/**
 * Test factories for building ChatState and related objects.
 *
 * These produce the shapes consumed by MessageUtils.sanitizeMessages()
 * and MessageUtils.buildLlmMessages() — namely ChatState, its nested
 * agents/rounds/sessions/messages, and the Prisma model types they reference.
 */
import type { ChatAgent } from '@prisma/client'
import type { ChatRound, Config } from '@/lib/schemas/prisma-typed'
import type { ChatState, Message, ExtendedChatRound } from '@/lib/chat/types'
import type { ChatRoundSessionData } from '@/lib/chat/services/sessions'
import { ROUND_DEFAULTS } from '@/lib/schemas/round'
import { fromDbMessage, fromUIMessage, type ChatMessage } from '@/lib/schemas/message'

// ---------------------------------------------------------------------------
// Counters for unique IDs
// ---------------------------------------------------------------------------
let idCounter = 0
const nextId = () => `test-${++idCounter}`

export function resetIdCounter() {
  idCounter = 0
}

// ---------------------------------------------------------------------------
// Agent factory
// ---------------------------------------------------------------------------
export function createTestAgent(overrides: Partial<ChatAgent> = {}): ChatAgent {
  const id = overrides.id ?? nextId()
  return {
    id,
    name: `Agent ${id}`,
    role: 'assistant',
    systemPrompt: 'You are a helpful assistant.',
    priority: 'medium',
    avatar: null,
    model: null,
    temperature: null,
    isActive: true,
    userId: 'test-user-id',
    modelSelectionMode: 'default',
    selectedModels: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    chatRoundSessionId: null,
    isDynamic: false,
    ...overrides,
  } as ChatAgent
}

// ---------------------------------------------------------------------------
// Round factory
// ---------------------------------------------------------------------------
export function createTestRound(overrides: Partial<ChatRound & { participants?: ChatAgent[]; stances?: { agentId: string; stance: string }[] }> = {}): ExtendedChatRound {
  const id = overrides.id ?? nextId()
  return {
    id,
    configId: 'test-config-id',
    type: ROUND_DEFAULTS.type as any,
    depth: ROUND_DEFAULTS.depth as any,
    lengthType: ROUND_DEFAULTS.lengthType as any,
    lengthNumber: ROUND_DEFAULTS.lengthNumber ?? null,
    lengthRounds: ROUND_DEFAULTS.lengthRounds ?? null,
    sequence: ROUND_DEFAULTS.sequence,
    createdAt: new Date(),
    updatedAt: new Date(),
    stanceType: null,
    outputNumber: null,
    creativityNumber: null,
    creativityType: ROUND_DEFAULTS.creativityType,
    instructions: null,
    showPrompts: ROUND_DEFAULTS.showPrompts,
    name: null,
    icon: null,
    agentQuestions: ROUND_DEFAULTS.agentQuestions,
    agentSelfReflection: ROUND_DEFAULTS.agentSelfReflection,
    modelSelectionMode: ROUND_DEFAULTS.modelSelectionMode,
    selectedModel: null,
    participantOrder: ROUND_DEFAULTS.participantOrder as any,
    transition: ROUND_DEFAULTS.transition as any,
    action: null,
    moderatorAgentId: null,
    agentIsolation: ROUND_DEFAULTS.agentIsolation,
    isPrivate: ROUND_DEFAULTS.isPrivate,
    dataTool: null,
    retentionSettings: null,
    lengthModerator: null,
    lengthPrompt: null,
    participantOrderPrompt: null,
    participantGenerationPrompt: null,
    participantLength: null,
    participantLengthType: null,
    participantMode: null,
    dialogueInitialMessage: null,
    dialogueInitialMessageInstructions: null,
    dialogueInitialMessageMode: null,
    dialogueInstructions: null,
    dialogueInstructionsMode: null,
    dialogueInstructionsPrompt: null,
    dialogueLength: null,
    dialogueLengthInstructions: null,
    dialogueLengthMode: null,
    dialogueLengthModerator: null,
    dialogueReceiverInstructions: null,
    dialogueReceiverMode: null,
    dialogueReceiverModerator: null,
    dialogueSelectedReceivers: [],
    dialogueSelectedSenders: [],
    dialogueSenderInstructions: null,
    dialogueSenderMode: null,
    dialogueSenderModerator: null,
    messageSenderMode: null,
    messageSenderInstructions: null,
    messageSenderModerator: null,
    transitionModerator: null,
    transitionPrompt: null,
    transitionConditions: null,
    // ExtendedChatRound fields
    participants: [],
    ...overrides,
  } as ExtendedChatRound
}

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------
export function createTestSession(overrides: Partial<ChatRoundSessionData> = {}): ChatRoundSessionData {
  return {
    id: overrides.id ?? nextId(),
    chatId: 'test-chat-id',
    roundId: 'test-round-id',
    startedAt: new Date(),
    completedAt: null,
    isActive: true,
    compressionData: null,
    compressionVersion: null,
    compressedAt: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Message factories
//
// Three variants to test different message origins:
//   createTestMessage()   — canonical ChatMessage (default for most tests)
//   createDbMessage()     — raw DB shape (chatRoundSessionId column, no metadata.sessionId)
//   createClientMessage() — raw client shape (metadata.sessionId, no chatRoundSessionId)
//
// The DB/client variants exist so we can verify that transforms produce
// identical canonical shapes, and that code doesn't accidentally rely on
// origin-specific fields.
// ---------------------------------------------------------------------------

/**
 * Create a canonical ChatMessage (already transformed).
 * Also sets a `content` string for compatibility with code paths that
 * still read `msg.content` (e.g., the no-config fallback in buildLlmMessages).
 */
export function createTestMessage(overrides: {
  role?: 'user' | 'assistant'
  content?: string
  agentId?: string
  sessionId?: string
  roundId?: string
  parts?: any[]
  [key: string]: any
} = {}): ChatMessage & { content: string } {
  const {
    role = 'assistant',
    content = 'Test message',
    agentId,
    sessionId,
    roundId,
    parts,
    ...rest
  } = overrides

  return {
    id: rest.id ?? nextId(),
    role,
    content,
    parts: parts ?? [{ type: 'text', text: content }],
    metadata: {
      agentId: agentId ?? null,
      sessionId: sessionId ?? null,
      roundId: roundId ?? null,
    },
  }
}

/**
 * Create a raw DB-shaped message (as it comes from Prisma).
 * Has `chatRoundSessionId` as a top-level column and `agentId` column.
 * Does NOT set `metadata.sessionId` — that's the DB-to-canonical transform's job.
 */
export function createDbMessage(overrides: {
  role?: 'user' | 'assistant'
  content?: string
  agentId?: string
  sessionId?: string
  roundId?: string
  [key: string]: any
} = {}): any {
  const {
    role = 'assistant',
    content = 'Test message',
    agentId,
    sessionId,
    roundId,
    ...rest
  } = overrides

  return {
    id: rest.id ?? nextId(),
    role,
    content: { parts: [{ type: 'text', text: content }] },
    agentId: agentId ?? null,
    chatRoundSessionId: sessionId ?? null,
    metadata: {
      roundId: roundId ?? null,
    },
    annotations: [],
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  }
}

/**
 * Create a raw client-shaped message (as it comes from Vercel AI SDK).
 * Has `metadata.sessionId` and `metadata.agentId`.
 * Does NOT have `chatRoundSessionId` — that's a DB-only column.
 */
export function createClientMessage(overrides: {
  role?: 'user' | 'assistant'
  content?: string
  agentId?: string
  sessionId?: string
  roundId?: string
  [key: string]: any
} = {}): any {
  const {
    role = 'assistant',
    content = 'Test message',
    agentId,
    sessionId,
    roundId,
    ...rest
  } = overrides

  return {
    id: rest.id ?? nextId(),
    role,
    parts: [{ type: 'text', text: content }],
    metadata: {
      agentId: agentId ?? null,
      sessionId: sessionId ?? null,
      roundId: roundId ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// ChatState factory
// ---------------------------------------------------------------------------
export function createTestChatState(overrides: Partial<ChatState> & {
  agents?: ChatAgent[]
  activeAgent?: ChatAgent
  activeRound?: ExtendedChatRound
  messages?: any[]
  sessions?: ChatRoundSessionData[]
  rounds?: (ChatRound | ExtendedChatRound)[]
  config?: Config | null
  currentSessionId?: string
} = {}): ChatState {
  const agents = overrides.agents ?? [createTestAgent({ id: 'agent-1' })]
  const activeAgent = overrides.activeAgent ?? agents[0]
  const activeRound = overrides.activeRound ?? createTestRound({
    id: 'round-1',
    participants: agents,
  })
  const currentSessionId = overrides.currentSessionId ?? 'session-1'

  return {
    chat: {
      id: 'test-chat-id',
      persistenceMode: 'save',
      generationMode: 'stream',
      branchId: 'test-branch-id',
      activeBranchPath: [],
    },
    config: overrides.config ?? {
      id: 'test-config-id',
      title: 'Test Config',
      userId: 'test-user-id',
      chatInstructions: null,
      examplePrompts: [],
      retentionSettings: null,
      memorySettings: null,
      designSettings: null,
      spaceId: null,
      previewChatId: null,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    } as Config,
    rounds: overrides.rounds ?? [activeRound],
    activeRound,
    agents,
    activeAgent,
    progress: {} as any,
    messages: overrides.messages ?? [],
    sessions: overrides.sessions ?? [
      createTestSession({ id: currentSessionId, roundId: activeRound.id, isActive: true }),
    ],
    adapter: {} as any,
    user: { id: 'test-user-id' } as any,
    currentSessionId,
    languageModels: {},
    ...overrides,
  }
}
