// modalities/ModalityRegistry.ts
import { Modality, BaseModality } from "./BaseModality";
import { SurveyModality } from "./SurveyModality";
import { DebateModality } from "./DebateModality";
import { BrainstormModality } from "./BrainstormModality";
import { CritiqueModality } from "./CritiqueModality";
import { ExploreModality } from "./ExploreModality";
import { ReviewModality } from "./ReviewModality";
import { CustomModality } from "./CustomModality";
import { UnderstandModality } from "./UnderstandModality";
import { DialogueModality } from "./DialogueModality";
export class ModalityRegistry {
  private static instance: ModalityRegistry;
  private modalities: Map<string, Modality> = new Map();
  private defaultModality: BaseModality = new BaseModality();
  
  private constructor() {
    // Register all modalities
    this.registerModality(new SurveyModality());
    this.registerModality(new DebateModality());
    this.registerModality(new BrainstormModality());
    this.registerModality(new CritiqueModality());
    this.registerModality(new ExploreModality());
    this.registerModality(new ReviewModality());
    this.registerModality(new CustomModality());
    this.registerModality(new UnderstandModality());
    this.registerModality(new DialogueModality());
  }
  
  public static getInstance(): ModalityRegistry {
    if (!ModalityRegistry.instance) {
      ModalityRegistry.instance = new ModalityRegistry();
    }
    return ModalityRegistry.instance;
  }
  
  private registerModality(modality: Modality): void {
    this.modalities.set(modality.type, modality);
  }
  
  public getModality(type: string): Modality {
    return this.modalities.get(type) || this.defaultModality;
  }
}

// This function handles lazy initialization
export function getModality(type: string): Modality {
  // This will initialize the registry if needed
  return ModalityRegistry.getInstance().getModality(type);
}