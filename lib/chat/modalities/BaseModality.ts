// modalities/BaseModality.ts
import { ChatProgress, ChatState } from "../types";

export interface Modality {
  type: string;
  isRoundComplete(round: any, authorCount: number, chatState?: ChatState): boolean;
  getUserMessagePrefix(progress: ChatProgress): string;
  getSystemPrompt(chatState: ChatState): string;
  getCompletionPrompt(chatState: ChatState): string;
  getAgentIdsForDeterminingNextAgent(chatState: ChatState): string[];
  getAgentIdsForModeratorSelection(chatState: ChatState): string[];
  getAgentIdsForModeratorCompletion(chatState: ChatState): string[];
  getRoundModerators(round: any): string[];
  getAllModeratorIds(chatState: ChatState): string[];
  getAllNonModeratorIds(chatState: ChatState): string[];
}

export class BaseModality implements Modality {
  type: string = 'default';
  
  isRoundComplete(round: any, authorCount: number, chatState?: ChatState): boolean {
    
    // check by total
    if (round.lengthType === 'total' && authorCount >= round.lengthNumber) {
      return true;
    }

    // check by rounds
    if (round.lengthType === 'rounds') {
      // Determine the effective number of participants for this round
      let effectiveParticipantCount = round.participants.length;
      
      // For non-dialogue rounds with moderator-selected senders, use allowed senders count
      if (round.type !== 'dialogue' && round.messageSenderMode === 'moderator_decides' && 
          chatState?.progress.active.senders?.determined) {
        effectiveParticipantCount = chatState.progress.active.senders.allowed.length;
      }
      
      const targetMessageCount = effectiveParticipantCount * round.lengthRounds;
      
      if (authorCount && authorCount >= targetMessageCount) {
        return true;
      }
    }

    return false;
  }
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return '';
  }

  getSystemPrompt(_chatState: ChatState): string {
    return `This is a conversation with multiple participants. Your goal is to engage in a productive discussion.`;
  }

  getCompletionPrompt(_chatState: ChatState): string {
    return "The round should be complete when the participants have adequately explored the topic and achieved the round's objectives.";
  }

  getAgentIdsForDeterminingNextAgent(chatState: ChatState): string[] {
    const { activeRound: round, progress } = chatState;
    
    // Get all participants initially
    let participantIds = round.participants?.map((p: any) => p.id) || [];
    
    // Apply message sender filtering for non-dialogue rounds
    if (round.type !== 'dialogue') {
      const messageSenderMode = (round as any).messageSenderMode;
      
      // If moderator has determined allowed senders, filter to only those
      if (messageSenderMode === 'moderator_decides' && progress.active.senders?.determined) {
        participantIds = participantIds.filter(id => 
          progress.active.senders!.allowed.includes(id)
        );
      }
      // For 'all_participants' mode or if not determined yet, return all participants
    }
    
    return participantIds;
  }

  getAgentIdsForModeratorSelection(chatState: ChatState): string[] {
    // Default: all round participants except the current moderator
    const { activeRound: round } = chatState;
    const participants = round.participants?.map((p: any) => p.id) || [];
    return participants.filter(id => id !== round.moderatorAgentId);
  }

  getAgentIdsForModeratorCompletion(chatState: ChatState): string[] {
    // Default: all round participants
    const { activeRound: round } = chatState;
    return round.participants?.map((p: any) => p.id) || [];
  }

  getRoundModerators(round: any): string[] {
    const moderators: string[] = [];
    
    if (round.moderatorAgentId) {
      moderators.push(round.moderatorAgentId);
    }
    
    if (round.lengthModerator) {
      moderators.push(round.lengthModerator);
    }
    
    // Add message sender moderator for non-dialogue rounds
    if (round.messageSenderModerator && round.type !== 'dialogue') {
      moderators.push(round.messageSenderModerator);
    }
    
    // Add transition moderator for conditional transitions
    if (round.transitionModerator) {
      moderators.push(round.transitionModerator);
    }
    
    return moderators;
  }

  /**
   * Get all moderator IDs for the round
   * This is an alias for getRoundModerators for consistency
   */
  getAllModeratorIds(chatState: ChatState): string[] {
    const { activeRound: round } = chatState;
    return this.getRoundModerators(round);
  }

  /**
   * Get all non-moderator participant IDs for the round
   * Returns participants excluding all moderator roles
   */
  getAllNonModeratorIds(chatState: ChatState): string[] {
    const { activeRound: round } = chatState;
    const moderatorIds = this.getAllModeratorIds(chatState);
    
    // Filter out all moderators from participants
    return round.participants
      ?.map((p: any) => p.id)
      .filter((id: string) => !moderatorIds.includes(id)) || [];
  }
}