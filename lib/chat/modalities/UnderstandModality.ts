// modalities/SurveyModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";

export class UnderstandModality extends BaseModality {
  type: string = 'understand';
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return `Please use your prompt instructions to understand the user's request:`;
  }
  
  getSystemPrompt(_chatState: ChatState): string {
    return `
<UNDERSTAND>
Your job is to refine the user's request so you can better understand it.
Some of the ways you can do this are:
- Focus on the user's request only, without introducing any new ideas or topics.
- Ask questions to help clarify the user's request. 
- Restate the user's request in your own words with more clarity or depth and ask the user if this is correct.
- Provide an explanation justifying your request with as much detail as space allows.
</UNDERSTAND>`;
  }
}