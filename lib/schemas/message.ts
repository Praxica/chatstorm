/**
 * Message type definitions — two shapes for two layers:
 *
 * 1. Message (UI layer) — loose shape used by stores/components, has
 *    `content: any` and `annotations`. Matches what the API returns.
 *
 * 2. ChatMessage (pipeline layer) — structured shape for sanitizeMessages()
 *    and buildLlmMessages(). Has `parts: MessagePart[]` and typed metadata.
 *    DB and client messages are transformed into this via fromDbMessage/fromUIMessage.
 */

// ---------------------------------------------------------------------------
// UI message type (used by stores and components)
// ---------------------------------------------------------------------------

export interface Message {
  id: string
  role: string
  content: any
  createdAt?: Date
  annotations?: Array<{
    type: string
    content: any
  }>
  metadata?: {
    roundId: string
    progress: any
    sessionId?: string
    agentId?: string
    [key: string]: unknown
  }
}

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface MessagePart {
  type: string
  text?: string
  data?: any
}

export interface MessageMetadata {
  // --- Required: routing & filtering ---
  agentId: string | null
  sessionId: string | null
  roundId: string | null

  // --- Optional: generation context ---
  model?: string                // Model ID used for generation
  createdAt?: number            // Epoch timestamp of generation
  sdkMessageId?: string         // Vercel AI SDK message ID (for replay)

  // --- Optional: token usage ---
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  totalTokens?: number          // Quick-access duplicate (backward compat)

  // --- Optional: prompt debugging ---
  prompts?: {
    system: string
    instructions: string
  }

  // --- Optional: chat state ---
  progress?: any                // ChatProgress state snapshot
  dialogue?: {                  // Dialogue sender/receiver pair
    senderId: string
    receiverId: string
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  parts: MessagePart[]
  metadata: MessageMetadata
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

/**
 * Transform a Prisma DB message into a ChatMessage.
 *
 * Maps DB-only fields (chatRoundSessionId, agentId column, content JSON)
 * into the canonical shape. This replaces ad-hoc `(msg as any)` access
 * throughout the codebase.
 */
export function fromDbMessage(db: {
  id: string
  role: string
  content: any
  metadata?: any
  annotations?: any[]
  chatRoundSessionId?: string | null
  agentId?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  [key: string]: any
}): ChatMessage {
  const raw = db.content as any
  const existingMetadata = (db.metadata as Record<string, any>) || {}

  // Build parts from content JSON (UIMessage format), legacy string, or legacy object
  let parts: MessagePart[] = []
  if (raw && Array.isArray(raw.parts)) {
    parts = raw.parts
  } else if (typeof raw === 'string') {
    parts = [{ type: 'text', text: raw }]
  } else if (raw && typeof raw === 'object' && typeof raw.content === 'string') {
    parts = [{ type: 'text', text: raw.content }]
  }

  // Add progress data part if present in metadata but not in parts
  if (existingMetadata.progress && !parts.find(p => p.type === 'data-progress')) {
    parts.push({ type: 'data-progress', data: existingMetadata.progress })
  }

  // Add dialogue data part if present in metadata but not in parts
  if (existingMetadata.dialogue && !parts.find(p => p.type === 'data-dialogue')) {
    parts.push({ type: 'data-dialogue', data: existingMetadata.dialogue })
  }

  // Build usage from DB columns
  const usage = (db.promptTokens || db.completionTokens || db.totalTokens)
    ? {
        promptTokens: db.promptTokens ?? undefined,
        completionTokens: db.completionTokens ?? undefined,
        totalTokens: db.totalTokens ?? undefined,
      }
    : existingMetadata.usage ?? undefined

  // Canonical sessionId: prefer metadata.sessionId, fall back to DB column
  const sessionId = existingMetadata.sessionId
    ?? db.chatRoundSessionId
    ?? null

  // Canonical agentId: prefer metadata.agentId, fall back to DB column
  const agentId = existingMetadata.agentId
    ?? db.agentId
    ?? null

  return {
    id: db.id,
    role: (db.role as 'user' | 'assistant') || 'assistant',
    parts,
    metadata: {
      agentId,
      sessionId,
      roundId: existingMetadata.roundId ?? null,
      ...(usage ? { usage } : {}),
      ...(existingMetadata.model ? { model: existingMetadata.model } : {}),
      ...(existingMetadata.createdAt ? { createdAt: existingMetadata.createdAt } : {}),
      ...(existingMetadata.sdkMessageId ? { sdkMessageId: existingMetadata.sdkMessageId } : {}),
      ...(existingMetadata.totalTokens ? { totalTokens: existingMetadata.totalTokens } : {}),
      ...(existingMetadata.prompts ? { prompts: existingMetadata.prompts } : {}),
      ...(existingMetadata.progress ? { progress: existingMetadata.progress } : {}),
      ...(existingMetadata.dialogue ? { dialogue: existingMetadata.dialogue } : {}),
    },
  }
}

/**
 * Transform a Vercel AI UIMessage (client-side) into a ChatMessage.
 *
 * Client messages already have `metadata.sessionId` and `metadata.agentId`,
 * but may be loosely typed. This normalizes the shape.
 */
export function fromUIMessage(ui: {
  id?: string
  role: string
  parts?: any[]
  content?: string
  metadata?: Record<string, any>
  [key: string]: any
}): ChatMessage {
  const meta = ui.metadata || {}

  // Build parts: prefer explicit parts array, fall back to content string
  let parts: MessagePart[] = []
  if (Array.isArray(ui.parts) && ui.parts.length > 0) {
    parts = ui.parts
  } else if (typeof ui.content === 'string') {
    parts = [{ type: 'text', text: ui.content }]
  }

  return {
    id: ui.id ?? '',
    role: (ui.role as 'user' | 'assistant') || 'assistant',
    parts,
    metadata: {
      agentId: meta.agentId ?? null,
      sessionId: meta.sessionId ?? null,
      roundId: meta.roundId ?? null,
      ...(meta.usage ? { usage: meta.usage } : {}),
      ...(meta.model ? { model: meta.model } : {}),
      ...(meta.createdAt ? { createdAt: meta.createdAt } : {}),
      ...(meta.sdkMessageId ? { sdkMessageId: meta.sdkMessageId } : {}),
      ...(meta.totalTokens ? { totalTokens: meta.totalTokens } : {}),
      ...(meta.prompts ? { prompts: meta.prompts } : {}),
      ...(meta.progress ? { progress: meta.progress } : {}),
      ...(meta.dialogue ? { dialogue: meta.dialogue } : {}),
    },
  }
}
