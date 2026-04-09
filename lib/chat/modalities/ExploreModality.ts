// modalities/ExploreModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";

export class ExploreModality extends BaseModality {
  type: string = 'explore';
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return 'Add your thoughts to this exploration:';
  }
  
  getSystemPrompt(_chatState: ChatState): string {
    return `<EXPLORE>
Your job is to explore the user's question in maximum depth.
As an explorer, you should:
- Generate a wide range of ideas.
- Explore unique aspects of the user's question.
- Open up avenues of exploration that are not obvious.
- Use your expertise to identify unique aspects, connections, and perspectives on the user's question.
- Consider 2nd order effects of the idea or proposal for a more comprehensive exploration.
- Play off the ideas of other agents to create a more comprehensive exploration. Reference their names and ideas as needed.
- Avoid repeating ideas that other agents have already suggested
</EXPLORE>`
  }

  getCompletionPrompt(_chatState: ChatState): string {
    return "The exploration round should be complete when the user's initial question has been examined from several different and interesting perspectives. The goal is to have a rich tapestry of ideas, insights, and connections that provide a comprehensive and multi-faceted understanding of the topic.";
  }
}