import { ChatState } from "../types";
import { prisma } from "@/lib/prisma";
import { RetentionService } from './retention';
import { fromDbMessage, type ChatMessage } from '@/lib/schemas/message';
import type { UIMessage } from 'ai';
import { stripMetadata } from '@/lib/chat/services/ui-message';

/**
 * MessageUtils- Main service object containing all message-related methods
 */
export const MessageUtils = {

  /**
   * Normalize messages by ensuring session IDs are properly set
   * Handles both annotation-based normalization and contextual assignment
   * @param messages The messages to normalize
   * @param currentSessionId Optional current session ID for contextual assignment
   * @returns The normalized messages
   */
  normalizeMessages(messages: any[], currentSessionId?: string): any[] {
    const annotationNormalized = messages.map(message => message);
    if (!currentSessionId) return annotationNormalized;

    // Second pass: contextual normalization for messages still missing session IDs
    const normalized = [...annotationNormalized];
    
    // Process messages in chronological order to assign session IDs
    // User messages should be assigned to the session of the following assistant message
    // Assistant messages should be assigned to the current session if they don't have one
    for (let i = 0; i < normalized.length; i++) {
      const message = normalized[i];
      
      // Check for existing session ID (use metadata.sessionId as source of truth)
      const existingSessionId = (message as any)?.metadata?.sessionId;
      if (existingSessionId) {
        continue;
      }
      
      if (message.role === 'user') {
        let assignedSessionId = currentSessionId; // Default to current session (for last user message)
        
        // Look forward to find the next assistant message to get its session ID
        for (let j = i + 1; j < normalized.length; j++) {
          const nextMessage = normalized[j];
          const nextSessionId = (nextMessage as any)?.metadata?.sessionId;
          if (nextMessage.role === 'assistant' && nextSessionId) {
            assignedSessionId = nextSessionId;
            break;
          }
        }
        
        normalized[i] = {
          ...message,
          metadata: {
            ...(message as any).metadata,
            sessionId: assignedSessionId
          }
        };
        
      } else if (message.role === 'assistant') {
        normalized[i] = {
          ...message,
          metadata: {
            ...(message as any).metadata,
            sessionId: currentSessionId
          }
        };
      }
    }
    
    return normalized;
  },


  /**
   * Check if a message is purely a tool call without substantial content
   * @param message The message to check
   * @returns True if the message is only a tool call
   */
  isToolCallOnlyMessage(message: any): boolean {
    // If the finish reason is "tool_calls", this was a pure tool call message
    if (message.finishReason === 'tool_calls') {
      return true;
    }

    // If there are tool invocations but no text content, it's a tool call message
    if (message.toolInvocations && message.toolInvocations.length > 0) {
      const text = (message.parts ?? [])
        .filter((p: any) => p?.type === 'text')
        .map((p: any) => String(p.text ?? ''))
        .join('')
        .trim();
      return text.length === 0;
    }

    return false;
  },

  /**
   * Get actual participants (agents who sent messages) for a specific round session
   * @param sessionId The session ID to analyze
   * @param messages All messages to analyze
   * @returns Array of agent IDs who actually participated in the session
   */
  getActualParticipants(sessionId: string, messages: any[]): string[] {
    const participants = new Set<string>();
    
    // Find the round for this session
    const sessionMessages = messages.filter(msg => (msg as any)?.metadata?.sessionId === sessionId);
    if (sessionMessages.length === 0) {
      return [];
    }
    
    // Only track participants for assistant messages (actual agent responses)
    sessionMessages
      .filter(msg => msg.role === 'assistant')
      .forEach(msg => {
        // Check metadata.agentId field first (current structure)
        const agentId = (msg as any)?.metadata?.agentId;
        if (agentId) {
          participants.add(agentId);
        } else {
          // Legacy: check annotations for old data
          const agentAnnotation = msg.annotations?.find((a: any) => a.type === 'agent');
          if (agentAnnotation) {
            participants.add(agentAnnotation.content);
          }
        }
      });
    
    return Array.from(participants);
  },

  /**
   * Utility function to exclude an agent message and its preceding user messages
   * to maintain proper conversation cadence (user > assistant > user > assistant)
   * @param messagesToProcess Array of messages to process
   * @param messagesToExclude Set to add excluded message indices to
   * @param messageIndex Index of the agent message to exclude
   * @param currentSessionId Current session ID for filtering
   */
  excludeAgentAndPrecedingUserMessages(
    messagesToProcess: any[], 
    messagesToExclude: Set<number>, 
    messageIndex: number, 
    currentSessionId?: string
  ) {
    // Mark the agent message for exclusion
    messagesToExclude.add(messageIndex);
    
    // Also mark the preceding user message(s) for exclusion
    // Look backwards to find user messages that should be excluded with this assistant message
    for (let j = messageIndex - 1; j >= 0; j--) {
      const prevMsg = messagesToProcess[j];
      
      // If we hit another assistant message, stop looking
      if (prevMsg.role === 'assistant') {
        break;
      }
      
      // If this is a user message, exclude it
      // If currentSessionId is provided, only exclude if it matches
      if (prevMsg.role === 'user') {
        if (!currentSessionId || (prevMsg as any)?.metadata?.sessionId === currentSessionId) {
          messagesToExclude.add(j);
        }
      }
    }
  },

  /**
   * Sanitize messages to only include role and content
   * Optionally filter out messages based on agent isolation settings
   * @param chatState The chat state containing agents and round info
   * @param messages Optional messages array to sanitize (defaults to chatState.messages)
   * @param isModeratorContext Optional flag indicating this is for moderator use (bypasses agent isolation)
   * @returns Sanitized messages
   */
  sanitizeMessages(chatState: ChatState, messages?: any[], isModeratorContext: boolean = false): UIMessage[] {

    const {messages: stateMessages, agents, activeAgent:agent, activeRound:round, currentSessionId, rounds, sessions} = chatState;
    const messagesToProcess = messages || stateMessages;

    // First, identify which messages to exclude for agent isolation, dialogue privacy, and private rounds
    const messagesToExclude = new Set<number>();
    
    for (let i = 0; i < messagesToProcess.length; i++) {
      const msg = messagesToProcess[i];
      
      // Check for dialogue privacy - filter out dialogue messages where current agent is not a participant
      const dialoguePart = Array.isArray(msg.parts) ? msg.parts.find((p: any) => p?.type === 'data-dialogue')?.data : undefined;
      if (!isModeratorContext && dialoguePart) {
        const senderId = dialoguePart.senderId;
        const receiverId = dialoguePart.receiverId;
        if (agent.id !== senderId && agent.id !== receiverId && msg.role === 'assistant') {
          this.excludeAgentAndPrecedingUserMessages(messagesToProcess, messagesToExclude, i);
          continue;
        }
      }
      
      // Check for private round filtering - exclude messages from private rounds where current agent did not participate
      // IMPORTANT: Only filter messages from NON-CURRENT sessions (completed rounds)
      // Use metadata.sessionId as the canonical session identifier (works for both DB-loaded and client-side messages)
      const msgSessionId = (msg as any)?.metadata?.sessionId;
      if (msgSessionId && msgSessionId !== currentSessionId) {
        // Find the round for this message's session
        const messageSession = sessions.find(s => s.id === msgSessionId);
        if (messageSession) {
          const messageRound = rounds.find(r => r.id === messageSession.roundId);
          
          // If the round was private and the current agent didn't participate, exclude the message
          if ((messageRound as any)?.isPrivate) {
            const actualParticipants = this.getActualParticipants((msg as any)?.metadata?.sessionId, messagesToProcess);
            
            // If current agent wasn't an actual participant, exclude this message and preceding user messages
            if (!actualParticipants.includes(agent.id) && msg.role === 'assistant') {
              this.excludeAgentAndPrecedingUserMessages(messagesToProcess, messagesToExclude, i);
              continue; // Skip further processing for this message
            }
          }
        }
      }
      
      // Check for agent isolation (skip for moderators who need access to all messages)
      // Use metadata.sessionId as the canonical session identifier (works for both DB-loaded and client-side messages)
      if (round?.agentIsolation && !isModeratorContext) {
        const isCurrentSession = msgSessionId === currentSessionId;
        const messageAgentId = (msg as any)?.metadata?.agentId;
        if (isCurrentSession && messageAgentId && messageAgentId !== agent.id && msg.role === 'assistant') {
          this.excludeAgentAndPrecedingUserMessages(messagesToProcess, messagesToExclude, i, currentSessionId);
        }
      }
    }


    const sanitizedMessages = messagesToProcess.filter((_msg: any, index: number) => {
      return !messagesToExclude.has(index);
    }).map((msg: any) => {
      // Derive content from UIMessage parts (fallback to legacy content string)
      let content: string = '';
      if (Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((p: any) => p?.type === 'text')
          .map((p: any) => String(p.text ?? ''))
          .join('');
      } else if (typeof msg.content === 'string') {
        content = msg.content;
      }
      
      // Check if this message is from an agent and process it
      const messageAgent = agents.find((a: any) => a.id === (msg as any)?.metadata?.agentId);
      if (messageAgent) {
        // Always strip <SELF> tags from other agents' messages (privacy)
        // Never strip <SELF> tags from your own messages (you can always see your own thoughts)
        const isOwnMessage = messageAgent.id === agent.id;
        const shouldStripSelfReflection = !isOwnMessage;
        
        if (shouldStripSelfReflection) {
          const hasSelfReflection = /<SELF>[\s\S]*?<\/SELF>/g.test(content);
          if (hasSelfReflection) {
            content = content.replace(/<SELF>[\s\S]*?<\/SELF>/g, '');
          }
        }
        const hasAgentTag = /<AGENT>.*?<\/AGENT>/.test(content);
        if (!hasAgentTag) {
          content = `<AGENT>${messageAgent.name}<\/AGENT>${content}`;
        }
      }
 
      return {
        role: msg.role as 'user' | 'assistant',
        parts: [{ type: 'text', text: String(content ?? '') }]
      } as any;
    });


    return sanitizedMessages;
  },

  /**
   * Convert a database message to the canonical ChatMessage format.
   * Delegates to fromDbMessage() from lib/schemas/message.ts.
   */
  convertDatabaseMessage(dbMessage: any): ChatMessage {
    return fromDbMessage(dbMessage);
  },

  /**
   * Apply compressions to messages by replacing completed round sessions with summaries
   * @param chatId The chat ID to get sessions for
   * @param messages The messages to potentially compress
   * @param rounds All rounds for context
   * @returns Messages with compressions applied
   */
  // This function is now obsolete. The logic will be handled in `buildLlmMessages`
  /* async applyCompressions(chatId: string, messages: any[], rounds: any[] = []) {
   // ...
  }, */

  buildLlmMessagesForModerator(chatState: ChatState): UIMessage[] {
    return this.buildLlmMessages(chatState, true);
  },

  buildLlmMessages(chatState: ChatState, isModeratorContext: boolean = false): UIMessage[] {
    const { sessions, messages: allMessages, rounds, config } = chatState;
    const llmMessages: UIMessage[] = [] as any;


    if (!config) {
        return allMessages.map(m => ({ role: m.role, parts: m.parts ?? [{ type: 'text', text: '' }] } as any));
    }

    const chatRetentionSettings = RetentionService.getChatRetentionSettings((config as any).retentionSettings);
    const completedSessions = sessions.filter(s => !s.isActive);
    const ongoingSessions = sessions.filter(s => s.isActive);

    // Pre-group messages by session for performance
    const messagesBySession = new Map<string, any[]>();
    allMessages.forEach(msg => {
      const sessionId = (msg as any)?.metadata?.sessionId;
      if (sessionId) {
        if (!messagesBySession.has(sessionId)) {
          messagesBySession.set(sessionId, []);
        }
        messagesBySession.get(sessionId)!.push(msg);
      }
    });

    const sessionsToProcess = [...completedSessions, ...ongoingSessions];

    // Process sessions chronologically
    sessionsToProcess.forEach((session, _index) => {
      const round = rounds.find(r => r.id === session.roundId);
      if (!round) {
        return;
      }

      const roundRetentionSettings = RetentionService.getRoundRetentionSettings((round as any).retentionSettings);
      let policy: 'keep_full' | 'summarize' | 'ignore' = roundRetentionSettings.policy as 'keep_full' | 'summarize' | 'ignore';

      // For active sessions, always keep full regardless of policy
      if (session.isActive) {
        policy = 'keep_full';
      }
      // For completed sessions, check if chat-level settings override the round policy
      else {
        const sessionIndex = completedSessions.findIndex(s => s.id === session.id);
        const roundsAgo = completedSessions.length - sessionIndex;

        // Chat-level ignore overrides everything - if a round is too old, ignore it regardless of round policy
        if (chatRetentionSettings.ignore.enabled && roundsAgo >= chatRetentionSettings.ignore.afterRounds) {
          policy = 'ignore';
        }
      }
      


      // Check if this session is from a private round and current agent didn't participate
      const isPrivateRound = (round as any)?.isPrivate;
      const isCurrentActiveSession = session.isActive;
      
      if (isPrivateRound && !isCurrentActiveSession) {
        // Only filter completed private sessions, never filter the current active session
        const actualParticipants = this.getActualParticipants(session.id, allMessages);
        const shouldIncludeSession = actualParticipants.includes(chatState.activeAgent.id);
        
        if (!shouldIncludeSession) {
          // Skip this entire session for private rounds where agent didn't participate
          return;
        }
      }

      // Apply the determined policy
      switch(policy) {
        case 'summarize':

          if (session.compressionData) {
            // Check if this session has dialogue-specific summaries
            if (session.compressionData.dialogues) {
              const currentAgent = chatState.activeAgent;
              const dialogueEntries = Object.entries(session.compressionData.dialogues);

              // Add dialogue summaries that the current agent participated in
              for (const [, dialogueData] of dialogueEntries) {
                const data = dialogueData as { summary: string; participants: [string, string]; originalMessageCount: number };
                const [senderId, receiverId] = data.participants;

                // Include dialogue summary if current agent was a participant
                if (currentAgent.id === senderId || currentAgent.id === receiverId) {
                  llmMessages.push({ role: 'user', parts: [{ type: 'text', text: `The following summarizes a previous private dialogue between ${senderId} and ${receiverId}:` }] } as any);
                  llmMessages.push({ role: 'assistant', parts: [{ type: 'text', text: String(data.summary ?? '') }] } as any);
                }
              }

              // Add general summary if present (for non-dialogue messages)
              if (session.compressionData.summary) {
                llmMessages.push({ role: 'user', parts: [{ type: 'text', text: 'The following summarizes previous general conversation:' }] } as any);
                llmMessages.push({ role: 'assistant', parts: [{ type: 'text', text: String(session.compressionData.summary ?? '') }] } as any);
              }
            }
            // Handle standard compression format (no dialogues)
            else if (session.compressionData.summary) {
              llmMessages.push({ role: 'user', parts: [{ type: 'text', text: 'The following summarizes previous messages in this conversation.' }] } as any);
              llmMessages.push({ role: 'assistant', parts: [{ type: 'text', text: String(session.compressionData.summary ?? '') }] } as any);
            }
          } else {
            // Fallback to full messages if compression data is not available
            const sessionMessages = messagesBySession.get(session.id) || [];
            const sanitizedMessages = this.sanitizeMessages(chatState, sessionMessages, isModeratorContext);
            llmMessages.push(...sanitizedMessages);
          }
          break;
        case 'keep_full':
          const sessionMessages = messagesBySession.get(session.id) || [];
          const sanitizedMessages = this.sanitizeMessages(chatState, sessionMessages, isModeratorContext);
          llmMessages.push(...sanitizedMessages);
          break;
        case 'ignore':
          // Do nothing - messages are ignored
          break;
      }

    });

    
    return llmMessages;
  }
}

export const MessageServices = {
  async saveChatMessage(
    chatState: ChatState,
    role: 'user' | 'assistant',
    _content: string,
    result?: any, // Optional: Only relevant for assistant messages (for tokens)
    _model?: any, // Unused when UIMessage is provided
    _originalDialogueState?: { sender: string | undefined, receiver: string | undefined } | null, // Unused when UIMessage is provided
    uiMessage?: UIMessage // REQUIRED: save this full UI message JSON directly
  ) {
    const { activeAgent } = chatState;
    const usage = result?.usage || {};
    if (!uiMessage) {
      throw new Error('saveChatMessage requires a UIMessage. Legacy save path removed.');
    }
    let promptTokens = null;
    let completionTokens = null;
    let totalTokens = null;
    if (role === 'assistant' && usage) {
      promptTokens = usage.inputTokens || null;
      completionTokens = usage.outputTokens || null;
      totalTokens = usage.totalTokens || null;
    }
    // Store the AI SDK's message ID in metadata for replay functionality
    const metadata = (uiMessage as any)?.metadata ?? {};
    if (uiMessage.id) {
      metadata.sdkMessageId = uiMessage.id;
    }

    const createdMessage = await prisma.message.create({
      data: {
        chatId: chatState.chat.id,
        branchId: chatState.chat.branchId,
        role: role,
        // Store UIMessage without metadata to avoid duplication; DB metadata is the source of truth
        content: stripMetadata(uiMessage as any),
        createdAt: new Date(),
        agentId: role === 'assistant' ? (activeAgent?.id ?? null) : null,
        isActive: true,
        branchPath: chatState.chat.activeBranchPath,
        metadata,
        annotations: [],
        promptTokens,
        completionTokens,
        totalTokens,
        chatRoundSessionId: (chatState as any)?.currentSessionId
      }
    });
    return createdMessage;
  },

  async updateChatMessage(
    messageId: string,
    chatState: ChatState,
    role: 'user' | 'assistant',
    _content: string,
    result?: any,
    _model?: any,
    _originalDialogueState?: { sender: string | undefined, receiver: string | undefined } | null,
    uiMessage?: UIMessage
  ) {
    const { activeAgent } = chatState;
    const usage = result?.usage || {};
    if (!uiMessage) {
      throw new Error('updateChatMessage requires a UIMessage.');
    }

    let promptTokens = null;
    let completionTokens = null;
    let totalTokens = null;
    if (role === 'assistant' && usage) {
      promptTokens = usage.inputTokens || null;
      completionTokens = usage.outputTokens || null;
      totalTokens = usage.totalTokens || null;
    }

    // Store the AI SDK's message ID in metadata if different from database ID
    const metadata = (uiMessage as any)?.metadata ?? {};
    if (uiMessage.id && uiMessage.id !== messageId) {
      metadata.sdkMessageId = uiMessage.id;
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: stripMetadata(uiMessage as any),
        metadata,
        agentId: role === 'assistant' ? (activeAgent?.id ?? null) : null,
        promptTokens,
        completionTokens,
        totalTokens
      }
    });

    return updatedMessage;
  },

}; 