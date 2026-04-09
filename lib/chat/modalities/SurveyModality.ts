// modalities/SurveyModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";

export class SurveyModality extends BaseModality {
  type: string = 'survey';
  
  isRoundComplete(round: any, authorCount: number): boolean {
    
    // Survey is complete when all participants have responded
    return authorCount >= round.participants.length;
  }
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return 'Please provide your response to the survey question:';
  }
  
  getSystemPrompt(_chatState: ChatState): string {
    return `
<SURVEY>
Your job is to answer the user's question from your unique perspective.
You should:
- Focus on the user's question only, without introducing any new ideas or topics.
- Ground the answer in your own unique expertise and experience.
- Provide an explanation justifying your answer with as much detail as space allows.
- Ignore any answers or previous messages from other agents.
</SURVEY>`;
  }
}