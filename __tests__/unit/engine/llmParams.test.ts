/**
 * Unit tests for LLMService.getLLMParams() and LLMService.getTemperature()
 *
 * These verify that the LLM parameter construction layer properly assembles
 * model, system prompt, messages, temperature, tools, and streaming config
 * from the various chat services.
 */

import {
  createTestAgent,
  createTestRound,
  createTestChatState,
  createTestMessage,
  resetIdCounter,
} from '../../factories'

// ---------------------------------------------------------------------------
// Mocks — must be declared before the import of the module under test
// ---------------------------------------------------------------------------

jest.mock('@/lib/chat/services/prompts', () => ({
  PromptService: {
    getAgentPrompt: jest.fn().mockResolvedValue('You are a test agent.'),
    getInstructionsPrompt: jest.fn().mockResolvedValue('Test instructions.'),
  },
}))

jest.mock('@/lib/chat/services/models', () => ({
  ModelService: {
    getLLMModel: jest.fn().mockReturnValue({ modelId: 'test-model' }),
  },
}))

jest.mock('@/lib/chat/services/tools', () => ({
  ToolsService: {
    addToolParams: jest.fn().mockResolvedValue(null),
  },
}))

jest.mock('@/lib/chat/services/memory', () => ({
  MemoryService: {
    shouldEnableMemoryCreation: jest.fn().mockReturnValue(false),
    getCreatableMemories: jest.fn().mockResolvedValue([]),
    getMemoriesForPrompt: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock('@/lib/chat/services/ui-message', () => ({
  convertUIMessagesToModelMessages: jest.fn((messages: any[]) => messages),
}))

jest.mock('@/lib/chat/services/messages', () => ({
  MessageUtils: {
    buildLlmMessages: jest.fn().mockReturnValue([]),
  },
}))

jest.mock('@/lib/constants', () => ({
  CHAT_USER_CONTINUE: '__continue__',
}))

jest.mock('@/lib/utils/error', () => ({
  logError: jest.fn(),
}))

jest.mock('@/lib/utils/debug', () => ({
  logDebug: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Import module under test and mocked services (for per-test overrides)
// ---------------------------------------------------------------------------

import { LLMService } from '@/lib/chat/services/LLM'
import { PromptService } from '@/lib/chat/services/prompts'
import { ModelService } from '@/lib/chat/services/models'
import { ToolsService } from '@/lib/chat/services/tools'
import { MessageUtils } from '@/lib/chat/services/messages'
import { convertUIMessagesToModelMessages } from '@/lib/chat/services/ui-message'

beforeEach(() => {
  resetIdCounter()
  jest.clearAllMocks()

  // Reset default mock implementations after clearAllMocks
  ;(PromptService.getAgentPrompt as jest.Mock).mockResolvedValue('You are a test agent.')
  ;(PromptService.getInstructionsPrompt as jest.Mock).mockResolvedValue('Test instructions.')
  ;(ModelService.getLLMModel as jest.Mock).mockReturnValue({ modelId: 'test-model' })
  ;(ToolsService.addToolParams as jest.Mock).mockResolvedValue(null)
  ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])
  ;(convertUIMessagesToModelMessages as jest.Mock).mockImplementation((msgs: any[]) => msgs)
})

// ===========================================================================
// getTemperature
// ===========================================================================
describe('LLMService.getTemperature', () => {
  it('returns agent-specific temperature when set', () => {
    const agent = createTestAgent({ temperature: 0.3 })
    const round = createTestRound()
    const state = createTestChatState({ activeAgent: agent, activeRound: round })

    expect(LLMService.getTemperature(state)).toBe(0.3)
  })

  it('falls back to round creativityNumber when agent temperature is null', () => {
    const agent = createTestAgent({ temperature: null })
    const round = createTestRound({ creativityType: 'custom', creativityNumber: 0.5 })
    const state = createTestChatState({ activeAgent: agent, activeRound: round })

    expect(LLMService.getTemperature(state)).toBe(0.5)
  })

  it('returns 0.7 default when no agent temperature and no round creativityNumber', () => {
    const agent = createTestAgent({ temperature: null })
    const round = createTestRound({ creativityType: 'custom', creativityNumber: null })
    const state = createTestChatState({ activeAgent: agent, activeRound: round })

    expect(LLMService.getTemperature(state)).toBe(0.7)
  })

  it('returns 0.7 when creativityType is agent_default', () => {
    const agent = createTestAgent({ temperature: null })
    const round = createTestRound({ creativityType: 'agent_default', creativityNumber: 0.9 })
    const state = createTestChatState({ activeAgent: agent, activeRound: round })

    expect(LLMService.getTemperature(state)).toBe(0.7)
  })
})

// ===========================================================================
// getLLMParams
// ===========================================================================
describe('LLMService.getLLMParams', () => {
  // -------------------------------------------------------------------------
  // Base structure
  // -------------------------------------------------------------------------
  it('returns correct base params structure (model, system, messages, temperature)', async () => {
    const agent = createTestAgent({ temperature: 0.4 })
    const userMsg = createTestMessage({ role: 'user', content: 'Hello' })

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([userMsg])

    const state = createTestChatState({ activeAgent: agent, messages: [userMsg] })

    const params = await LLMService.getLLMParams(state)

    expect(params.model).toEqual({ modelId: 'test-model' })
    expect(params.system).toBe('You are a test agent.')
    expect(params.temperature).toBe(0.4)
    expect(params.messages).toBeDefined()
    expect(Array.isArray(params.messages)).toBe(true)
  })

  it('sets maxRetries to 1', async () => {
    const state = createTestChatState()
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const params = await LLMService.getLLMParams(state)

    expect(params.maxRetries).toBe(1)
  })

  it('sets maxToolRoundtrips to 5', async () => {
    const state = createTestChatState()
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const params = await LLMService.getLLMParams(state)

    expect(params.maxToolRoundtrips).toBe(5)
  })

  // -------------------------------------------------------------------------
  // Instructions prompt appending
  // -------------------------------------------------------------------------
  it('appends instructions prompt to last user message content', async () => {
    const userMsg = {
      id: 'msg-1',
      role: 'user' as const,
      parts: [{ type: 'text', text: 'User question' }],
      metadata: { agentId: null, sessionId: null, roundId: null },
    }

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([userMsg])
    ;(PromptService.getInstructionsPrompt as jest.Mock).mockResolvedValue('Instructions here.')

    // convertUIMessagesToModelMessages is an identity mock, so we can inspect
    // the messages that were passed into it
    ;(convertUIMessagesToModelMessages as jest.Mock).mockImplementation((msgs: any[]) => msgs)

    const state = createTestChatState({ messages: [userMsg] })
    await LLMService.getLLMParams(state)

    // The mock captures the messages array; verify the last message was modified
    const capturedMessages = (convertUIMessagesToModelMessages as jest.Mock).mock.calls[0][0]
    const lastMsg = capturedMessages[capturedMessages.length - 1]

    expect(lastMsg.parts[0].text).toContain('Instructions here.')
    expect(lastMsg.parts[0].text).toContain('User question')
  })

  it('does NOT append instructions if last message is not from user', async () => {
    const assistantMsg = {
      id: 'msg-1',
      role: 'assistant' as const,
      parts: [{ type: 'text', text: 'Assistant response' }],
      metadata: { agentId: 'agent-1', sessionId: null, roundId: null },
    }

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([assistantMsg])

    const state = createTestChatState({ messages: [assistantMsg] })
    await LLMService.getLLMParams(state)

    // getInstructionsPrompt should not be called when last message is not user
    expect(PromptService.getInstructionsPrompt).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Streaming mode
  // -------------------------------------------------------------------------
  it('sets experimental_transform for streaming mode', async () => {
    const state = createTestChatState()
    state.chat.generationMode = 'stream'

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const params = await LLMService.getLLMParams(state)

    // smoothStream() in the ai-sdk mock returns undefined, but the key
    // should be present on the params object
    expect(params).toHaveProperty('experimental_transform')
  })

  it('sets onFinish handler for streaming mode', async () => {
    const state = createTestChatState()
    state.chat.generationMode = 'stream'

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const onComplete = jest.fn()
    const params = await LLMService.getLLMParams(state, onComplete)

    expect(params.onFinish).toBeDefined()
    expect(typeof params.onFinish).toBe('function')

    // Calling onFinish should invoke onComplete with chatState and result
    const fakeResult = { text: 'done' }
    params.onFinish!(fakeResult)
    expect(onComplete).toHaveBeenCalledWith(state, fakeResult)
  })

  it('does NOT set experimental_transform or onFinish for non-streaming mode', async () => {
    const state = createTestChatState()
    state.chat.generationMode = 'text'

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const params = await LLMService.getLLMParams(state)

    expect(params.experimental_transform).toBeUndefined()
    expect(params.onFinish).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // Tools and toolChoice
  // -------------------------------------------------------------------------
  it('sets tools and toolChoice when tools are available', async () => {
    const mockTools = {
      createMemory: { description: 'Create a memory', parameters: {} },
    }

    ;(ToolsService.addToolParams as jest.Mock).mockResolvedValue(mockTools)
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const state = createTestChatState()
    const params = await LLMService.getLLMParams(state)

    expect(params.tools).toEqual(mockTools)
    expect(params.toolChoice).toBe('auto')
  })

  it('leaves tools and toolChoice undefined when no tools', async () => {
    ;(ToolsService.addToolParams as jest.Mock).mockResolvedValue(null)
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const state = createTestChatState()
    const params = await LLMService.getLLMParams(state)

    expect(params.tools).toBeNull()
    expect(params.toolChoice).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // Meta / prompt storage
  // -------------------------------------------------------------------------
  it('stores prompts in chatState.meta', async () => {
    ;(PromptService.getAgentPrompt as jest.Mock).mockResolvedValue('System prompt content')
    ;(PromptService.getInstructionsPrompt as jest.Mock).mockResolvedValue('Instructions content')

    const userMsg = {
      id: 'msg-1',
      role: 'user' as const,
      parts: [{ type: 'text', text: 'Hello' }],
      metadata: { agentId: null, sessionId: null, roundId: null },
    }

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([userMsg])

    const state = createTestChatState({ messages: [userMsg] })
    await LLMService.getLLMParams(state)

    expect(state.meta).toBeDefined()
    expect(state.meta!.prompts).toBeDefined()
    expect(state.meta!.prompts!.system).toBe('System prompt content')
    expect(state.meta!.prompts!.instructions).toBe('Instructions content')
  })

  it('initializes meta.prompts if meta is undefined', async () => {
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const state = createTestChatState()
    delete state.meta

    await LLMService.getLLMParams(state)

    expect(state.meta).toBeDefined()
    expect(state.meta!.prompts).toBeDefined()
    expect(state.meta!.prompts!.system).toBe('You are a test agent.')
  })

  // -------------------------------------------------------------------------
  // CHAT_USER_CONTINUE handling
  // -------------------------------------------------------------------------
  it('does not append continue marker text to instructions', async () => {
    const continueMsg = {
      id: 'msg-1',
      role: 'user' as const,
      parts: [{ type: 'text', text: '__continue__' }],
      metadata: { agentId: null, sessionId: null, roundId: null },
    }

    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([continueMsg])
    ;(PromptService.getInstructionsPrompt as jest.Mock).mockResolvedValue('Instructions.')

    ;(convertUIMessagesToModelMessages as jest.Mock).mockImplementation((msgs: any[]) => msgs)

    const state = createTestChatState({ messages: [continueMsg] })
    await LLMService.getLLMParams(state)

    const capturedMessages = (convertUIMessagesToModelMessages as jest.Mock).mock.calls[0][0]
    const lastMsg = capturedMessages[capturedMessages.length - 1]

    // The continue marker should NOT be appended — only instructions
    expect(lastMsg.parts[0].text).toBe('Instructions.')
    expect(lastMsg.parts[0].text).not.toContain('__continue__')
  })

  // -------------------------------------------------------------------------
  // Service call delegation
  // -------------------------------------------------------------------------
  it('calls ModelService.getLLMModel with chatState', async () => {
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const state = createTestChatState()
    await LLMService.getLLMParams(state)

    expect(ModelService.getLLMModel).toHaveBeenCalledWith(state)
  })

  it('calls PromptService.getAgentPrompt with chatState and activeAgent', async () => {
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const agent = createTestAgent({ id: 'agent-x', name: 'Agent X' })
    const state = createTestChatState({ activeAgent: agent })
    await LLMService.getLLMParams(state)

    expect(PromptService.getAgentPrompt).toHaveBeenCalledWith(state, agent)
  })

  it('calls MessageUtils.buildLlmMessages with chatState', async () => {
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const state = createTestChatState()
    await LLMService.getLLMParams(state)

    expect(MessageUtils.buildLlmMessages).toHaveBeenCalledWith(state)
  })

  it('calls ToolsService.addToolParams with chatState', async () => {
    ;(MessageUtils.buildLlmMessages as jest.Mock).mockReturnValue([])

    const state = createTestChatState()
    await LLMService.getLLMParams(state)

    expect(ToolsService.addToolParams).toHaveBeenCalledWith(state)
  })
})
