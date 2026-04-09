import { z } from 'zod'
import type { Round } from '@/types/config-round'
import type { DesignSettings, MemorySettings } from '@/lib/schemas/prisma-typed'
import type { ChatRetentionSettings } from '@/lib/chat/services/retention-types'

// --- Config input schema (what APIs accept for create/update) ---

export const configInputSchema = z.object({
  title: z.string(),
  chatInstructions: z.string().nullable().optional(),
  examplePrompts: z.array(z.string()).default([]),
  retentionSettings: z.any().nullable().optional(),
  memorySettings: z.any().nullable().optional(),
  designSettings: z.any().nullable().optional(),
  spaceId: z.string().nullable().optional(),
  previewChatId: z.string().nullable().optional(),
})

export type ConfigInput = z.infer<typeof configInputSchema>

// --- Full config schema (includes DB-generated fields) ---

export const configFullSchema = configInputSchema.extend({
  id: z.string(),
  userId: z.string(),
  createdAt: z.date(),
  lastUpdatedAt: z.date(),
})

export type ConfigFull = z.infer<typeof configFullSchema>

// --- Defaults ---
export const CONFIG_DEFAULTS = configInputSchema.parse({
  title: 'Untitled Config',
})

// --- UI config type (with relations, used in stores/components) ---
// Differs from ConfigFull: includes hydrated rounds and projects relations.
// retentionSettings/memorySettings/designSettings use typed interfaces
// instead of Prisma's raw Json type.
export interface ConfigUI {
  id: string
  createdAt: Date
  lastUpdatedAt: Date
  title: string
  rounds: Round[]
  projects: { id: string }[]
  chatInstructions?: string
  examplePrompts?: string[]
  retentionSettings?: ChatRetentionSettings | null
  memorySettings?: MemorySettings | null
  designSettings?: DesignSettings | null
  spaceId?: string | null
}
