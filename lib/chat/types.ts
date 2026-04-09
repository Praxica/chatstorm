import { User } from '@prisma/client';
import { ChatProgress } from '@/lib/types/chat-progress';

import { ChatAgent } from "@prisma/client";
import type { Config, ChatRound } from '@/lib/schemas/prisma-typed';
import type { ChatMessage } from '@/lib/schemas/message';
import { BaseAdapter } from './adapters/BaseAdapter';
import { ChatRoundSessionData } from './services/sessions';
import { LanguageModel } from 'ai';

// Re-export ChatMessage as Message for backward compatibility within the engine.
// ChatMessage (parts-based, from Vercel AI SDK) is the canonical runtime shape.
// DB reads/writes convert to/from Prisma's Message schema at the boundary.
export type Message = ChatMessage;

export interface LLMParams {
  experimental_transform?: any;
  model: any;
  system: string;
  messages: any[];
  onFinish?: (result: any) => void;
  tools?: any;
  temperature?: number;
  maxSteps?: number;
  toolChoice?: 'auto' | 'required' | 'none';
  maxRetries?: number;
  maxToolRoundtrips?: number;
}

export type PersistenceMode = "save";
export type GenerationMode = "stream" | "text";

export interface ChatState {
  chat: {
    id: string;
    persistenceMode: PersistenceMode;
    generationMode: GenerationMode;
    branchId: string;
    activeBranchPath: string[];
  }
  config: Config | null;
  rounds: ChatRound[];
  activeRound: ExtendedChatRound;
  agents: ChatAgent[];
  activeAgent: ChatAgent;
  progress: ChatProgress;
  messages: Message[];
  sessions: ChatRoundSessionData[];
  adapter: BaseAdapter;
  user: User;
  currentSessionId?: string;
  messageId?: string; // Pre-generated database UUID for the current assistant message
  userMessageId?: string; // Database UUID for the user message that triggered this response
  languageModels: Record<string, LanguageModel>;
  llmParams?: LLMParams; // Current LLM parameters used for generation
  moderatorVerbatimMessage?: string; // Message for moderator to stream verbatim
  newDynamicAgents?: ChatAgent[]; // For streaming newly created dynamic agents
  agentsAlreadyStreamed?: boolean; // Flag to prevent duplicate streaming
  meta?: {
    prompts?: {
      system: string;
      instructions: string;
      moderatorOriginal?: string; // Original moderator prompt (not verbatim)
    };
    expectedToolCount?: number;
    // Room for future metadata like timing, token counts, etc.
  };
}

// Export ChatProgress from the shared type module
export type { ChatProgress } from '@/lib/types/chat-progress';

/**
 * Represents a chat message
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  annotations?: Array<{
    type: string;
    content: any;
  }>;
  metadata?: {
    roundId?: string;
    progress?: ProgressState;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
}
 */

/**
 * Represents the state of progress in a chat
export interface ProgressState {
  currentStep: string;
  messageCount: number;
  messageAuthors: string[];
  nextAgent?: string;
  agent?: {
    id: string;
    name: string;
  };
  agentMode?: 'moderator' | 'participant';
  isComplete?: boolean;
  nextRoundId?: string;
  nextStep?: 'user' | 'api';
}
 */

/**
 * Configuration for a chat
export interface ChatConfig {
  id: string;
  name: string;
  description?: string;
  rounds: RoundConfig[];
}
 */

/**
 * Configuration for a chat round
export interface RoundConfig {
  id: string;
  name: string;
  type: string;
  sequence: number;
  participants: ParticipantConfig[];
  depth?: string;
  lengthType?: string;
  lengthNumber?: number;
  lengthRounds?: number;
  transition?: string;
  participantOrder?: string;
  moderatorAgentId?: string;
  agentIsolation?: boolean;
  showPrompts?: boolean;
  agentQuestions?: boolean;
  agentSelfReflection?: boolean;
  stances?: Array<{
    agentId: string;
    stance: string;
  }>;
  dataTool?: {
    instructions: string;
    parameters: Array<{
      name: string;
      description: string;
      type: string;
    }>;
  };
  instructions?: string;
  action?: string;
  outputNumber?: number;
  creativityType?: string;
  creativityNumber?: number;
  stanceType?: string;
}
 */

/**
 * Configuration for a participant in a chat round
export interface ParticipantConfig {
  id: string;
}
 */

/**
 * Represents an agent in the chat
export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  temperature?: number;
}
 */

/**
 * Request parameters for a chat operation
export interface ChatRequest {
  configId: string;
  chatId: string;
  messages: Message[];
  roundId?: string;
  mode?: 'user' | 'preview';
  progress?: ProgressState;
}
 */

/**
 * Response from a non-streaming chat operation
export interface ChatResponse {
  text: string;
  response: {
    messages: Array<{
      role: string;
      content: string | object;
      toolInvocations?: any[];
    }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  progress: ProgressState;
  annotations?: Array<{
    type: string;
    content: any;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
 */

/**
 * Parameters for generation operations
export interface GenerationParams {
  rounds: RoundConfig[];
  round: RoundConfig;
  agents: Agent[];
  progress: ProgressState;
  messages: Message[];
  chatDataService: any;
  progressTrackerService: any;
  toolsService: any;
  dataExtractionService: any;
  modelService: any;
  userId: string | null;
  mode: 'user' | 'preview';
}
 */

// Enhanced ChatRound type that includes participants
export interface ExtendedChatRound extends ChatRound {
  participants: ChatAgent[];
  toolChoice?: 'auto' | 'required' | 'none';
}

// You can now use ExtendedChatRound throughout your codebase

