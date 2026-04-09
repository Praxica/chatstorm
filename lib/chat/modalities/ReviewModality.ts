import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";
import { AgentUtils } from "../services/agents";
export class ReviewModality extends BaseModality {
  type: string = 'review';
  
  isRoundComplete(_round: any, _authorCount: number): boolean {
    // Review modality is always complete after one response
    return true;
  }
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return 'Share your review:';
  }

  /**
   * Get action prompt for review rounds
   * @param round The round configuration
   * @param rounds All rounds
   * @param agents All available agents
   * @returns Action prompt for the round
   */
  getActionPrompt(chatState: ChatState) {
    const {rounds, activeRound: round, agents} = chatState;

    let prompt = '';
  
    // Get previous agents
    const previousAgents = AgentUtils.getAgentsForPreviousRound(round, rounds, agents);
    
    // Rank previous options
    if (round.action === 'rank') {
      prompt = `<IMPORTANT>Your only job is to rank the previous options in order from best to worst.
Do not add your own ideas, opinions, or options.</IMPORTANT>
First, if no evaluation criteria is provided, formulate a set of evaluation criteria that will best address the user's initial message.
Then apply this criteria to the options presented by each agent:`;
  
      // Find the agent for each participant ID and add their name to the prompt
      for (const agent of previousAgents) {
        prompt += `\n${agent.name}`;
      }
      
      prompt += `\n\nYou can find the arguments for each agent in the previous messages.
Each message from an agent will start with <AGENT></AGENT> tag indicating which agent made the message.
If the user has not provided a clear initial message, then use the following criteria:
- Sound logical structure
- Valid inferential steps
- Absence of fallacies
- Strength of causal relationships
- Proper context consideration

Finally, explain your reasoning for rankings.`;
      return prompt;

    }
    
    // Determine a winner
    if (round.action === 'winner') {
      prompt = `<IMPORTANT>Your job is to evaluate the previous options and declare a winner. 
Your job is NOT to insert your own position, arguments, or opinions.
Do NOT default to the last agent's argument. Consider all arguments carefully.</IMPORTANT>

First, if no evaluation criteria is provided, formulate a set of evaluation criteria that will best address the user's initial message.
Then apply this criteria to the proposal of each agent:`;
  
      // Find the agent for each participant ID and add their name to the prompt
      for (const agent of previousAgents) {
        prompt += `\n<AGENT>${agent.name}</AGENT>`;
      }
  
      prompt += `\n\nYou can find the arguments for each agent in the previous messages.
Each message from an agent will start with <AGENT></AGENT> tag indiciating which agent made the message.
Your decision should be based on the full history of positions and arguments, not just the most recent messages.
If the user has not provided a clear initial message, then use the following criteria:
- Sound logical structure
- Valid inferential steps
- Absence of fallacies
- Strength of causal relationships
- Proper context consideration

Finally, explain your reasoning for the final decision.
Provide specific feedback on strengths and weaknesses.
If you have the space, acknowledge valid points from non-winning arguments.`;
      return prompt;
    }

    // Summarize previous messages
    prompt = `You now have only one job. 
Summarize the previous messages from the following agents:`;

    // Find the agent for each participant ID and add their name to the prompt
    for (const agent of previousAgents) {
      prompt += `\n<AGENT>${agent.name}</AGENT>`;
    }
    prompt +=`\n\nYou can find the arguments for each agent in the previous messages.
Reference these agents by name in your summary.
Remember, JUST provide a summary. Do NOT add any new ideas or introduce any new directions.
`;
    return prompt;
  }
  
  getSystemPrompt(chatState: ChatState): string {
    return `<REVIEW>
${this.getActionPrompt(chatState)}
</REVIEW>`;
  }
}