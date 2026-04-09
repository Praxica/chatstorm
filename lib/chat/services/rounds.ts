import { prisma } from "../../prisma";
import { ChatAgent } from "@prisma/client";
import type { ChatRound } from "@/lib/schemas/prisma-typed";
import { ChatState, ExtendedChatRound } from "../types";
import { getModality } from '../modalities/ModalityRegistry'

interface ProgressStep {
  agent: {
    id: string,
    mode: string,
  },
}

// Utility functions that operate on ChatRound
export const RoundUtils = {
  // Utility functions can be added as needed

  isRoundComplete(round: ExtendedChatRound, messageCount: number, chatState?: ChatState): boolean {
    const modality = getModality(round.type);
    return modality.isRoundComplete(round, messageCount, chatState);
  },

  /**
   * Determines the next agent to speak based on the round's participation rules
   */
  determineNextAgent(
    chatState: ChatState,
    progressStep: ProgressStep
  ): ChatAgent | null {
    const {activeRound: round, agents} = chatState

    // Special case - if next agent is already specified, use it
    if (progressStep.agent?.id) {
      const found = agents.find(a => a.id === progressStep.agent?.id);
      return found || null;
    }

    // Handle moderator order
    if (round.participantOrder === 'moderator') {
      // If next mode should be moderator, return the moderator agent
      if (progressStep.agent?.mode === 'moderator') {
        const mod = agents.find(a => a.id === round.moderatorAgentId);
        return mod || null;
      }

      // For participants in moderator order, still use modality to get agent pool
      // This allows modalities like dialogue to provide their specific agent selection
      const modality = getModality(round.type);
      const participantIds = modality.getAgentIdsForDeterminingNextAgent(chatState);

      if (participantIds.length === 0) {
        return null;
      }

      // For moderator order, we typically expect an explicit agent ID to be set
      // But if the modality provides a single agent (like dialogue with current sender), use it
      if (participantIds.length === 1) {
        const single = agents.find(a => a.id === participantIds[0]);
        return single || null;
      }

      // Otherwise we need a specified next agent for participants
      return null;
    }

    // Get the agent pool from modality
    const modality = getModality(round.type);
    const participantIds = modality.getAgentIdsForDeterminingNextAgent(chatState);

    if (participantIds.length === 0) {
      console.error('No participants available for round', round.id);
      return null;
    }

    // Handle random order
    if (round.participantOrder === 'random' || round.participantOrder === 'handoff') {
      return this.getRandomNextAgent(chatState, participantIds);
    }

    // Handle sequential order (default)
    return this.getSequentialNextAgent(chatState, participantIds);
  },
  
  /**
   * Gets the next agent using random selection favoring those who've spoken least
   */
  getRandomNextAgent(
    chatState: ChatState,
    participantIds?: string[]
  ): ChatAgent | null {
    const {activeRound: round, agents, progress} = chatState

    // Get participant IDs from modality
    if (!participantIds) {
      const modality = getModality(round.type);
      participantIds = modality.getAgentIdsForDeterminingNextAgent(chatState);
    }

    // Count messages per participant
    const messageCount = new Map<string, number>();
    participantIds.forEach((id: string) => messageCount.set(id, 0));
    
    // Count messages sent by each participant
    progress.messageAuthors.forEach((authorId: string) => {
      messageCount.set(authorId, (messageCount.get(authorId) || 0) + 1);
    });
    
    // Find the minimum number of messages sent by any participant
    const minMessages = Math.min(...Array.from(messageCount.values()));
    
    // Get all participants who have sent the minimum number of messages
    const eligibleParticipantIds = participantIds.filter(
      (id: string) => messageCount.get(id) === minMessages
    );
    
    // Randomly select from eligible participants
    const randomIndex = Math.floor(Math.random() * eligibleParticipantIds.length);
    const selectedId = eligibleParticipantIds[randomIndex];
    
    // Find and return the full agent details
    return agents.find((a) => a.id === selectedId) || null;
  },
  
  /**
   * Gets the next agent in sequential order
   */
  getSequentialNextAgent(
    chatState: ChatState,
    participantIds?: string[]
  ): ChatAgent | null {
    const {activeRound: round, agents, progress} = chatState

    // Get participant IDs from modality
    if (!participantIds) {
      const modality = getModality(round.type);
      participantIds = modality.getAgentIdsForDeterminingNextAgent(chatState);
    }

    if (participantIds.length === 0) {
      return null;
    }

    // Get the index of the next participant based on the number of messages so far
    const participantIndex = progress.messageAuthors.length % participantIds.length;
    const selectedId = participantIds[participantIndex];

    if (!selectedId) {
      return null;
    }

    // Find the full agent details
    return agents.find((a) => a.id === selectedId) || null;
  },
};

// Service for data operations
export const RoundService = {
  /**
   * Retrieve all rounds for a specific configuration
   */
  async getRounds(configId: string) {
    const rounds = await prisma.chatRound.findMany({
      where: { configId },
      orderBy: { sequence: 'asc' },
      include: {
        participants: {
          select: {
            id: true
          },
          orderBy: { id: 'asc' }
        },
        stances: {
          select: {
            agentId: true,
            stance: true
          }
        }
      }
    });

    if (!rounds) {
      throw new Error('No rounds found for this config');
    }
    return rounds as ChatRound[];
  },

  /**
   * Retrieve a single round by ID or the first round for a configuration
   */
  async getRound(configId: string, roundId?: string, _rounds?: any): Promise<ExtendedChatRound | null> {
    let round = null;

    if (roundId) {
      round = await prisma.chatRound.findUnique({
        where: { id: roundId }
      });
    }

    if (!round || !roundId) {
      round = await prisma.chatRound.findFirst({
        where: { configId },
        orderBy: { sequence: 'asc' },
        select: { id: true }
      });

      if (round) {
        roundId = round.id;
      }
    }

    if (!roundId) {
      throw new Error('No round found for this config');
    }

    round = await prisma.chatRound.findUnique({
      where: { id: roundId },
      include: { 
        participants: {
          select: {
            id: true
          },
          orderBy: { id: 'asc' }
        },
        stances: {
          select: {
            agentId: true,
            stance: true
          }
        }
      }
    });

    return round as ExtendedChatRound | null;
  },
}; 