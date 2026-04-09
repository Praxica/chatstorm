// modalities/DialogueModality.ts
import { BaseModality } from "./BaseModality";
import { ChatProgress, ChatState } from "../types";

export class DialogueModality extends BaseModality {
  type: string = 'dialogue';
  
  getUserMessagePrefix(_progress: ChatProgress): string {
    // For dialogue rounds, we might want to indicate if this is a dialogue message
    return '';
  }

  getSystemPrompt(chatState: ChatState): string {
    const { activeRound: round, progress, agents } = chatState;
      
    // Get dialogue partner info
    const currentAgentId = chatState.activeAgent?.id;
    const isCurrentSender = currentAgentId === progress.dialogue?.sender;
    const partnerId = isCurrentSender ? progress.dialogue?.receiver : progress.dialogue?.sender;
    const partnerAgent = agents.find(a => a.id === partnerId);

    
    let prompt = `<DIALOGUE>
    You are in focused dialogue with ${partnerAgent?.name || 'one other agent'}.\n\nIMPORTANT: Always provide meaningful dialogue text in your response. Never send only tool calls without accompanying dialogue content.`;
    
    // Add generated dialogue instructions if available
    if (progress.dialogue?.systemPrompt) {
      prompt += `\n\n${progress.dialogue.systemPrompt}`;
    }
    
    // Add agent dialogue completion prompt if applicable
    const dialogueLengthMode = (round as any).dialogueLengthMode;
    
    if ((dialogueLengthMode === 'agent_decides' || dialogueLengthMode === 'moderator_decides') && 
        progress.dialogue?.sender && 
        progress.dialogue?.receiver &&
        progress.dialogue.mode === 'dialogue') {
      
      // Count messages in current dialogue
      const sender = progress.dialogue.senders[progress.dialogue.sender];
      const receiver = sender?.receivers[progress.dialogue.receiver];
      const messageCount = receiver?.messages || 0;
      
      // Get max message limit from configuration
      const maxMessages = (round as any).dialogueLength || 10;
      
      if (dialogueLengthMode === 'agent_decides') {
        const dialogueCompletionPrompt = `\n\nDIALOGUE COMPLETION CONTROL:
If you want to end this dialogue, add this exact marker at the end of your message:
[END_DIALOGUE]

You can include your reason for ending in your regular message text if desired.
If you don't add [END_DIALOGUE], the dialogue will continue.
The dialogue will automatically end at ${maxMessages} messages as a safety limit.
Messages exchanged so far: ${messageCount}/${maxMessages}

${(round as any).dialogueLengthInstructions ? `\nUse these instructions to help determine when to end the dialogue: ${(round as any).dialogueLengthInstructions}` : ''}`;

        prompt += dialogueCompletionPrompt;
      } else if (dialogueLengthMode === 'moderator_decides') {
        const dialogueCompletionPrompt = `\n\nDIALOGUE COMPLETION CONTROL:
The moderator will decide when this dialogue should end.
The dialogue will automatically end at ${maxMessages} messages as a safety limit.
Messages exchanged so far: ${messageCount}/${maxMessages}

${(round as any).dialogueLengthInstructions ? `\nThe moderator will use these criteria to determine when to end the dialogue: ${(round as any).dialogueLengthInstructions}` : ''}`;

        prompt += dialogueCompletionPrompt;
      }
    }

    prompt += '\n\n</DIALOGUE>'
    
    return prompt;
  }

  getCompletionPrompt(chatState: ChatState): string {
    const { activeRound: round, progress, agents } = chatState;
    
    // Get dialogue partner info
    const currentSender = progress.dialogue?.sender;
    const currentReceiver = progress.dialogue?.receiver;
    const senderAgent = agents.find(a => a.id === currentSender);
    const receiverAgent = agents.find(a => a.id === currentReceiver);
    
    // Count messages in current dialogue
    const sender = progress.dialogue?.senders[currentSender || ''];
    const receiver = sender?.receivers[currentReceiver || ''];
    const messageCount = receiver?.messages || 0;
    
    // Get max message limit from configuration
    const maxMessages = (round as any).dialogueLength || 10;
    
    const prompt = `You are evaluating the dialogue between ${senderAgent?.name || 'Agent 1'} and ${receiverAgent?.name || 'Agent 2'}.
Messages exchanged so far: ${messageCount}/${maxMessages}

DIALOGUE COMPLETION DECISION:
Should this dialogue continue or end?

The dialogue should CONTINUE if:
- Participants are still actively engaged
- The conversation topic needs further exploration
- Important points are still being developed

The dialogue should END if:
- The topic has been thoroughly discussed
- Natural conclusion has been reached
- Participants have covered the key points
- Points are getting repetitive, boring, or obvious

${(round as any).dialogueLengthInstructions ? `\nUse these specific criteria: ${(round as any).dialogueLengthInstructions}` : ''}`;

    return prompt;
  }

  getAgentIdsForDeterminingNextAgent(chatState: ChatState): string[] {
    const { progress } = chatState;
    
    // If no dialogue progress, return empty to use base modality behavior
    if (!progress.dialogue || Object.keys(progress.dialogue.senders).length === 0) {
      return super.getAgentIdsForDeterminingNextAgent(chatState);
    }

    // If we need to determine the next sender
    if (progress.dialogue.mode === 'pending' && !progress.dialogue.sender) {
      // Find the first pending sender and set as current sender
      const pendingSender = Object.entries(progress.dialogue.senders)
        .find(([_, sender]) => sender.mode === 'pending');
      
      if (pendingSender) {
        const [senderId] = pendingSender;
        progress.dialogue.sender = senderId;
        progress.dialogue.mode = 'dialogue';
        return [senderId];
      }
    }

    // If we have a current sender, return them
    if (progress.dialogue.sender) {
      return [progress.dialogue.sender];
    }

    // Return sender IDs that haven't completed yet
    const pendingSenders: string[] = [];
    Object.entries(progress.dialogue.senders).forEach(([senderId, sender]) => {
      if (sender.mode === 'pending' || sender.mode === 'dialogue') {
        pendingSenders.push(senderId);
      }
    });
    
    return pendingSenders;
  }

  getAgentIdsForModeratorSelection(chatState: ChatState): string[] {
    const { progress } = chatState;
    
    // For dialogue rounds, moderator should choose from current dialogue participants
    if (progress.dialogue?.sender && progress.dialogue?.receiver) {
      // If in active dialogue, return the current sender and receiver
      return [progress.dialogue.sender, progress.dialogue.receiver];
    }
    
    if (progress.dialogue?.sender) {
      // If we have a sender but no receiver, return all possible receivers
      const sender = progress.dialogue.senders[progress.dialogue.sender];
      if (sender?.receivers && Object.keys(sender.receivers).length > 0) {
        return Object.keys(sender.receivers);
      }
      
      // Otherwise return all participants except the sender for receiver selection
      return super.getAgentIdsForModeratorSelection(chatState)
        .filter(id => id !== progress.dialogue?.sender);
    }
    
    // If no active dialogue, return pending senders
    if (progress.dialogue && Object.keys(progress.dialogue.senders).length > 0) {
      return Object.entries(progress.dialogue.senders)
        .filter(([_, sender]) => sender.mode === 'pending' || sender.mode === 'dialogue')
        .map(([senderId]) => senderId);
    }
    
    // Fallback to default behavior
    return super.getAgentIdsForModeratorSelection(chatState);
  }

  getAgentIdsForModeratorCompletion(chatState: ChatState): string[] {
    const { progress } = chatState;
    
    // For dialogue completion checks, show current dialogue participants
    if (progress.dialogue?.sender && progress.dialogue?.receiver) {
      return [progress.dialogue.sender, progress.dialogue.receiver];
    }
    
    // If we have senders, show all active dialogue participants
    if (progress.dialogue && Object.keys(progress.dialogue.senders).length > 0) {
      const activeParticipants: string[] = [];
      
      Object.entries(progress.dialogue.senders).forEach(([senderId, sender]) => {
        if (sender.mode === 'dialogue') {
          activeParticipants.push(senderId);
          // Add receivers who are actively in dialogue
          Object.entries(sender.receivers).forEach(([receiverId, receiver]) => {
            if (receiver.mode === 'dialogue' && !activeParticipants.includes(receiverId)) {
              activeParticipants.push(receiverId);
            }
          });
        }
      });
      
      return activeParticipants;
    }
    
    // Fallback to default behavior
    return super.getAgentIdsForModeratorCompletion(chatState);
  }

  getRoundModerators(round: any): string[] {
    const moderators = super.getRoundModerators(round); // Get base moderators
    
    // Add dialogue-specific moderators
    if (round.dialogueLengthModerator) {
      moderators.push(round.dialogueLengthModerator);
    }
    
    if (round.dialogueSenderModerator) {
      moderators.push(round.dialogueSenderModerator);
    }
    
    if (round.dialogueReceiverModerator) {
      moderators.push(round.dialogueReceiverModerator);
    }
    
    return moderators;
  }
}