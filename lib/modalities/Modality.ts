import { RoundType } from '@prisma/client';
import { RoundData, RoundInputType } from '@/types/config-round';
import { ChatAgent } from '@/lib/stores/chatAgentStore';
import { ChatState } from '../chat/types';

/**
 * Abstract base class for all modalities (round types)
 * 
 * This class defines the interface that all specific modality implementations
 * must follow, providing a consistent way to interact with different round types.
 */
abstract class Modality {
  /** Unique identifier matching RoundType enum */
  readonly id: RoundType;
  
  /** Human-readable name of the modality */
  readonly name: string;
  
  /**
   * Creates a new modality instance
   * 
   * @param id - The RoundType identifier for this modality
   * @param name - Human-readable name
   */
  constructor(id: RoundType, name: string) {
    this.id = id;
    this.name = name;
  }
  
  /**
   * Returns the input types required for configuring this modality
   */
  abstract getRequiredInputTypes(): RoundInputType[];
  
  /**
   * Determines whether a round of this modality type is complete
   * 
   * @param authorCount - Number of messages/contributions so far
   * @param round - The round configuration
   */
  abstract isRoundComplete(authorCount: number, round: any): boolean;
  
  /**
   * Gets a prompt describing the completion criteria for this modality
   * This is used to instruct a moderator agent on when to end the round.
   * 
   * @param chatState - The current chat state, providing context.
   * @returns A string describing what constitutes completion for this round type.
   */
  getCompletionPrompt(_chatState: ChatState): string {
    // Default implementation - specific modalities can override
    return "The round should be complete when the participants have adequately explored the topic and achieved the round's objectives.";
  }

  /**
   * Gets a prefix message to add to the first prompt when starting a new round
   * 
   * @returns A string to prepend to the prompt message
   */
  
  getUserMessagePrefix(chatState: ChatState): string {
    // Default implementation returns an empty string
    // Specific modalities can override this method if they need special instructions
    const {activeAgent, progress} = chatState;

    // Ensure progress and its properties exist
    if (!progress?.active?.agent) {
      console.warn('Progress or active agent not properly initialized');
      return 'Continue the conversation by carefully following the instructions in your prompt.';
    }

    if (progress.active.agent.mode === 'moderator') {
      return `Ignore previous patterns and follow your prompt to select the next participant.`;
    }

    // if the active agent has yet to be the author of a message
    if (!progress.messageAuthors.includes(activeAgent.id)) {
      return `Follow the exact instructions in your prompt. These instructions should take precedence over any patterns in the previous messages.`;
    }

    return 'Continue the conversation by carefully following the instructions in your prompt.';
  }
  
  /**
   * Validates round data for this modality
   * 
   * @param roundData - The round data to validate
   * @returns true if valid, false otherwise
   */
  validate(_roundData: RoundData): boolean {
    // Base validation logic common to all modalities
    
    // Validation can be extended with modality-specific rules
    return true;
  }
  
  /**
   * Creates a default round configuration for this modality
   * 
   * @param sequence - The sequence number for this round
   * @param participants - The participants to include
   */
  abstract createDefaultConfig(
    sequence: number, 
    participants: ChatAgent[]
  ): Partial<RoundData>;
}

export default Modality; 