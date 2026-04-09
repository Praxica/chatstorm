import { z } from 'zod'

// Agent-level model selection: how an individual agent picks its model
// - 'default': use whatever the round/config says
// - 'select': pick randomly from agent's selectedModels list
// - 'random': pick randomly from all available models
// Note: This is distinct from round-level selection ('agent'|'specific'|'random')
export const AGENT_MODEL_SELECTION_MODES = ['default', 'random', 'select'] as const
export type AgentModelSelectionMode = typeof AGENT_MODEL_SELECTION_MODES[number]

// --- Agent input schema (what APIs accept for create/update) ---

export const agentInputSchema = z.object({
  name: z.string(),
  role: z.string(),
  systemPrompt: z.string(),
  priority: z.string().default('medium'),
  avatar: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  temperature: z.number().nullable().optional(),
  isActive: z.boolean().default(true),
  modelSelectionMode: z.enum(AGENT_MODEL_SELECTION_MODES).nullable().default('default'),
  selectedModels: z.array(z.string()).default([]),
  isDynamic: z.boolean().default(false),
})

export type AgentInput = z.infer<typeof agentInputSchema>

// --- Full agent schema (includes DB-generated fields) ---

export const agentFullSchema = agentInputSchema.extend({
  id: z.string(),
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  chatRoundSessionId: z.string().nullable().optional(),
})

export type AgentFull = z.infer<typeof agentFullSchema>

// --- Defaults ---
export const AGENT_DEFAULTS = agentInputSchema.parse({
  name: 'Agent',
  role: 'assistant',
  systemPrompt: 'You are a helpful assistant.',
})

// --- UI agent type (what API responses return, used in stores/components) ---
// Differs from AgentFull: string dates (JSON serialization), projectIds
// (many-to-many relation), no userId/chatRoundSessionId (server-only).
export interface ChatAgent {
  id: string
  name: string
  role: string
  systemPrompt: string
  priority: string
  avatar?: string
  model?: string
  temperature?: number
  isActive?: boolean
  isDynamic?: boolean
  projectIds?: string[]
  modelSelectionMode?: AgentModelSelectionMode | null
  selectedModels?: string[]
  createdAt?: string
  updatedAt?: string
}
