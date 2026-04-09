// modalities/CustomModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";

export class CustomModality extends BaseModality {
  type: string = 'custom';
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return 'Follow your prompt instructions.';
  }

  // Custom rounds only get optional instructions
  getSystemPrompt(_chatState: ChatState): string {
    return '';
  }
}