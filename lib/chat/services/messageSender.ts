import { ChatState, ChatProgress } from '../types';
import { LLMService } from './LLM';
import { tool } from 'ai';
import { z } from 'zod';
import { MemoryService } from './memory';

/**
 * MessageSenderService - Handles message sender control for non-dialogue rounds
 * Determines which agents are allowed to send messages based on round configuration
 */

export const MessageSenderService = {
  /**
   * Initialize message senders tracking
   */
  initializeMessageSenders() {
    return {
      allowed: [],
      determined: false
    };
  },

  /**
   * Main entry point - handles message sender determination for non-dialogue rounds
   * Called at the beginning of each round, similar to setDialogueProgress
   */
  async setMessageSenderProgress(chatState: ChatState): Promise<ChatState> {
    const { activeRound: round, progress } = chatState;
    
    
    // Skip for dialogue rounds - they have their own sender logic
    if (round.type === 'dialogue') {
      return chatState;
    }
    
    // Skip if already in moderator mode (moderator is streaming),
    // UNLESS we still need to determine message senders first.
    // When a round has both moderator participant order AND moderator-decided
    // message senders, the initial mode is 'moderator' (from activateNextProgress),
    // but sender determination must happen before speaker selection.
    const needsSenderDetermination = !progress.active.senders?.determined &&
      this.shouldDetermineMessageSenders(progress, round);
    if (progress.active.agent.mode === 'moderator' && !needsSenderDetermination) {
      return chatState;
    }
    
    // Initialize message senders if not exists
    if (!progress.active.senders) {
      progress.active.senders = this.initializeMessageSenders();
    }
    
    // Determine which agents can send messages (once per round)
    if (this.shouldDetermineMessageSenders(progress, round)) {
      chatState = await this.determineMessageSenders(chatState);
    }
    
    return chatState;
  },

  /**
   * Check if we should determine message senders
   */
  shouldDetermineMessageSenders(progress: ChatProgress, round: any): boolean {
    // Only for rounds with moderator_decides mode
    const senderMode = round.messageSenderMode || 'all_participants';
    
    if (senderMode !== 'moderator_decides') {
      return false;
    }
    
    // Only if not already determined
    return !progress.active.senders?.determined;
  },

  /**
   * Determine which agents can send messages
   */
  async determineMessageSenders(chatState: ChatState): Promise<ChatState> {
    const { activeRound: round, progress, agents } = chatState;
    const senderMode = (round as any).messageSenderMode || 'all_participants';
    
    
    // Ensure initialized
    if (!progress.active.senders) {
      progress.active.senders = this.initializeMessageSenders();
    }
    
    let allowedSenderIds: string[] = [];
    
    switch (senderMode) {
      case 'moderator_decides':
        // Ask moderator to select agents
        const moderatorDecision = await this.askModeratorToSelectSenders(chatState);
        
        if (moderatorDecision.senderIds.length === 0) {
          console.warn('[MessageSenderService] Moderator selected no senders');
          progress.active.round.isComplete = true;
          progress.active.senders.determined = true;
          return chatState;
        }
        
        allowedSenderIds = moderatorDecision.senderIds;
        
        // Set moderator as active agent to stream their reason
        const moderatorAgent = agents.find(a => a.id === (round as any).messageSenderModerator);
        if (moderatorAgent && moderatorDecision.reason) {
          progress.active.agent.id = moderatorAgent.id;
          progress.active.agent.mode = 'moderator';
          
          const selectedNames = moderatorDecision.senderIds.map(id => {
            const agent = agents.find(a => a.id === id);
            return agent?.name || id;
          }).join(', ');
          
          const verbatimMessage = `I've selected the following agents to participate in this ${round.type} round: ${selectedNames}.\n\n${moderatorDecision.reason}`;
          chatState.moderatorVerbatimMessage = verbatimMessage;
        }
        break;
        
      case 'all_participants':
      default:
        // All participants can send
        allowedSenderIds = round.participants?.map((p: any) => p.id) || [];
        break;
    }
    
    // Store allowed senders
    progress.active.senders.allowed = allowedSenderIds;
    progress.active.senders.determined = true;
    
    
    return chatState;
  },

  async askModeratorToSelectSenders(chatState: ChatState): Promise<{ senderIds: string[]; reason?: string }> {
    const { activeRound: round, agents } = chatState;
    
    const moderatorAgent = agents.find(agent => agent.id === (round as any).messageSenderModerator);
    if (!moderatorAgent) {
      console.warn('[MessageSenderService] Message sender moderator not found');
      // Default to all participants if moderator not found
      const allParticipants = round.participants?.map((p: any) => p.id) || [];
      return { senderIds: allParticipants };
    }

    // Get participants excluding the moderator
    const participants = round.participants || [];
    const filteredParticipants = participants.filter((p: any) => p.id !== moderatorAgent.id);
    
    const participantList = filteredParticipants
      .map((p: any) => {
        const agent = agents.find(a => a.id === p.id);
        return `- ${agent?.name || 'Unknown'} (ID: ${p.id})`;
      })
      .join('\n');

    let prompt = `You need to select which agents should participate by sending messages in this ${round.type} round.

Available participants:
${participantList}

Based on the round objectives and conversation goals, which agents should be allowed to send messages?
You can select all agents, some agents, or even just one agent depending on what would be most effective.
You must select at least one agent.

${(round as any).messageSenderInstructions ? `\nInstructions: ${(round as any).messageSenderInstructions}` : ''}`;

    // Add memories if available for the moderator
    try {
      const memoryContents = await MemoryService.getMemoriesForPrompt(chatState);
      if (memoryContents.length > 0) {
        prompt += `\n\n<MEMORIES>\n`;
        prompt += `The following memories contain important information from previous rounds:\n\n`;
        prompt += memoryContents.join('\n\n');
        prompt += `\n</MEMORIES>`;
      }
    } catch (error) {
      console.error('[MessageSenderService] ❌ Error getting memories for sender moderator:', error);
    }

    prompt += `

Use the selectSenders tool to make your selection. You MUST provide both:
1. The agent IDs (senderIds)
2. A reason explaining your decision (this is required and will be shared with participants)`;

    const selectSendersTool = {
      selectSenders: tool({
        description: 'Select which agents should send messages in this round',
        inputSchema: z.object({
          senderIds: z.array(z.string()).describe('Array of agent IDs who should send messages'),
          reason: z.string().describe('Brief explanation of your selection (required)')
        }),
        execute: async ({ senderIds, reason }) => {
          return { senderIds, reason };
        },
      })
    };

    const result = await LLMService.generateTextForModerator<{
      senderIds: string[];
      reason?: string;
    }>(chatState, moderatorAgent, { 
      userPrompt: prompt,
      tools: selectSendersTool,
      expectJson: true
    });
    
    if (result.success && result.data) {
      return {
        senderIds: result.data.senderIds || [],
        reason: result.data.reason
      };
    }
    
    // Default to all participants if tool call fails
    return { senderIds: filteredParticipants.map((p: any) => p.id) };
  },

  /**
   * Reset message senders for new round
   */
  resetMessageSenders(progress: ChatProgress): void {
    if (progress.active.senders) {
      progress.active.senders.allowed = [];
      progress.active.senders.determined = false;
    } else {
      progress.active.senders = this.initializeMessageSenders();
    }
  },

  /**
   * Clear moderator message after it's been processed
   */
  clearModeratorMessage(chatState: ChatState): void {
    if (chatState.moderatorVerbatimMessage) {
      delete chatState.moderatorVerbatimMessage;
    }
  }
};