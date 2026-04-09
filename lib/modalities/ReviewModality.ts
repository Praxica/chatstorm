import { DepthLevel, LengthType } from '@prisma/client';
import { ChatAgent } from '@/lib/stores/chatAgentStore';
import { RoundData, RoundInputType } from '@/types/config-round';
import Modality from './Modality';

/**
 * Review modality implementation
 * 
 * The Review modality is used for reviewing content or providing feedback.
 * It typically involves a single participant reviewing something.
 */
class ReviewModality extends Modality {
  /**
   * Creates a new ReviewModality instance
   */
  constructor() {
    super('review', 'Review');
  }
  
  /**
   * Gets the input types required for the Review modality
   */
  getRequiredInputTypes(): RoundInputType[] {
    return ['participant', 'depth'];
  }
  
  /**
   * A review round is always considered complete after submission
   */
  isRoundComplete(_authorCount: number, _round: any): boolean {
    // Review rounds are considered complete after one submission
    return true;
  }
  
  /**
   * Gets the message prefix for the first prompt in a new review round
   */
  getUserMessagePrefix(progress: any): string {
    if (progress.messageCount === 0) {
      return `
      <IMPORTANT>
      This is now a review round. Follow the exact instructions in your prompt to review the previous messages. Ignore any previous patterns or prompts.
      </IMPORTANT>
      `;
    }
    return '';
  }
  
  /**
   * Creates a default configuration for a Review round
   */
  createDefaultConfig(
    sequence: number, 
    participants: ChatAgent[]
  ): Partial<RoundData> {
    // For review, we typically just select the first participant
    const participant = participants.length > 0 ? [participants[0].id] : [];
    
    return {
      type: 'review',
      depth: 'detailed' as DepthLevel,
      lengthType: 'total' as LengthType,
      sequence,
      participants: participant,
    };
  }
}

export default ReviewModality; 