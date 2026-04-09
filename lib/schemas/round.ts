import { z } from 'zod'
import {
  RoundType,
  DepthLevel,
  LengthType,
  RoundActionType,
  TransitionType,
  ParticipantOrder,
  ParticipantMode,
  ParticipantLengthType,
  DialogueMode,
  MessageGenerationMode,
  DialogueLengthMode,
} from '@prisma/client'

// Round-level model selection: how a round assigns models to its agents
// - 'agent': let each agent use its own model (default)
// - 'specific': use a single selectedModel for all agents
// - 'random': randomly assign from available models
// Note: This is distinct from agent-level selection ('default'|'random'|'select')
export const ROUND_MODEL_SELECTION_MODES = ['agent', 'random', 'specific'] as const
export type RoundModelSelectionMode = typeof ROUND_MODEL_SELECTION_MODES[number]

// Message sender mode: how a non-dialogue round determines which agents speak
// - 'all_participants': every agent sends a message each turn (default)
// - 'moderator_decides': a moderator agent selects who speaks
// Note: This is a subset of DialogueMode; the DB column is typed as DialogueMode?
// but only these two values are supported in runtime and UI.
export const MESSAGE_SENDER_MODES = ['all_participants', 'moderator_decides'] as const
export type MessageSenderMode = typeof MESSAGE_SENDER_MODES[number]

// --- Stance schema ---

export const roundStanceSchema = z.object({
  agentId: z.string(),
  stance: z.string(),
})

export type RoundStanceInput = z.infer<typeof roundStanceSchema>

// --- Transition condition schema ---

const transitionConditionSchema = z.object({
  roundId: z.string(),
  condition: z.string(),
})

// --- Round input schema (what APIs accept for create/update) ---

export const roundInputSchema = z.object({
  // Core fields
  type: z.nativeEnum(RoundType),
  depth: z.nativeEnum(DepthLevel).default(DepthLevel.medium),
  lengthType: z.nativeEnum(LengthType).default(LengthType.rounds),
  lengthNumber: z.number().nullable().optional(),
  lengthRounds: z.number().nullable().optional(),
  sequence: z.number(),
  name: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),

  // Participants
  participants: z.array(z.string()).default([]),
  participantMode: z.nativeEnum(ParticipantMode).optional(),
  participantGenerationPrompt: z.string().nullable().optional(),
  participantLengthType: z.nativeEnum(ParticipantLengthType).optional(),
  participantLength: z.number().nullable().optional(),
  participantOrder: z.nativeEnum(ParticipantOrder).default(ParticipantOrder.default),
  participantOrderPrompt: z.string().nullable().optional(),
  moderatorAgentId: z.string().nullable().optional(),

  // Style
  stanceType: z.string().nullable().optional(),
  stances: z.array(roundStanceSchema).default([]),
  outputNumber: z.number().nullable().optional(),
  creativityType: z.string().default('agent'),
  creativityNumber: z.number().nullable().optional(),
  action: z.nativeEnum(RoundActionType).nullable().optional(),

  // Options
  instructions: z.string().nullable().optional(),
  showPrompts: z.boolean().default(false),
  agentQuestions: z.boolean().default(false),
  agentSelfReflection: z.boolean().default(false),
  agentIsolation: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  modelSelectionMode: z.enum(ROUND_MODEL_SELECTION_MODES).default('agent'),
  selectedModel: z.string().nullable().optional(),

  // Flow
  transition: z.nativeEnum(TransitionType).default(TransitionType.user),
  lengthModerator: z.string().nullable().optional(),
  lengthPrompt: z.string().nullable().optional(),

  // Data extraction
  dataTool: z.any().optional(),
  retentionSettings: z.any().optional(),

  // Dialogue fields
  dialogueSenderMode: z.nativeEnum(DialogueMode).nullable().optional(),
  dialogueSelectedSenders: z.array(z.string()).default([]),
  dialogueSenderInstructions: z.string().nullable().optional(),
  dialogueSenderModerator: z.string().nullable().optional(),
  dialogueReceiverMode: z.nativeEnum(DialogueMode).nullable().optional(),
  dialogueSelectedReceivers: z.array(z.string()).default([]),
  dialogueReceiverInstructions: z.string().nullable().optional(),
  dialogueReceiverModerator: z.string().nullable().optional(),
  dialogueInitialMessageMode: z.nativeEnum(MessageGenerationMode).nullable().optional(),
  dialogueInitialMessage: z.string().nullable().optional(),
  dialogueInitialMessageInstructions: z.string().nullable().optional(),
  dialogueInstructionsMode: z.nativeEnum(MessageGenerationMode).nullable().optional(),
  dialogueInstructions: z.string().nullable().optional(),
  dialogueInstructionsPrompt: z.string().nullable().optional(),
  dialogueLengthMode: z.nativeEnum(DialogueLengthMode).nullable().optional(),
  dialogueLength: z.number().nullable().optional(),
  dialogueLengthInstructions: z.string().nullable().optional(),
  dialogueLengthModerator: z.string().nullable().optional(),

  // Message sender fields (non-dialogue rounds)
  messageSenderMode: z.enum(MESSAGE_SENDER_MODES).nullable().optional(),
  messageSenderInstructions: z.string().nullable().optional(),
  messageSenderModerator: z.string().nullable().optional(),

  // Conditional transition fields
  transitionModerator: z.string().nullable().optional(),
  transitionPrompt: z.string().nullable().optional(),
  transitionConditions: z.array(transitionConditionSchema).nullable().optional(),
})

export type RoundInput = z.infer<typeof roundInputSchema>

// --- Full round schema (includes DB-generated fields) ---

export const roundFullSchema = roundInputSchema.extend({
  id: z.string(),
  configId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type RoundFull = z.infer<typeof roundFullSchema>

// --- Defaults ---
// Parse with only required fields to extract all defaults
export const ROUND_DEFAULTS = roundInputSchema.parse({
  type: RoundType.brainstorm,
  sequence: 0,
})
