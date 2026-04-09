// modalities/DebateModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";

export class DebateModality extends BaseModality {
  type: string = 'debate';
  
  // Uses default isRoundComplete from BaseModality
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    return 'Continue the debate with your perspective:';
  }

  getDebateContinue(): string {
    return `
First, determine your position by reviewing previous messages you have made as an agent. 
Use that position and DO NOT introduce a new position.
As a debater, you have two jobs: to critize the position of other agents, and to advocate for your own position.
As the debate progresses, you should ensure that you are also addressing the criticisms of your own position by other agents.
Defend your position, but still be open to the possibility that other agents may have a better argument. 
If you feel that is the case, don't hesitate to change your mind and begin supporting that position.
`;
  }

  getDebateTips(agent: any): string {
    return `Previous messages will identify the agent who made it with the prefix: <AGENT>{agentName}</AGENT>.
Never include the <AGENT></AGENT> prefix in your own messages and do not start your own message with it.
Your previous messages will be preceded with <AGENT>${agent.name}</AGENT>`;
  }

  /**
   * Get stance prompt for an agent
   * @param round The round configuration
   * @param agent The current agent
   * @returns The stance prompt for the agent
   */
  getStancePrompt(round: any, agent: any) {

    // custom stance
    if (!round.stanceType || round.stanceType !== 'custom') {
      return `The position you take should be the natural result of your own judgement, background, and expertise.
Your position should be clear an singular. You can't pick a tie or equivocate.
Try to avoid taking a position that has already been taken by another agent.`;
    }

    // defined stance
    const agentStance = round.stances?.find((s: any) => s.agentId === agent.id);
    if (!agentStance) {
      return '';
    }
    return `\n\n<IMPORTANT>In this debate, you must take the following stance: ${agentStance.stance}</IMPORTANT>`;
  }

  getSystemPrompt(chatState: ChatState): string {
    const {activeRound: round, activeAgent: agent, progress} = chatState;

    let instructions = `\n\n<DEBATE>`;

    // Is this the first message from this agent in this round?
    const isFirstMessage = progress.messageAuthors.filter((m: any) => m === agent.id).length === 0;
    
    if (isFirstMessage) {
      instructions += `Your job is to effectively argue for a position that answers the user's question.
Start by clearly articulating your own position and then proceed to defend it.`;
      instructions += `${this.getStancePrompt(round, agent)}`;
    } else {
      instructions += `${this.getDebateContinue()} ${this.getDebateTips(agent)}`;
    }
    
    instructions += `\n</DEBATE>`;

    return instructions;
  }

  getCompletionPrompt(_chatState: ChatState): string {
    return "The debate should be complete when each participant has clearly articulated and defended their position, and the key points of contention have been thoroughly explored. The goal is not necessarily to reach a consensus, but to ensure all viewpoints have been fairly represented and challenged.";
  }
}