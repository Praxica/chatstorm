/**
 * Typed overlays for Prisma models with Json columns.
 *
 * Prisma's `Json` type resolves to `JsonValue` at runtime, which is
 * `string | number | boolean | JsonObject | JsonArray | null`.
 * This makes property access impossible without casting.
 *
 * These types replace the raw `JsonValue` with the actual interfaces
 * the application stores/reads. Use them at query boundaries:
 *
 *   const config = await prisma.config.findUnique(...) as Config | null;
 *
 * This avoids per-access `(x as any).field` casts throughout the codebase.
 *
 * Naming convention:
 *   - Application types use clean names: Config, ChatRound, etc.
 *   - Raw ORM-generated types use *Schema suffix: ConfigSchema, ChatRoundSchema, etc.
 *   - Import from here for typed access; import *Schema types only when you
 *     need the raw untyped shape (e.g., in ORM query inputs).
 */

import type {
  Config as ConfigSchema,
  ChatRound as ChatRoundSchema,
  ChatRoundSession as ChatRoundSessionSchema,
  Spaces as SpaceSchema,
  User as UserSchema,
} from '@prisma/client'
import type { ChatRetentionSettings, RoundRetentionSettings, SummaryData, DialogueCompressionData } from '@/lib/chat/services/retention-types'

// ---------------------------------------------------------------------------
// Config Json field types
// ---------------------------------------------------------------------------

export interface DesignSettings {
  showRoundTitles?: boolean
  showMessageMetadata?: boolean
}

export interface MemorySettings {
  memories?: Array<{
    id: string
    name: string
    memorizeRound: string
    memorizeInstructions: string
    rememberWhen: 'every_round' | 'specific_rounds'
    rememberRounds?: Array<{ roundId: string; instructions: string }>
    rememberInstructions?: string
    rememberWho: 'every_agent' | 'original_agent'
    updateEnabled: boolean
    updateWhen: 'every_round' | 'specific_rounds'
    updateRounds?: Array<{ roundId: string; instructions: string }>
    updateInstructions?: string
    updateWho: 'every_agent' | 'original_agent'
  }>
}

export interface Config extends Omit<ConfigSchema, 'retentionSettings' | 'memorySettings' | 'designSettings'> {
  retentionSettings: ChatRetentionSettings | null
  memorySettings: MemorySettings | null
  designSettings: DesignSettings | null
}

// ---------------------------------------------------------------------------
// ChatRound Json field types
// ---------------------------------------------------------------------------

export interface DataTool {
  instructions: string
  parameters: Array<{
    name: string
    description: string
    type: 'string' | 'number' | 'array_string' | 'array_number' | 'boolean' | 'keyvalue'
  }>
}

export interface TransitionCondition {
  roundId: string
  condition: string
}

export interface ChatRound extends Omit<ChatRoundSchema, 'dataTool' | 'retentionSettings' | 'transitionConditions'> {
  dataTool: DataTool | null
  retentionSettings: RoundRetentionSettings | null
  transitionConditions: TransitionCondition[] | null
}

// ---------------------------------------------------------------------------
// ChatRoundSession Json field types
// ---------------------------------------------------------------------------

export type CompressionData = SummaryData | DialogueCompressionData

export interface ChatRoundSession extends Omit<ChatRoundSessionSchema, 'compressionData'> {
  compressionData: CompressionData | null
}

// ---------------------------------------------------------------------------
// Space Json field types
// ---------------------------------------------------------------------------

export interface SpaceModelSettings {
  mode: 'all' | 'include' | 'exclude'
  defaultModel: string | null
  includedModels: string[]
  excludedModels: string[]
}

export interface SpaceSettings {
  [key: string]: unknown
}

export interface Space extends Omit<SpaceSchema, 'settings' | 'modelSettings'> {
  settings: SpaceSettings
  modelSettings: SpaceModelSettings
}

// ---------------------------------------------------------------------------
// User Json field types
// ---------------------------------------------------------------------------

export interface UserFeatures {
  [key: string]: unknown
}

export interface UserMetadata {
  [key: string]: unknown
}

export interface User extends Omit<UserSchema, 'features' | 'metadata' | 'modelSettings'> {
  features: UserFeatures
  metadata: UserMetadata
  modelSettings: SpaceModelSettings
}

// ---------------------------------------------------------------------------
// Re-export raw ORM types with *Schema suffix for cases that need them
// ---------------------------------------------------------------------------
export type { ConfigSchema, ChatRoundSchema, ChatRoundSessionSchema, SpaceSchema, UserSchema }
