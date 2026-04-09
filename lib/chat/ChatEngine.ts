// chatEngine.ts
import { ChatAgent, User } from "@prisma/client";
import { ConfigService } from "./services/config";
import { RoundService } from "./services/rounds";
import { AgentService } from "./services/agents";
import { ChatState, ChatProgress, Message, ExtendedChatRound } from "./types";
import { setProgress, createInitialProgress, iterateProgress, activateNextProgress, isActiveRoundClosed } from "./services/progress";
import { AdapterFactory } from "./adapters/AdapterFactory";
import { LLMService } from "./services/LLM";
import { ModelService } from "./services/models";
import { UserService } from "./services/user";
import { TokenService } from "@/lib/services/TokenService";
import { MessageServices } from "./services/messages";
import { createUiMessage } from './services/ui-message';
import { ExtractDataService } from "./services/extractdata";
import { ToolsService } from "./services/tools";
import { ChatRoundSessionService } from "./services/sessions";
import { MessageUtils } from "./services/messages";
import { RetentionService } from './services/retention';
import { MemoryService } from './services/memory';
import { prisma } from "@/lib/prisma";
import { randomUUID } from 'crypto';
// Create TokenService instance
const tokenService = new TokenService();

/**
 * This function is called when the chat generation completes.
 * It handles post-processing, saving messages, recording token usage, and streaming updates.
 */
async function onComplete(chatState: ChatState, result: any) {
  
  // console.log('ChatEngine, onComplete()');

  // Don't run completion logic if there was an error
  // Allow tool-only responses (no text but has toolCalls)
  if (result?.error || result?.finishReason === 'error' || (!result?.text && !result?.toolCalls)) {
    return chatState;
  }

  const { activeRound: round, progress, agents } = chatState;
  
  // Capture original dialogue state before iteration updates it for next message
  const originalDialogueState = progress.dialogue && round.type === 'dialogue' ? {
    sender: progress.dialogue.sender,
    receiver: progress.dialogue.receiver
  } : null;
  
  // set progress for next iteration
  const nextProgress = iterateProgress(chatState, result);

  if (isActiveRoundClosed(nextProgress)) {
    
    chatState.adapter.write({
      type: 'data-next-round',
      data: { id: nextProgress.next.round.id }
    });

    // Close the current session when round completes
    if (chatState.currentSessionId) {
      ChatRoundSessionService.closeSession(chatState.currentSessionId);
      
      // This is a bit of a hack to get the final message into the compression
      // The full message object isn't constructed until later, but we need it now
      const finalMessageForCompression: Message = {
        id: '',
        role: 'assistant',
        parts: [{ type: 'text', text: result.text || '' }],
        metadata: { agentId: null, sessionId: chatState.currentSessionId ?? null, roundId: round.id }
      };     
      
      // Compress the completed round session
      RetentionService.handleRoundCompletion(chatState, finalMessageForCompression);
    }
  }
   
  // Extract the full response text
  const fullResponse = result.text || '';

  // extract next agent?
  if (round.participantOrder === 'handoff' || progress.active.agent.mode === 'moderator') {

    // Extract next agent information from the structured format
    const { nextAgentId, cleanedContent } = ToolsService.extractNextAgentInfo(fullResponse);
    
    if (nextAgentId && agents.find((a: any) => a.id === nextAgentId)) {
      
      // Set the next agent in progress
      if (!nextProgress.next.agent) {
        nextProgress.next.agent = {
          id: nextAgentId,
          mode: 'participant'
        };
      } else {
        nextProgress.next.agent.id = nextAgentId;
      }
      
      // Update the response text to remove the agent selection format
      result.text = cleanedContent;
      
      if (result.response?.messages && result.response.messages.length > 0) {
        result.response.messages[0].content = cleanedContent;
      }
    }
  }

  if (round.showPrompts && isActiveRoundClosed(progress)) {
    const promptSuggestions = result.response.messages[1].content[0].result.promptSuggestions;
    if (promptSuggestions) {
      chatState.adapter.write({
        type: 'data-prompt-suggestions',
        data: promptSuggestions
      });
    }
  }

  // stream back the next progress
  chatState.adapter.write({
    type: 'data-progress',
    data: nextProgress
  });

  // record token usages
  recordTokenUsageInternal(chatState, result);

  const message: Message = {
    id: '',
    role: 'assistant',
    parts: [{ type: 'text', text: result.text || '' }],
    metadata: { agentId: null, sessionId: chatState.currentSessionId ?? null, roundId: round.id }
  };

  // persist chat and data
  if (chatState.chat.persistenceMode === 'save') {

    const messageState = {
      ...chatState
    };

    // message progress should reflect next progress  
    messageState.progress = nextProgress;

    // Build a unified UIMessage for persistence
    const dataParts = chatState.adapter.getCollectedDataParts();
    const extraMeta = chatState.adapter.getCollectedMetadata();
    const responseUiMessage = ((result as any)?.responseMessage as any) ?? createUiMessage({
      role: 'assistant',
      text: result?.text || '',
      dataParts,
      metadata: {
        createdAt: Date.now(),
        model: ((chatState.llmParams as any)?.model?.modelId || (chatState.llmParams as any)?.model?.id || 'unknown'),
        agentId: chatState?.activeAgent?.id,
        roundId: chatState?.activeRound?.id,
        sessionId: (chatState as any)?.currentSessionId,
        totalTokens: (result as any)?.usage?.totalTokens,
        prompts: {
          system: chatState?.meta?.prompts?.system || '',
          instructions: chatState?.meta?.prompts?.instructions || ''
        },
        ...extraMeta,
      },
    });


    // Update message with full content (message was pre-created in initialize())
    // Use updateChatMessage to UPDATE instead of INSERT
    const savedMessage = await MessageServices.updateChatMessage(
      chatState.messageId!,  // Use pre-generated ID from initialize()
      messageState,
      'assistant',
      result.text,
      result,
      chatState.llmParams?.model,
      originalDialogueState,
      responseUiMessage
    );

    // Ensure metadata is assigned if present
    if (savedMessage.metadata) {
      message.metadata = savedMessage.metadata as unknown as Message['metadata'];
    }

    // check to extract message data, passing the saved message
    await ExtractDataService.saveMessageData(chatState, savedMessage);

    // Process memory operations from tool results
    await MemoryService.processMessageResultMemories(chatState, result, savedMessage.id);

    // Reset adapter-collected data for the next turn
    if (typeof (chatState.adapter as any).resetCollected === 'function') {
      (chatState.adapter as any).resetCollected();
    }
  }

  // Set the state for the next chat iteration
  const nextChatState = {
    ...chatState,
    messages: [...chatState.messages, message],
    progress: nextProgress
  };

  // Activate the next progress state
  nextChatState.progress = activateNextProgress(nextChatState.progress);

  return nextChatState;
}

async function recordTokenUsageInternal(chatState: ChatState, result: any) {
  // Add a guard to ensure result is a valid object
  if (!result || !result.usage) {
    return;
  }

  const usage = result.usage;
  
  // Ensure usage is a valid object with expected properties
  if (!usage || typeof usage !== 'object') {
    console.warn('TokenService: Invalid usage object received:', usage);
    return;
  }
    
  // Record token usage for the user if there are any tokens to record
  if (chatState.user.id && (usage.inputTokens || usage.outputTokens)) {
    try {
      // Pass spaceId if config has one (indicating this is a space app)
      const context = {
        userId: chatState.user.id,
        spaceId: chatState.config?.spaceId || undefined
      };
      await tokenService.recordTokenUsage(context, usage);
    } catch (error) {
      console.error('Error recording token usage in TokenService:', error);
      // Log the specific usage object that caused the failure for deeper analysis
      console.error('Failed to record the following usage object:', usage ? JSON.stringify(usage, null, 2) : 'null or undefined');
    }
  }
}

// --- Exported ChatEngine Object --- 

export const ChatEngine = {
  /** Creates the initial state object for a chat session */
  createState(chat: ChatState['chat']): ChatState {
    const adapter = AdapterFactory.getAdapter({ streaming: chat.generationMode === 'stream' });
    return {
      chat,
      config: null,
      rounds: [],
      activeRound: {} as ExtendedChatRound,
      agents: [],
      activeAgent: {} as ChatAgent,
      progress: {} as ChatProgress,
      messages: [],
      sessions: [],
      adapter: adapter,
      user: {} as User,
      languageModels: {},
    };
  },

  /** Initializes chat state by fetching config, rounds, agents */
  async initialize(
    chatState: ChatState, 
    configId: string,
    initialProgress: ChatProgress | null
  ): Promise<ChatState> {
    
    // Only fetch data that's not already in chatState (check for undefined/null AND empty arrays)
    const sessions = (chatState.chat.persistenceMode === 'save' && (!chatState.sessions || chatState.sessions.length === 0))
      ? await ChatRoundSessionService.getChatSessions(chatState.chat.id)
      : chatState.sessions || [];
    
    const config = chatState.config || (await ConfigService.retrieve(configId));
    const rounds = (chatState.rounds && chatState.rounds.length > 0) ? chatState.rounds : await RoundService.getRounds(configId);
    if (!rounds) throw new Error('Config has no rounds');
    
    const activeRoundId = initialProgress?.active.round.id || rounds[0].id;

    // Create the initial progress if not provided or if it's empty
    if (!initialProgress || !initialProgress.active || !initialProgress.active.round) {
      initialProgress = createInitialProgress(activeRoundId);
    }

    const activeRound = await RoundService.getRound(configId, activeRoundId);
    if (!activeRound) throw new Error('No active round found');
    
    // Load agents - for dynamic rounds, we'll need to combine selected agents with session-specific dynamic agents
    let agents: ChatAgent[] = [];
    if (chatState.agents && chatState.agents.length > 0) {
      agents = chatState.agents;
    } else {
      // Get all selected agents from rounds
      agents = await AgentService.getAllAgentsInRounds(rounds);
    }
    
    // Load user and language models (space-aware)
    const user = chatState.user || (await UserService.retrieve(chatState));
    const languageModels = (chatState.languageModels && Object.keys(chatState.languageModels).length > 0) 
      ? chatState.languageModels 
      : await ModelService.initializeContextualModels(user.id, config?.spaceId ?? undefined, configId);

    // Create the initial chat
    let updatedChatState: ChatState = {
      ...chatState,
      config,
      rounds,
      activeRound: {
        ...activeRound,
        participants: [] // Will be populated after agent loading
      } as ExtendedChatRound,
      agents,
      messages: chatState.messages,
      user,
      progress: initialProgress,
      sessions,
      languageModels,
    };

    // Extract session ID from progress if present (e.g., from replay)
    // This allows session reuse instead of creating a new session
    if (initialProgress?.active && (initialProgress.active as any).session?.id) {
      updatedChatState.currentSessionId = (initialProgress.active as any).session.id;
    }

    // Initialize session
    updatedChatState = await ChatRoundSessionService.initializeSession(updatedChatState);
    
    // Normalize messages, ensuring user messages have session IDs
    updatedChatState.messages = MessageUtils.normalizeMessages(
      updatedChatState.messages, 
      updatedChatState.currentSessionId
    );

    // Handle dynamic agent generation and loading
    if (activeRound.participantMode === 'GENERATE') {
      
      // Generate agents synchronously without streaming (stream not available yet)
      // Pass the full chat state so the agent service can generate message history if needed
      const sessionAgentResult = await AgentService.getOrCreateSessionAgents(
        updatedChatState.currentSessionId!,
        activeRound,
        config.userId, // Use config owner's ID, not chat participant's ID
        updatedChatState // Pass full chat state for context-aware generation
      );
      
      // Add dynamic agents to existing selected agents
      if (sessionAgentResult.agents.length > 0) {
        updatedChatState.agents = [...updatedChatState.agents, ...sessionAgentResult.agents];
        
        // Only stream agents if they were newly created, not if they already existed
        if (sessionAgentResult.wasNewlyCreated) {
          updatedChatState.newDynamicAgents = sessionAgentResult.agents;
        }
      }
    }

    // Update ExtendedChatRound with final participant list (after potential dynamic agent loading)
    const finalParticipants = activeRound.participantMode === 'GENERATE'
      ? updatedChatState.agents.filter(agent => agent.isDynamic) // For dynamic rounds, use only dynamic agents
      : activeRound.participants
          ?.map(p => updatedChatState.agents.find(agent => agent.id === p.id))
          .filter(Boolean) as ChatAgent[];

    updatedChatState.activeRound = {
      ...updatedChatState.activeRound,
      participants: finalParticipants
    };

    // Set the progress with the updated state
    updatedChatState = await setProgress(updatedChatState);

    // Set the initial active agent
    const activeAgent = updatedChatState.agents.find(agent => agent.id === updatedChatState.progress.active.agent.id);
    if (!activeAgent) {
      console.error('No active agent found! Available agents:', updatedChatState.agents.map(a => ({ id: a.id, name: a.name, isDynamic: a.isDynamic })));
      throw new Error('No active agent found');
    }
    updatedChatState.activeAgent = activeAgent;

    // Pre-generate message ID and create minimal message record
    // This allows us to stream the database UUID to the client immediately
    // and UPDATE the message later in onComplete() instead of INSERTing
    const messageId = randomUUID();

    await prisma.message.create({
      data: {
        id: messageId,
        chatId: updatedChatState.chat.id,
        branchId: updatedChatState.chat.branchId,
        role: 'assistant',
        content: {},  // Empty JSON for now, will be updated in onComplete
        createdAt: new Date(),
        isActive: true,
        branchPath: updatedChatState.chat.activeBranchPath,
        metadata: {},
        chatRoundSessionId: updatedChatState.currentSessionId
      }
    });

    // Attach message ID to state so it's available in streaming and onComplete
    updatedChatState.messageId = messageId;
    console.log('[ChatEngine] Pre-created message with ID:', messageId);

    return updatedChatState
  },

  /** Processes chat generation for the current state (handles user messages and agent turns) */
  async generateChat(chatState: ChatState) {
    if (!chatState.config) throw new Error('Config not initialized');

    const params = await LLMService.getLLMParams(chatState);
    chatState.llmParams = params; // Store LLM params in state
    
    const result = await chatState.adapter.execute(chatState, params);
    
    // We still need to call the onFinish handler manually after generateText completes
    if (params.onFinish) {
      params.onFinish(result); // Pass the raw response? Or a formatted one?
    }

    const nextChatState = await onComplete(chatState, result);

    return { result, nextChatState };
  },

  /** Initiates a streaming response for the current state */
  async streamChat(chatState: ChatState) {
    if (!chatState.config) throw new Error('Config not initialized');

    // Debug logging for moderator streaming
    console.log('[ChatEngine.streamChat] Starting stream:', {
      agentMode: chatState.progress?.active?.agent?.mode,
      agentId: chatState.progress?.active?.agent?.id,
      activeAgentName: chatState.activeAgent?.name,
      hasVerbatimMessage: !!chatState.moderatorVerbatimMessage,
      verbatimPreview: chatState.moderatorVerbatimMessage?.substring(0, 100)
    });

    // Stream newly created dynamic agents as the first data if they exist
    if (chatState.newDynamicAgents && chatState.newDynamicAgents.length > 0) {
      
      const agentData = {
        agents: chatState.newDynamicAgents
      };
      chatState.adapter.write({
        type: 'data-agents',
        data: agentData
      });
    }
    // if dialogue, write dialogue data to metadata
    if (chatState.activeRound.type === 'dialogue') {
      chatState.adapter.write({
        type: 'data-dialogue',
        data: {
          senderId: chatState.progress.dialogue?.sender,
          receiverId: chatState.progress.dialogue?.receiver
        }
      });
    }

    const params = await LLMService.getLLMParams(chatState, onComplete);
    chatState.llmParams = params; // Store LLM params in state
    return chatState.adapter.execute(chatState, params);
  },
};
