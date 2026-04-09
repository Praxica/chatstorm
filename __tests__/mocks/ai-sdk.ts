/**
 * Mock for the `ai` package (Vercel AI SDK).
 *
 * Provides configurable mocks for generateText, streamText, and related
 * utilities so engine/adapter tests can run without calling real LLMs.
 *
 * Usage:
 *   import { setMockResponse, resetMockResponses } from '@/__tests__/mocks/ai-sdk'
 *
 *   setMockResponse('agent-1', { text: 'Hello from agent 1' })
 *   setMockResponse('*', { text: 'Default response' })  // fallback for any agent
 */

// ---------------------------------------------------------------------------
// Configurable response store
// ---------------------------------------------------------------------------

export interface MockLLMResponse {
  text?: string
  toolCalls?: Array<{ toolName: string; input: any }>
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  finishReason?: string
  error?: Error
}

const DEFAULT_RESPONSE: MockLLMResponse = {
  text: 'Mock LLM response',
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  finishReason: 'stop',
}

/** Per-agent responses keyed by agent ID. '*' is the fallback. */
const responses = new Map<string, MockLLMResponse>()

/** Ordered queue — if set, responses are dequeued in order regardless of agent. */
let responseQueue: MockLLMResponse[] = []

/** Captures every call to generateText/streamText for assertions. */
export const capturedCalls: Array<{
  fn: 'generateText' | 'streamText'
  params: Record<string, any>
}> = []

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

export function setMockResponse(agentIdOrWildcard: string, response: MockLLMResponse) {
  responses.set(agentIdOrWildcard, response)
}

export function queueMockResponses(...queue: MockLLMResponse[]) {
  responseQueue.push(...queue)
}

export function resetMockResponses() {
  responses.clear()
  responseQueue = []
  capturedCalls.length = 0
}

// ---------------------------------------------------------------------------
// Internal: resolve the response for a given call
// ---------------------------------------------------------------------------

function resolveResponse(params: Record<string, any>): MockLLMResponse {
  // Dequeue first if available
  if (responseQueue.length > 0) {
    return responseQueue.shift()!
  }

  // Try to extract agent ID from the system prompt or messages metadata
  // Convention: tests set agentId in the system prompt or via setMockResponse('*', ...)
  const agentId = params._testAgentId as string | undefined

  if (agentId && responses.has(agentId)) {
    return responses.get(agentId)!
  }
  if (responses.has('*')) {
    return responses.get('*')!
  }
  return DEFAULT_RESPONSE
}

function buildResult(resp: MockLLMResponse) {
  if (resp.error) {
    throw resp.error
  }
  return {
    text: resp.text ?? '',
    toolCalls: resp.toolCalls ?? [],
    usage: resp.usage ?? DEFAULT_RESPONSE.usage,
    finishReason: resp.finishReason ?? 'stop',
    response: {
      messages: [
        { role: 'assistant', content: resp.text ?? '' },
      ],
    },
    // AI SDK fields
    responseMessages: [{ role: 'assistant', content: resp.text ?? '' }],
    warnings: [],
    steps: [],
  }
}

// ---------------------------------------------------------------------------
// Mock: generateText
// ---------------------------------------------------------------------------

export async function generateText(params: Record<string, any>) {
  capturedCalls.push({ fn: 'generateText', params })
  const resp = resolveResponse(params)
  return buildResult(resp)
}

// ---------------------------------------------------------------------------
// Mock: streamText
// ---------------------------------------------------------------------------

export function streamText(params: Record<string, any>) {
  capturedCalls.push({ fn: 'streamText', params })
  const resp = resolveResponse(params)
  const result = buildResult(resp)

  // Call onFinish if provided (mirrors real SDK behavior)
  if (params.onFinish && !resp.error) {
    // Defer to next tick so callers can attach listeners first
    Promise.resolve().then(() => params.onFinish(result))
  }

  // Call onError if error
  if (resp.error && params.onError) {
    Promise.resolve().then(() => params.onError({ error: resp.error }))
  }

  // Return a stream-like object
  const textChunks = (resp.text ?? '').split(' ')
  return {
    ...result,
    textStream: (async function* () {
      for (const chunk of textChunks) {
        yield chunk + ' '
      }
    })(),
    toUIMessageStream: () => {
      // Return a minimal ReadableStream
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(resp.text ?? ''))
          controller.close()
        },
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Mock: smoothStream (identity transform)
// ---------------------------------------------------------------------------

export function smoothStream() {
  return undefined // no-op transform
}

// ---------------------------------------------------------------------------
// Mock: tool
// ---------------------------------------------------------------------------

export function tool(config: { description: string; inputSchema?: any; execute?: any }) {
  return {
    description: config.description,
    parameters: config.inputSchema,
    execute: config.execute,
  }
}

// ---------------------------------------------------------------------------
// Mock: stepCountIs
// ---------------------------------------------------------------------------

export function stepCountIs(count: number) {
  return { type: 'stepCount', count }
}

// ---------------------------------------------------------------------------
// Mock: LanguageModel type stub
// ---------------------------------------------------------------------------

export type LanguageModel = any
