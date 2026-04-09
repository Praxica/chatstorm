import type { ChatAgent } from '@/lib/schemas/agent'
import type { ReactNode } from 'react'
import {
  RoundType as PrismaRoundType,
  DepthLevel as PrismaDepthLevel,
  LengthType as PrismaLengthType,
  RoundActionType as PrismaRoundActionType,
  TransitionType as PrismaTransitionType,
  ParticipantOrder as PrismaParticipantOrder,
  ParticipantMode,
  ParticipantLengthType,
  DialogueMode,
  MessageGenerationMode,
  DialogueLengthMode
} from '@prisma/client'
import { ROUND_DEFAULTS } from '@/lib/schemas/round'

// Re-export Prisma enums as type aliases for backward compatibility.
// These used to be hand-written string unions; now they derive from Prisma.
export type RoundType = PrismaRoundType
export type DepthLevel = PrismaDepthLevel
export type LengthType = PrismaLengthType
export type RoundActionType = PrismaRoundActionType
export type TransitionType = PrismaTransitionType
export type ParticipantOrder = PrismaParticipantOrder

export const DEPTH_DESCRIPTIONS: Record<DepthLevel, string> = {
  minimal: 'one or two sentences',
  brief: 'one paragraph',
  medium: 'a few brief paragraphs',
  thorough: 'multiple paragraphs',
  exhaustive: 'complete analysis',
  dynamic: 'let the agent decide',
} as const

export type StanceType = 'ai' | 'custom'

export interface RoundStance {
  agentId: string
  stance: string
}

// Add DataTool types
export interface DataParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'array_string' | 'array_number' | 'boolean' | 'keyvalue';
}

export interface DataTool {
  instructions: string;
  parameters: DataParameter[];
}

export interface Agent {
  id: string
  name: string
  avatar: string
  role: string
}

export interface Round {
  id: string
  type: RoundType
  icon?: ReactNode | string  // Custom icon name from IconPicker or ReactNode for default
  name?: string
  participants: ChatAgent[]
  participantMode?: ParticipantMode
  participantGenerationPrompt?: string
  participantLengthType?: ParticipantLengthType
  participantLength?: number
  depth?: DepthLevel
  lengthType?: LengthType
  lengthNumber?: number
  lengthRounds?: number
  outputNumber?: number
  sequence: number
  action?: RoundActionType
  stanceType?: StanceType
  stances?: RoundStance[]
  creativityType?: string
  creativityNumber?: number
  instructions?: string
  showPrompts?: boolean
  agentQuestions?: boolean
  agentSelfReflection?: boolean
  modelSelectionMode?: 'agent' | 'random' | 'specific'
  selectedModel?: string
  participantOrder?: ParticipantOrder
  participantOrderPrompt?: string
  transition?: TransitionType
  moderatorAgentId?: string
  lengthModerator?: string
  lengthPrompt?: string
  agentIsolation?: boolean
  isPrivate?: boolean
  dataTool?: DataTool
  retentionSettings?: any
  // Dialogue-specific fields
  dialogueSenderMode?: DialogueMode
  dialogueSelectedSenders?: string[]
  dialogueSenderInstructions?: string
  dialogueSenderModerator?: string
  dialogueReceiverMode?: DialogueMode
  dialogueSelectedReceivers?: string[]
  dialogueReceiverInstructions?: string
  dialogueReceiverModerator?: string
  dialogueInitialMessageMode?: MessageGenerationMode
  dialogueInitialMessage?: string
  dialogueInitialMessageInstructions?: string
  dialogueInstructionsMode?: MessageGenerationMode
  dialogueInstructions?: string
  dialogueInstructionsPrompt?: string
  dialogueLengthMode?: DialogueLengthMode
  dialogueLength?: number
  dialogueLengthInstructions?: string
  dialogueLengthModerator?: string
  // Message sender control for non-dialogue rounds
  messageSenderMode?: DialogueMode
  messageSenderInstructions?: string
  messageSenderModerator?: string
  // Conditional transition fields
  transitionModerator?: string
  transitionPrompt?: string
  transitionConditions?: Array<{
    roundId: string
    condition: string
  }>
}

// API types
export interface RoundData {
  id: string
  type: RoundType
  depth: DepthLevel
  lengthType: LengthType
  lengthNumber?: number
  lengthRounds?: number
  outputNumber?: number
  sequence: number
  participants: string[] // Agent IDs
  participantMode?: ParticipantMode
  participantGenerationPrompt?: string
  participantLengthType?: ParticipantLengthType
  participantLength?: number
  action?: RoundActionType
  stanceType?: StanceType
  stances?: RoundStance[]
  instructions?: string
  showPrompts?: boolean
  agentQuestions?: boolean
  agentSelfReflection?: boolean
  modelSelectionMode?: 'agent' | 'random' | 'specific'
  selectedModel?: string
  participantOrder?: ParticipantOrder
  participantOrderPrompt?: string
  transition?: TransitionType
  moderatorAgentId?: string
  lengthModerator?: string
  lengthPrompt?: string
  agentIsolation?: boolean
  dataTool?: DataTool
  messageSenderMode?: DialogueMode
  messageSenderInstructions?: string
  messageSenderModerator?: string
  transitionModerator?: string
  transitionPrompt?: string
  transitionConditions?: Array<{
    roundId: string
    condition: string
  }>
}

// First, let's define the available input types
export type RoundInputType = 
  | 'participant' 
  | 'participants' 
  | 'depth'
  | 'limitByTotal'
  | 'limitByRounds'
  | 'stance'
  | 'outputNumber'
  | 'options'
  | 'dataTool'

// Configuration for each round type
export const ROUND_INPUT_CONFIG: Record<RoundType, RoundInputType[]> = {
  'debate': ['participants', 'depth', 'limitByTotal', 'limitByRounds', 'stance', 'dataTool'],
  'brainstorm': ['participants', 'depth', 'outputNumber', 'limitByTotal', 'limitByRounds', 'dataTool'],
  'dialogue': ['participants', 'depth', 'limitByTotal', 'limitByRounds', 'dataTool'],
  'survey': ['participants', 'depth', 'limitByTotal', 'limitByRounds', 'dataTool'],
  'explore': ['participants', 'depth', 'limitByTotal', 'limitByRounds', 'dataTool'],
  'critique': ['participants', 'depth', 'limitByTotal', 'limitByRounds', 'dataTool'],
  'review': ['participants', 'depth', 'dataTool'],
  'understand': ['participants', 'depth', 'limitByTotal', 'limitByRounds', 'dataTool'],
  'custom': ['participants', 'depth', 'limitByTotal', 'limitByRounds', 'options', 'dataTool'],
}

// Helper function to check if an input should be shown
export const shouldShowInput = (roundType: RoundType, inputType: RoundInputType): boolean => {
  return ROUND_INPUT_CONFIG[roundType]?.includes(inputType) ?? false
}

// Draft types for editing rounds
export interface RoundFlowDraft {
  lengthType: Round['lengthType']
  lengthNumber: Round['lengthNumber']
  lengthRounds: Round['lengthRounds']
  participantOrder: Round['participantOrder']
  participantOrderPrompt: string
  transition: Round['transition']
  moderatorAgentId: string
  lengthModerator: string
  lengthPrompt: string
  messageSenderMode: DialogueMode
  messageSenderInstructions: string
  messageSenderModerator: string
  transitionModerator: string
  transitionPrompt: string
  transitionConditions: Array<{ roundId: string; condition: string }>
}

// Helper function to create a draft from a round for flow editing
export function createRoundFlowDraft(round: Round): RoundFlowDraft {
  return {
    lengthType: round.lengthType,
    lengthNumber: round.lengthNumber,
    lengthRounds: round.lengthRounds,
    participantOrder: round.participantOrder || 'default',
    participantOrderPrompt: round.participantOrderPrompt || '',
    transition: round.transition || 'user',
    moderatorAgentId: round.moderatorAgentId || '',
    lengthModerator: round.lengthModerator || '',
    lengthPrompt: round.lengthPrompt || '',
    messageSenderMode: round.messageSenderMode || 'all_participants',
    messageSenderInstructions: round.messageSenderInstructions || '',
    messageSenderModerator: round.messageSenderModerator || '',
    transitionModerator: round.transitionModerator || '',
    transitionPrompt: round.transitionPrompt || '',
    transitionConditions: round.transitionConditions || []
  }
}

export interface RoundStyleDraft {
  depth: DepthLevel
  creativityType: string
  creativityIndex: number
}

export function createRoundStyleDraft(round: Round): RoundStyleDraft {
  // Convert creativityNumber back to index for the slider
  const CREATIVITY_LABELS = { 0: { value: 0 }, 1: { value: 0.5 }, 2: { value: 1 }, 3: { value: 1.5 }, 4: { value: 2 } }
  const initialIndex = round.creativityNumber !== undefined
    ? Object.entries(CREATIVITY_LABELS).find(([_, config]) => config.value === round.creativityNumber)?.[0]
    : '2'

  return {
    depth: round.depth || 'medium',
    creativityType: round.creativityType || 'agent',
    creativityIndex: Number(initialIndex || 2)
  }
} 
export type ModelSelectionMode = 'agent' | 'random' | 'specific'

export interface RoundOptionsDraft {
  instructions: string
  showPrompts: boolean
  agentQuestions: boolean
  agentSelfReflection: boolean
  agentIsolation: boolean
  isPrivate: boolean
  modelSelectionMode: ModelSelectionMode
  selectedModel: string
}

export function createRoundOptionsDraft(round: Round): RoundOptionsDraft {
  return {
    instructions: round.instructions || '',
    showPrompts: round.showPrompts || false,
    agentQuestions: round.agentQuestions || false,
    agentSelfReflection: round.agentSelfReflection || false,
    agentIsolation: round.agentIsolation || false,
    isPrivate: round.isPrivate || false,
    modelSelectionMode: (round.modelSelectionMode as ModelSelectionMode) || 'agent',
    selectedModel: round.selectedModel || ''
  }
}

// Dialogue draft types
export interface RoundDialogueDraft {
  initialMessageMode: 'manual' | 'generate'
  initialMessage: string
  initialMessageInstructions: string
  dialogueInstructionsMode: 'manual' | 'generate'
  dialogueInstructions: string
  dialogueInstructionsPrompt: string
  dialogueLengthMode: 'fixed' | 'agent_decides' | 'moderator_decides'
  dialogueLength: number
  dialogueLengthInstructions: string
  dialogueLengthModeratorAgentId: string
}

export function createRoundDialogueDraft(round: Round): RoundDialogueDraft {
  return {
    initialMessageMode: round.dialogueInitialMessageMode || 'manual',
    initialMessage: round.dialogueInitialMessage || '',
    initialMessageInstructions: round.dialogueInitialMessageInstructions || '',
    dialogueInstructionsMode: round.dialogueInstructionsMode || 'manual',
    dialogueInstructions: round.dialogueInstructions || '',
    dialogueInstructionsPrompt: round.dialogueInstructionsPrompt || '',
    dialogueLengthMode: round.dialogueLengthMode || 'fixed',
    dialogueLength: round.dialogueLength || 10,
    dialogueLengthInstructions: round.dialogueLengthInstructions || '',
    dialogueLengthModeratorAgentId: round.dialogueLengthModerator || ''
  }
}

export interface RoundDialogueSendersDraft {
  senderMode: DialogueMode
  selectedSenders: string[]
  senderInstructions: string
  senderModeratorAgentId: string
}

export function createRoundDialogueSendersDraft(round: Round): RoundDialogueSendersDraft {
  return {
    senderMode: round.dialogueSenderMode || 'all_participants',
    selectedSenders: round.dialogueSelectedSenders || [],
    senderInstructions: round.dialogueSenderInstructions || '',
    senderModeratorAgentId: round.dialogueSenderModerator || ''
  }
}

export interface RoundDialogueReceiversDraft {
  receiverMode: DialogueMode
  selectedReceivers: string[]
  receiverInstructions: string
  receiverModeratorAgentId: string
}

export function createRoundDialogueReceiversDraft(round: Round): RoundDialogueReceiversDraft {
  return {
    receiverMode: round.dialogueReceiverMode || 'all_participants',
    selectedReceivers: round.dialogueSelectedReceivers || [],
    receiverInstructions: round.dialogueReceiverInstructions || '',
    receiverModeratorAgentId: round.dialogueReceiverModerator || ''
  }
}

// Central helper to create a new Round with safe defaults
export function createInitialRound(params: {
  type: RoundType
  participants: ChatAgent[]
  sequence: number
  id?: string
  name?: string
  icon?: Round['icon']
  overrides?: Partial<Round>
}): Round {
  const {
    type,
    participants,
    sequence,
    id = crypto.randomUUID(),
    name = type,
    icon,
    overrides = {},
  } = params

  const base: Round = {
    id,
    type,
    name,
    participants,
    depth: ROUND_DEFAULTS.depth,
    lengthType: ROUND_DEFAULTS.lengthType,
    lengthNumber: 3,
    lengthRounds: 1,
    participantOrder: ROUND_DEFAULTS.participantOrder,
    transition: ROUND_DEFAULTS.transition,
    sequence,
  }

  const withIcon = icon ? ({ ...base, icon } as Round) : base
  return { ...withIcon, ...overrides }
}
