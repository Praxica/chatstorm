// modalities/CritiqueModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";

export class CritiqueModality extends BaseModality {
  type: string = 'critique';
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return 'Share your critical analysis:';
  }
  
  getSystemPrompt(_chatState: ChatState): string {
    return `
<CRITIQUE>
Your job is to critique the previous ideas or proposals.
DO NOT insert your own position, arguments, or opinions.
Step one is to identify the main proposals from the previous messages and the agents that made them.
Step two is to critique each proposal.

As a critic, you should:
- Identify the strengths and weaknesses of each idea or proposal.
- Consider 2nd order effects of the idea or proposal for a more comprehensive critique.
- Provide specific feedback on how to improve each idea or proposal.
- Avoid repeating the same critique for multiple ideas or proposals.
- Avoid introducing new ideas or topics.
- Avoid repeating ideas that other agents have already suggested.
- Play off the criticisms of other agents to create a more comprehensive critique. Reference their names and ideas as needed.
- Play a devil's advocate role and challenge some of the context and assumptions of the idea.
- Ignore your own previous ideas and proposals. Don't critique your own ideas identified by your <AGENT /> tag.
</CRITIQUE>`
  }

  getCompletionPrompt(_chatState: ChatState): string {
    return "The critique should be complete when the primary ideas or proposals from the previous round have been thoroughly analyzed from multiple angles. The goal is to ensure that the strengths, weaknesses, and potential improvements of each idea have been clearly identified and discussed by the participants.";
  }
}