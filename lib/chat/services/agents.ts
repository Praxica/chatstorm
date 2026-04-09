import { prisma } from "../../prisma";
import { agentGenerationService } from "@/lib/services/AgentGenerationService";
import { getModality } from "../modalities/ModalityRegistry";

// Utility functions that operate on ChatAgent
export const AgentUtils = {
  // Utility functions can be added as needed

  /**
   * Get agents for a round
   * @param round The round configuration
   * @param agents All available agents
   * @returns Agents participating in the round
   */
  getAgentsForRound(round: any, agents: any) {
    return round.participants.map((participant: any) => {
      return agents.find((a: any) => a.id === participant.id);
    });
  },

  /**
   * Get agents for the previous round
   * @param round The current round
   * @param rounds All rounds
   * @param agents All available agents
   * @returns Agents from the previous round
   */
  getAgentsForPreviousRound(round: any, rounds: any, agents: any) {
    // Find the index of current round
    const roundIndex = rounds.findIndex((r: any) => r.id === round.id);

    // Get the previous round (or the last round if we're at the first round)
    const previousRound = roundIndex === 0 ? rounds[rounds.length - 1] : rounds[roundIndex - 1];

    return this.getAgentsForRound(previousRound, agents);
  },
};

// Service for data operations
export const AgentService = {
  /**
   * Retrieve all agents that are participants or moderators in the given rounds
   */
  async getAllAgentsInRounds(rounds: any[]) {
    if (!rounds?.length) return [];

    const roundIds = rounds.map(round => round.id);
    
    // Use modality pattern to get all moderators for each round
    const allModeratorIds = rounds.flatMap(round => {
      const modality = getModality(round.type);
      const moderators = modality.getRoundModerators(round);
      return moderators;
    });
    
    // Remove duplicates
    const uniqueModeratorIds = [...new Set(allModeratorIds)];

    // Get agents that are either participants or moderators
    const agents = await prisma.chatAgent.findMany({
      where: {
        OR: [
          // Agents that are participants in any round
          {
            rounds: {
              some: {
                id: {
                  in: roundIds
                }
              }
            }
          },
          // Agents that are moderators in any round
          {
            id: {
              in: uniqueModeratorIds
            }
          }
        ]
      }
    });

    return agents;
  },

  /**
   * Retrieve all dynamic agents for a specific chat session
   */
  async getSessionAgents(sessionId: string) {
    const agents = await prisma.chatAgent.findMany({
      where: {
        chatRoundSessionId: sessionId,
        isDynamic: true
      }
    });

    return agents;
  },

  /**
   * Get or create session agents for dynamic generation rounds
   * This handles the generation logic and keeps ChatEngine clean
   * @returns Object with agents array and wasNewlyCreated boolean
   */
  async getOrCreateSessionAgents(sessionId: string, activeRound: any, userId: string, chatState?: any): Promise<{ agents: any[], wasNewlyCreated: boolean }> {
    // First try to get existing agents
    const existingAgents = await this.getSessionAgents(sessionId);
    if (existingAgents.length > 0) {
      return { agents: existingAgents, wasNewlyCreated: false };
    }

    // If none exist and this is a GENERATE round, create them
    if (activeRound.participantMode === 'GENERATE' && activeRound.participantGenerationPrompt) {
      
      // Generate message history for context-aware agent generation (only when needed)
      let messageHistory = undefined;
      if (chatState?.messages && chatState.messages.length > 1) { // More than just the user prompt
        // Simple filtering for agent generation context - no agent isolation needed
        const allMessagesExceptCurrent = chatState.messages;

        console.log('[agents] Processing messages for agent generation:', {
          messageCount: allMessagesExceptCurrent.length,
          firstMessage: allMessagesExceptCurrent[0],
        });

        allMessagesExceptCurrent.forEach((msg: any) => {
          const _firstLine = (msg.content || '').split('\n')[0].substring(0, 120);
          const _agentId = msg?.metadata?.agentId;
          const _agentName = _agentId ? chatState.agents?.find((a: any) => a.id === _agentId)?.name || 'Unknown' : 'N/A';
        });

        messageHistory = allMessagesExceptCurrent
          .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg: any) => {
            // Extract text content from parts (UIMessage format from AI SDK)
            const content = String(msg.parts?.find((p: any) => p?.type === 'text')?.text ?? '');

            // For assistant messages, add agent name if available and strip self-reflection
            let processedContent = content;
            if (msg.role === 'assistant' && content) {
              const messageAgent = chatState.agents?.find((a: any) => a.id === msg?.metadata?.agentId);
              // Strip out self reflection tags
              processedContent = content.replace(/<SELF>[\s\S]*?<\/SELF>/g, '');
              // Add agent name prefix if not already present
              const hasAgentTag = /<AGENT>.*?<\/AGENT>/.test(processedContent);
              if (messageAgent && !hasAgentTag) {
                processedContent = `<AGENT>${messageAgent.name}<\/AGENT>${processedContent}`;
              }
            }

            return {
              role: msg.role,
              content: processedContent.trim()
            };
          })
          .filter((msg: any) => {
            if (msg.content.length === 0) {
              return false;
            }
            return true;
          });
        
      }
      
      try {
        // Generate and wait for completion in one call
        const agents = await agentGenerationService.generateSessionAgentsAndWait({
          chatRoundSessionId: sessionId,
          userId: userId,
          participantGenerationPrompt: activeRound.participantGenerationPrompt,
          participantLength: activeRound.participantLength || 3,
          participantLengthType: activeRound.participantLengthType || 'FIXED',
          creativity: activeRound.creativityNumber,
          depth: activeRound.depth,
          messageHistory: messageHistory
        });
        
        return { agents, wasNewlyCreated: true };
        
      } catch (error) {
        console.error('Error starting dynamic agent generation:', error);
        throw new Error(`Failed to generate dynamic agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { agents: [], wasNewlyCreated: false };
  }
}; 