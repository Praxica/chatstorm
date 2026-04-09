import { RoundType, DepthLevel, LengthType } from '@prisma/client';
import Modality from './Modality';
import ReviewModality from './ReviewModality';
import { ChatAgent } from '@/lib/stores/chatAgentStore';
import { RoundData, RoundInputType } from '@/types/config-round';

// Create a default modality that provides neutral behavior
class DefaultModality extends Modality {
  constructor() {
    super('debate' as RoundType, 'Default');
  }
  
  getRequiredInputTypes(): RoundInputType[] {
    return [];
  }
  
  isRoundComplete(_authorCount: number, _round: any): boolean {
    // Default completion logic
    return false;
  }
  
  createDefaultConfig(
    sequence: number, 
    participants: ChatAgent[]
  ): Partial<RoundData> {
    return {
      type: 'debate',
      depth: 'medium' as DepthLevel,
      lengthType: 'rounds' as LengthType,
      sequence,
      participants: participants.map(p => p.id),
    };
  }
}

/**
 * Registry for managing and accessing modality instances
 * 
 * This class provides a centralized place to register and retrieve modalities,
 * which will make it easy to add custom modalities in the future.
 */
class ModalityRegistry {
  private static modalities: Map<RoundType, Modality> = new Map();
  private static defaultModality = new DefaultModality();
  
  /**
   * Registers a modality in the registry
   * 
   * @param modality - The modality instance to register
   */
  static registerModality(modality: Modality): void {
    this.modalities.set(modality.id, modality);
  }
  
  /**
   * Gets a modality by its type
   * 
   * @param type - The round type
   * @returns The corresponding modality instance or the default modality if not found
   */
  static getModality(type: RoundType): Modality {
    const modality = this.modalities.get(type);
    if (!modality) {
      console.warn(`Modality type ${type} not registered. Using default modality.`);
      return this.defaultModality;
    }
    return modality;
  }
  
  /**
   * Gets all registered modalities
   * 
   * @returns Array of all registered modality instances
   */
  static getAllModalities(): Modality[] {
    return Array.from(this.modalities.values());
  }
  
  /**
   * Initializes the registry with built-in modalities
   * 
   * This method should be called during application startup
   * to register all the built-in modality types.
   */
  static initialize(): void {
    // Register built-in modalities
    this.registerModality(new ReviewModality());
    
    // Other modalities will be added here as they are implemented
    // this.registerModality(new DebateModality());
    // this.registerModality(new BrainstormModality());
    // etc.
  }
}

export default ModalityRegistry; 