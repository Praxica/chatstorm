// modalities/BrainstormModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";
import { PromptService } from "@/lib/chat/services/prompts";

export class BrainstormModality extends BaseModality {
  type: string = 'brainstorm';
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return 'Add your ideas to this brainstorming session:';
  }
  
  getSystemPrompt(chatState: ChatState): string {
    const {activeRound: round} = chatState;

    let instructions = `\n\n<BRAINSTORM>
Your job is to brainstorm ${round.outputNumber} ideas based on the user's last message.
As a brainstormer, you should:
- Generate a wide range of ideas
- Evaluate each idea for its potential based on the user's request
- Avoid repeating ideas that other agents have already suggested
For each idea:
1. Provide a clear title/concept
2. Explain the idea in ${PromptService.getPromptDepth(round.depth)}`;
    if (round.depth === 'medium' || round.depth === 'thorough' || round.depth === 'exhaustive') {
      instructions += `3. Note key implications`;
    }
    instructions += `\n</BRAINSTORM>`;

    return instructions;
  }

  getCompletionPrompt(chatState: ChatState): string {
    const { activeRound: round } = chatState;
    return `The brainstorming session should be complete when a sufficient number of diverse and high-quality ideas (aiming for around ${round.outputNumber || 3} per participant) have been generated and briefly discussed. The focus should be on quantity and creativity, not on reaching a final decision.`;
  }
}