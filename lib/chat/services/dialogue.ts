import { ChatState, ChatProgress } from '../types';
import { LLMService } from './LLM';
import { MemoryService } from './memory';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * DialogueService - Handles all dialogue-specific logic for dialogue rounds
 */

// Type definitions for dialogue progress tracking
export interface DialogueProgress {
  senders: {
    [senderId: string]: {
      mode: 'skip' | 'dialogue' | 'complete' | 'pending';
      receiverSelectionMade?: boolean;
      receivers: {
        [receiverId: string]: {
          mode: 'dialogue' | 'complete' | 'pending';
          messages: number;
        };
      };
    };
  };
  mode: 'pending' | 'dialogue' | 'complete';
  sender?: string;
  receiver?: string;
}

// Helper to check agent mode — prevents TS from narrowing after mutations through function calls
function isModeratorMode(progress: ChatProgress): boolean {
  return progress.active.agent.mode === 'moderator';
}

export const DialogueService = {
  // === Utility Functions ===
  initializeDialogueProgress(): NonNullable<ChatProgress['dialogue']> {
    return {
      senders: {},
      mode: 'pending'
    };
  },

  // Set dialogue progress - handles the rest of initialization and agent alternation
  async setDialogueProgress(chatState: ChatState): Promise<ChatState> {
    const { progress } = chatState;


    if (progress.active.agent.mode === 'moderator') {
      // Agent is moderator - will stream verbatim message
      return chatState;
    }

    // Initialize dialogue progress if not exists
    if (!progress.dialogue) {
      progress.dialogue = this.initializeDialogueProgress();
    }

    // 1. Start round: determine sending agents
    if (this.shouldDetermineSendingAgents(progress)) {
      chatState = await this.determineSendingAgents(chatState);
      if (isModeratorMode(progress)) {
        return chatState;
      }
    }

    // 3. Sender round: determine if sender is dialoguing
    if (this.shouldCheckSenderDecision(progress)) {
      chatState = await this.checkSenderDecision(chatState);
      // Only return early if active agent is set to moderator mode (needs to stream)
      if (isModeratorMode(progress)) {
        return chatState;
      }
    }

    // 4. Sender round: determine receivers
    if (this.shouldDetermineReceivers(progress)) {
      chatState = await this.determineReceivers(chatState);
      // Only return early if active agent is set to moderator mode (needs to stream)
      if (isModeratorMode(progress)) {
        return chatState;
      }
    }

    // 5. Pre dialogue round: check moderator completion
    if (this.shouldCheckModeratorDialogueCompletion(chatState)) {
      chatState = await this.checkModeratorDialogueCompletion(chatState);
      // Only return early if active agent is set to moderator mode (needs to stream)
      if (isModeratorMode(progress)) {
        return chatState;
      }
    }

    // 6. Set active agent based on dialogue state (only if not already in moderator mode)
    if (progress.dialogue?.sender && progress.dialogue?.receiver) {
      const sender = progress.dialogue.senders[progress.dialogue.sender];
      const receiver = sender?.receivers[progress.dialogue.receiver];


      if (receiver?.mode === 'pending') {
        // First message in dialogue - sender goes first
        progress.active.agent.id = progress.dialogue.sender;
        // Now mark receiver as in dialogue mode
        receiver.mode = 'dialogue';
      } else if (receiver?.mode === 'dialogue') {
        // Dialogue in progress - alternate based on message count
        const messageCount = receiver.messages;
        const isEvenMessage = messageCount % 2 === 0;


        if (isEvenMessage) {
          // Even messages (0, 2, 4...): sender's turn
          progress.active.agent.id = progress.dialogue.sender;
        } else {
          // Odd messages (1, 3, 5...): receiver's turn
          progress.active.agent.id = progress.dialogue.receiver;
        }
      }
    } else if (isModeratorMode(progress)) {
    }

    // 7. Generate dialogue instructions if needed (after agent selection is complete)
    if (progress.dialogue?.sender && progress.dialogue?.receiver && progress.dialogue?.mode === 'dialogue') {
      chatState = await this.generateDialogueInstructions(chatState);
    }

    // Safety check: If dialogue is not properly initialized, mark round as complete
    if (!progress.dialogue || (!progress.dialogue.sender && !progress.dialogue.receiver && progress.dialogue.mode !== 'complete')) {
      progress.active.round.isComplete = true;
      progress.dialogue = progress.dialogue || this.initializeDialogueProgress();
      progress.dialogue.mode = 'complete';
    }
    
    return chatState;
  },

  // === Condition Check Functions ===
  shouldDetermineSendingAgents(progress: ChatProgress): boolean {
    // Don't determine senders if dialogue is already complete
    if (progress.dialogue?.mode === 'complete') {
      return false;
    }
    return Object.keys(progress.dialogue?.senders || {}).length === 0;
  },


  shouldCheckSenderDecision(progress: ChatProgress): boolean {
    if (!progress.dialogue?.sender) return false;
    const sender = progress.dialogue.senders[progress.dialogue.sender];
    return sender?.mode === 'pending';
  },

  shouldDetermineReceivers(progress: ChatProgress): boolean {
    if (!progress.dialogue?.sender) return false;
    const sender = progress.dialogue.senders[progress.dialogue.sender];
    return sender?.mode === 'dialogue' && (!sender.receivers || Object.keys(sender.receivers).length === 0);
  },

  shouldCheckModeratorDialogueCompletion(chatState: ChatState): boolean {
    const { activeRound: round, progress } = chatState;
    const dialogueLengthMode = (round as any).dialogueLengthMode;
    
    
    return dialogueLengthMode === 'moderator_decides' && progress.dialogue?.mode === 'dialogue';
  },


  // === Action Functions ===
  async determineSendingAgents(chatState: ChatState): Promise<ChatState> {
    const { activeRound: round, progress, agents } = chatState;
    const senderMode = (round as any).dialogueSenderMode || 'all_participants'; // Default to all_participants if null
    
    // Ensure dialogue is initialized
    if (!progress.dialogue) {
      progress.dialogue = this.initializeDialogueProgress();
    }

    let senderIds: string[] = [];

    switch (senderMode) {
      case 'moderator_decides':
        // Moderator needs to choose sending agents
        const moderatorDecision = await this.askModeratorToSelectSenders(chatState);
        const senderModerator = agents.find(a => a.id === (round as any).dialogueSenderModerator);
        
        if (moderatorDecision.senderIds.length === 0) {
          console.warn('[DialogueService] Moderator selected no senders - marking round complete');
          
          // Set moderator as active agent to stream their reason for no senders
          if (senderModerator && moderatorDecision.reason) {
            progress.active.agent.id = senderModerator.id;
            progress.active.agent.mode = 'moderator';
            chatState.moderatorVerbatimMessage = `I've decided not to select any agents to initiate dialogues.\n\n${moderatorDecision.reason}`;
          }
          
          // Mark dialogue as complete and round as complete
          progress.dialogue!.mode = 'complete';
          progress.active.round.isComplete = true;
          return chatState;
        }
        
        senderIds = moderatorDecision.senderIds;
        
        // Set moderator as active agent to stream their reason for selected senders
        if (senderModerator && moderatorDecision.reason) {
          progress.active.agent.id = senderModerator.id;
          progress.active.agent.mode = 'moderator';
          const verbatimMessage = `I've selected the following agents to initiate dialogues: ${moderatorDecision.senderIds.map(id => {
            const agent = agents.find(a => a.id === id);
            return agent?.name || id;
          }).join(', ')}.\n\n${moderatorDecision.reason}`;
          chatState.moderatorVerbatimMessage = verbatimMessage;
        }
        break;
        
      case 'all_participants':
        // All participants are senders
        senderIds = round.participants?.map((p: any) => p.id) || [];
        break;
        
      case 'select':
        // Use pre-selected senders
        senderIds = (round as any).dialogueSelectedSenders || [];
        break;
        
      case 'agent_decides':
        // Each participant will decide individually
        senderIds = round.participants?.map((p: any) => p.id) || [];
        break;
        
      default:
        console.warn(`[DialogueService] Unknown sender mode: ${senderMode}`);
    }
    
    // Populate senders in dialogue progress
    senderIds.forEach(senderId => {
      progress.dialogue!.senders[senderId] = {
        mode: 'pending',
        receivers: {}
      };
    });
    
    // If we have senders but no current sender, set the first one
    if (senderIds.length > 0 && !progress.dialogue!.sender) {
      progress.dialogue!.sender = senderIds[0];
      progress.dialogue!.mode = 'dialogue';
    }
    
    return chatState;
  },

  async askModeratorToSelectSenders(chatState: ChatState): Promise<{ senderIds: string[]; reason?: string }> {
    const { activeRound: round, agents } = chatState;
    
    // Find the sender moderator agent
    const moderatorAgent = agents.find(agent => agent.id === (round as any).dialogueSenderModerator);
    if (!moderatorAgent) {
      console.warn('[DialogueService] Sender moderator agent not found');
      return { senderIds: [] };
    }

    // Build prompt for moderator to select senders (exclude the moderator)
    const participants = round.participants || [];
    
    const filteredParticipants = participants.filter((p: any) => p.id !== moderatorAgent.id);
    
    const participantList = filteredParticipants
      .map((p: any) => {
        const agent = agents.find(a => a.id === p.id);
        return `- ${agent?.name || 'Unknown'} (ID: ${p.id})`;
      })
      .join('\n');

    let prompt = `You need to select which agents should initiate dialogues in this round.

Available participants:
${participantList}

Based on the conversation so far and the dialogue goals, which agents should initiate dialogues with other agents?
You may select zero or more agents. If you select no agents, the dialogue round will end.

${(round as any).dialogueSenderInstructions ? `\nInstructions: ${(round as any).dialogueSenderInstructions}` : ''}

Use the selectSenders tool to make your selection. You MUST provide both:
1. The agent IDs (senderIds) - can be empty array if no agents should send
2. A reason explaining your decision (this is required and will be shared with participants)`;

    // Add memories if available for the moderator
    try {
      const memoryContents = await MemoryService.getMemoriesForPrompt(chatState);
      if (memoryContents.length > 0) {
        prompt += `\n\n<MEMORIES>\n`;
        prompt += `The following memories contain important information from previous rounds:\n\n`;
        prompt += memoryContents.join('\n\n');
        prompt += `\n</MEMORIES>`;
      }
    } catch (error) {
      console.error('[DialogueService] ❌ Error getting memories for sender moderator:', error);
    }

    // Create tool for sender selection
    const selectSendersTool = {
      selectSenders: tool({
        description: 'Select which agents should initiate dialogues in this round',
        inputSchema: z.object({
          senderIds: z.array(z.string()).describe('Array of agent IDs who should initiate dialogues'),
          reason: z.string().describe('Brief explanation of your selection (required)')
        }),
        execute: async ({ senderIds, reason }) => {
          return { senderIds, reason };
        },
      })
    };

    const result = await LLMService.generateTextForModerator<{
      senderIds: string[];
      reason?: string;
    }>(chatState, moderatorAgent, { 
      userPrompt: prompt,
      tools: selectSendersTool,
      expectJson: true // Fallback if tool isn't used
    });
    
    if (result.success && result.data) {
        return {
        senderIds: result.data.senderIds || [],
        reason: result.data.reason
      };
    }
    
    // Fallback: select all participants if moderator decision fails
    const fallbackSenders = filteredParticipants.map((p: any) => p.id);
    return { 
      senderIds: fallbackSenders,
      reason: 'Moderator decision failed, automatically selected all participants'
    };
  },

  async askModeratorToSelectReceivers(chatState: ChatState): Promise<{ receiverIds: string[]; reason?: string }> {
    const { activeRound: round, agents, progress } = chatState;
    
    // Find the receiver moderator agent
    const moderatorAgent = agents.find(agent => agent.id === (round as any).dialogueReceiverModerator);
    if (!moderatorAgent) {
      console.warn('[DialogueService] Receiver moderator agent not found');
      return { receiverIds: [] };
    }
    
    // Get potential receivers (all participants except sender and moderator)
    const potentialReceivers = round.participants || [];
    const receiverList = potentialReceivers
      .filter((p: any) => p.id !== progress.dialogue?.sender && p.id !== moderatorAgent.id)
      .map((p: any) => {
        const agent = agents.find(a => a.id === p.id);
        return `- ${agent?.name || 'Unknown'} (ID: ${p.id})`;
      })
      .join('\n');

    const senderAgent = agents.find(a => a.id === progress.dialogue?.sender);
    let prompt = `You need to select which agents should receive dialogue messages from ${senderAgent?.name || 'the sender'}.

Available receivers:
${receiverList}

Based on the conversation so far and the dialogue goals, which agents should ${senderAgent?.name || 'the sender'} dialogue with?
You must select at least one agent.

${(round as any).dialogueReceiverInstructions ? `\nInstructions: ${(round as any).dialogueReceiverInstructions}` : ''}

Use the selectReceivers tool to make your selection. You MUST provide both:
1. The agent IDs (receiverIds)
2. A reason explaining your decision (this is required and will be shared with participants)`;

    // Add memories if available for the moderator
    try {
      const memoryContents = await MemoryService.getMemoriesForPrompt(chatState);
      if (memoryContents.length > 0) {
        prompt += `\n\n<MEMORIES>\n`;
        prompt += `The following memories contain important information from previous rounds:\n\n`;
        prompt += memoryContents.join('\n\n');
        prompt += `\n</MEMORIES>`;
      }
    } catch (error) {
      console.error('[DialogueService] ❌ Error getting memories for receiver moderator:', error);
    }

    // Create tool for receiver selection
    const selectReceiversTool = {
      selectReceivers: tool({
        description: `Select which agents should receive dialogue messages from ${senderAgent?.name || 'the sender'}`,
        inputSchema: z.object({
          receiverIds: z.array(z.string()).describe('Array of agent IDs who should receive dialogue messages'),
          reason: z.string().describe('Brief explanation of your selection (required)')
        }),
        execute: async ({ receiverIds, reason }) => {
          return { receiverIds, reason };
        },
      })
    };

    const result = await LLMService.generateTextForModerator<{
      receiverIds: string[];
      reason?: string;
    }>(chatState, moderatorAgent, { 
      userPrompt: prompt,
      tools: selectReceiversTool,
      expectJson: true // Fallback if tool isn't used
    });
    
    if (result.success && result.data) {
      return {
        receiverIds: result.data.receiverIds || [],
        reason: result.data.reason
      };
    }
    
    return { receiverIds: [] };
  },

  async askSenderToSelectReceivers(chatState: ChatState): Promise<{ receiverIds: string[]; reason?: string }> {
    const { activeRound: round, agents, progress } = chatState;
    
    // Find the sender agent
    const senderAgent = agents.find(agent => agent.id === progress.dialogue?.sender);
    if (!senderAgent) {
      console.warn('[DialogueService] Sender agent not found');
      return { receiverIds: [] };
    }
    
    // Get potential receivers (all participants except sender)
    const potentialReceivers = round.participants || [];
    const receiverList = potentialReceivers
      .filter((p: any) => p.id !== progress.dialogue?.sender)
      .map((p: any) => {
        const agent = agents.find(a => a.id === p.id);
        return `- ${agent?.name || 'Unknown'} (ID: ${p.id})`;
      })
      .join('\n');

    const prompt = `You need to select which agents you want to dialogue with.

Available agents:
${receiverList}

Based on the conversation so far and your goals, which agents do you want to dialogue with?
You must select at least one agent.

${(round as any).dialogueReceiverInstructions ? `\nInstructions: ${(round as any).dialogueReceiverInstructions}` : ''}

Respond with a JSON object in this exact format:
{
  "receiverIds": ["agent_id_1", "agent_id_2"],
  "reason": "Brief explanation of your selection"
}`;

    const result = await LLMService.generateTextForModerator<{
      receiverIds: string[];
      reason?: string;
    }>(chatState, senderAgent, { expectJson: true, userPrompt: prompt });
    
    if (result.success && result.data) {
      return {
        receiverIds: result.data.receiverIds || [],
        reason: result.data.reason
      };
    }
    
    return { receiverIds: [] };
  },


  async checkSenderDecision(chatState: ChatState): Promise<ChatState> {
    const { activeRound: round, progress, agents } = chatState;

    if (!progress.dialogue || !progress.dialogue.sender) {
      return chatState;
    }
    const dialogue = progress.dialogue;
    // sender is guaranteed non-undefined by the guard above
    const senderId = dialogue.sender as string;

    // Only applies to agent_decides mode
    const senderMode = (round as any).dialogueSenderMode || 'all_participants'; // Default to all_participants if null
    if (senderMode !== 'agent_decides') {
      // For other modes, auto-set to dialogue
      dialogue.senders[senderId].mode = 'dialogue';
      return chatState;
    }

    // Find the sender agent
    const senderAgent = agents.find(agent => agent.id === senderId);
    if (!senderAgent) {
      console.warn('[DialogueService] Sender agent not found');
      progress.dialogue.senders[progress.dialogue.sender].mode = 'skip';
      return chatState;
    }
    
    // For now, automatically set to dialogue mode - we'll implement the decision logic later
    progress.dialogue.senders[progress.dialogue.sender].mode = 'dialogue';
    
    // Set sender as active agent 
    progress.active.agent.id = senderAgent.id;
    progress.active.agent.mode = 'participant';
    
    return chatState;
  },

  async determineReceivers(chatState: ChatState): Promise<ChatState> {
    const { activeRound: round, progress, agents } = chatState;

    if (!progress.dialogue || !progress.dialogue.sender) {
      return chatState;
    }
    const dialogue = progress.dialogue;
    // sender is guaranteed non-undefined by the guard above
    const senderId = dialogue.sender as string;

    const sender = dialogue.senders[senderId];
    if (!sender || sender.mode !== 'dialogue') {
      return chatState;
    }
    
    // If receivers already determined, skip
    if (sender.receivers && Object.keys(sender.receivers).length > 0) {
      return chatState;
    }
    
    const receiverMode = (round as any).dialogueReceiverMode || 'all_participants';
    let receiverIds: string[] = [];
    
    switch (receiverMode) {
      case 'moderator_decides':
        // Moderator needs to choose receivers
        const moderatorDecision = await this.askModeratorToSelectReceivers(chatState);
        receiverIds = moderatorDecision.receiverIds;
        // Set moderator as active agent to stream their reason
        const receiverModerator = agents.find(a => a.id === (round as any).dialogueReceiverModerator);
        if (receiverModerator && moderatorDecision.reason) {
          progress.active.agent.id = receiverModerator.id;
          progress.active.agent.mode = 'moderator';
          const senderAgent = agents.find(a => a.id === senderId);
          chatState.moderatorVerbatimMessage = `I've selected the following agents to receive dialogues from ${senderAgent?.name || 'the sender'}: ${moderatorDecision.receiverIds.map(id => {
            const agent = agents.find(a => a.id === id);
            return agent?.name || id;
          }).join(', ')}.\n\n${moderatorDecision.reason}`;
        }
        break;
        
      case 'all_participants':
        // All participants except sender are receivers
        receiverIds = round.participants
          ?.map((p: any) => p.id)
          .filter((id: string) => id !== senderId) || [];
        break;
        
      case 'select':
        // Use pre-selected receivers
        receiverIds = (round as any).dialogueSelectedReceivers || [];
        break;
        
      case 'agent_decides':
        // Sender will choose receivers
        const senderDecision = await this.askSenderToSelectReceivers(chatState);
        receiverIds = senderDecision.receiverIds;
        
        // Set sender as active agent (in moderator mode) to stream their reason
        const senderAgent = agents.find(a => a.id === senderId);
        if (senderAgent && senderDecision.reason) {
          progress.active.agent.id = senderAgent.id;
          progress.active.agent.mode = 'moderator';
          chatState.moderatorVerbatimMessage = `I've decided to dialogue with the following agents: ${senderDecision.receiverIds.map(id => {
            const agent = agents.find(a => a.id === id);
            return agent?.name || id;
          }).join(', ')}.\n\n${senderDecision.reason}`;
        }
        break;
        
      default:
        console.warn(`[DialogueService] Unknown receiver mode: ${receiverMode}`);
    }
    
    // Populate receivers in dialogue progress
    receiverIds.forEach(receiverId => {
      sender.receivers[receiverId] = {
        mode: 'pending',
        messages: 0
      };
    });
    
    // If we have receivers but no current receiver, set the first one
    if (receiverIds.length > 0 && !progress.dialogue!.receiver) {
      progress.dialogue!.receiver = receiverIds[0];
    }
    
    return chatState;
  },

  async checkModeratorDialogueCompletion(chatState: ChatState): Promise<ChatState> {
    const { activeRound: round, progress, agents } = chatState;
    
    if (!progress.dialogue || !progress.dialogue.sender || !progress.dialogue.receiver) {
      return chatState;
    }

    // Only check completion for moderator-controlled dialogue length
    const dialogueLengthMode = (round as any).dialogueLengthMode;

    if (dialogueLengthMode !== 'moderator_decides') {
      return chatState;
    }

    // Find the dialogue length moderator agent
    const moderatorId = (round as any).dialogueLengthModerator;
    const moderatorAgent = agents.find(agent => agent.id === moderatorId);

    if (!moderatorAgent) {
      console.warn('[DialogueService] Dialogue length moderator agent not found');
      return chatState;
    }

    // Ask moderator if current dialogue should complete
    const decision = await this.askModeratorIfDialogueIsComplete(chatState);
    if (decision.complete) {
      // Re-check after await since TypeScript loses narrowing across async boundaries
      if (!progress.dialogue || !progress.dialogue.sender || !progress.dialogue.receiver) {
        return chatState;
      }
      const dialogue = progress.dialogue;
      // sender/receiver guaranteed non-undefined by the guard above
      const curSender = dialogue.sender as string;
      const curReceiver = dialogue.receiver as string;

      // Simply mark current receiver as complete - let iterateDialogueProgress handle the rest
      const sender = dialogue.senders[curSender];
      if (sender?.receivers[curReceiver]) {
        sender.receivers[curReceiver].mode = 'complete';
      }

      // Set moderator as active agent to stream their decision
      progress.active.agent.id = moderatorAgent.id;
      progress.active.agent.mode = 'moderator';

      // Set verbatim message based on decision
      const senderAgent = agents.find(a => a.id === curSender);
      const receiverAgent = agents.find(a => a.id === curReceiver);
      
      chatState.moderatorVerbatimMessage = `I've decided to complete the dialogue between ${senderAgent?.name || 'the sender'} and ${receiverAgent?.name || 'the receiver'}.\n\n${decision.reason || 'The dialogue has achieved its purpose.'}`;
    } 
    
    return chatState;
  },

  async askModeratorIfDialogueIsComplete(chatState: ChatState): Promise<{ complete: boolean; reason?: string }> {
    const { activeRound: round, agents, progress } = chatState;

    if (!progress.dialogue || !progress.dialogue.sender || !progress.dialogue.receiver) {
      return { complete: false };
    }
    const dialogue = progress.dialogue;
    // sender/receiver guaranteed non-undefined by the guard above
    const senderId = dialogue.sender as string;
    const receiverId = dialogue.receiver as string;

    // Find the dialogue length moderator agent
    const moderatorId = (round as any).dialogueLengthModerator;
    const moderatorAgent = agents.find(agent => agent.id === moderatorId);

    if (!moderatorAgent) {
      console.warn('[DialogueService] Dialogue length moderator agent not found');
      return { complete: false };
    }

    // Get current dialogue participants
    const senderAgent = agents.find(a => a.id === senderId);
    const receiverAgent = agents.find(a => a.id === receiverId);

    if (!senderAgent || !receiverAgent) {
      return { complete: false };
    }

    // Count messages in current dialogue
    const sender = dialogue.senders[senderId];
    const receiver = sender?.receivers[receiverId];
    const messageCount = receiver?.messages || 0;
    
    
    const prompt = `You need to decide if the current dialogue between ${senderAgent.name} and ${receiverAgent.name} should continue or complete.

Current dialogue participants:
- Sender: ${senderAgent.name}
- Receiver: ${receiverAgent.name}
- Messages exchanged: ${messageCount}

${(round as any).dialogueLengthInstructions ? `\nInstructions: ${(round as any).dialogueLengthInstructions}` : ''}

Based on the conversation quality and dialogue goals, should this dialogue:
- CONTINUE: The dialogue is productive and should continue
- COMPLETE: The dialogue has achieved its purpose and should end

Respond with your decision in this format:
DECISION: CONTINUE or COMPLETE
REASON: Brief explanation of your decision`;

    
    const result = await LLMService.generateTextForModerator(
      chatState,
      moderatorAgent,
      { expectJson: false, userPrompt: prompt }
    );
    
    
    if (!result.success || !result.text) {
      return { complete: false };
    }
    
    // Parse the response
    const response = result.text;
    const decisionMatch = response.match(/DECISION:\s*(CONTINUE|COMPLETE)/i);
    const reasonMatch = response.match(/REASON:\s*(.+?)(?:\n|$)/i);
    
    const decision = decisionMatch?.[1]?.toUpperCase();
    const reason = reasonMatch?.[1]?.trim();
    
    
    if (decision === 'COMPLETE') {
      return { complete: true, reason };
    } else {
      return { complete: false, reason };
    }
  },

  async generateDialogueInstructions(chatState: ChatState): Promise<ChatState> {
    const { activeRound: round, progress } = chatState;

    // Get message count for current dialogue
    const senderId = progress.dialogue?.sender;
    const receiverId = progress.dialogue?.receiver;
    const sender = senderId ? progress.dialogue?.senders[senderId] : undefined;
    const receiver = receiverId ? sender?.receivers[receiverId] : undefined;
    const messageCount = receiver?.messages || 0;
    const isFirstMessage = messageCount === 0;
    
    let instructions = '';
    
    // Handle initial message instructions (only for first message)
    if (isFirstMessage) {
      const initialMessageMode = (round as any).dialogueInitialMessageMode;
      if (initialMessageMode === 'manual' && (round as any).dialogueInitialMessage) {
        const manualMessage = (round as any).dialogueInitialMessage;
        instructions += manualMessage;
      } else if (initialMessageMode === 'generate' && (round as any).dialogueInitialMessageInstructions) {
        const generatedInstructions = await this.generateInstructionsWithAI(
          chatState, 
          (round as any).dialogueInitialMessageInstructions,
          'initial message'
        );
        instructions += generatedInstructions;
      }
    }
    
    // Handle general dialogue instructions (only for subsequent messages, not first)
    if (!isFirstMessage) {
      const dialogueInstructionsMode = (round as any).dialogueInstructionsMode;
      if (dialogueInstructionsMode === 'manual' && (round as any).dialogueInstructions) {
        if (instructions) instructions += '\n\n';
        const manualInstructions = (round as any).dialogueInstructions;
        instructions += manualInstructions;
      } else if (dialogueInstructionsMode === 'generate' && (round as any).dialogueInstructionsPrompt) {
        const generatedInstructions = await this.generateInstructionsWithAI(
          chatState,
          (round as any).dialogueInstructionsPrompt,
          'dialogue'
        );
        if (instructions) instructions += '\n\n';
        instructions += generatedInstructions;
      }
    }
    
    // Store generated instructions in dialogue progress
    if (!progress.dialogue) {
      progress.dialogue = this.initializeDialogueProgress();
    }
    progress.dialogue.systemPrompt = instructions;
    
    return chatState;
  },

  async generateInstructionsWithAI(chatState: ChatState, prompt: string, type: string): Promise<string> {
    const { agents, progress } = chatState;
    
    // Get dialogue context
    const senderAgent = agents.find(a => a.id === progress.dialogue?.sender);
    const receiverAgent = agents.find(a => a.id === progress.dialogue?.receiver);
    
    // Determine current agent based on message count (even = sender, odd = receiver)
    const senderId = progress.dialogue?.sender;
    const receiverId = progress.dialogue?.receiver;
    const sender = senderId ? progress.dialogue?.senders[senderId] : undefined;
    const receiver = receiverId ? sender?.receivers[receiverId] : undefined;
    const messageCount = receiver?.messages || 0;
    
    const currentAgent = messageCount % 2 === 0 ? senderAgent : receiverAgent;
    const otherAgent = currentAgent?.id === senderAgent?.id ? receiverAgent : senderAgent;
    
    const contextPrompt = `Generate ${type} instructions for ${currentAgent?.name || 'the current agent'} for their dialogue with ${otherAgent?.name || 'the other agent'}.

Context: ${prompt}

Generate clear, specific instructions that will help guide ${currentAgent?.name || 'this agent'} in their dialogue. Focus on the goals, tone, and approach ${currentAgent?.name || 'they'} should take.

Respond with just the instructions, no additional formatting or explanation.`;

    const result = await LLMService.generateTextWithAI(
      chatState,
      { 
        userPrompt: contextPrompt,
        includeHistory: true,
        systemPrompt: 'You are a helpful AI assistant that generates contextual dialogue instructions. Focus on creating instructions specifically for the agent mentioned. Do NOT include <AGENT> tags or reference yourself. Do NOT start with "As [agent name]" or similar. Just provide direct instructions for the agent to follow.'
      }
    );
    
    if (result.success && result.text) {
      const generatedText = result.text.trim();
      return generatedText;
    } else {
      console.warn('[DialogueService] Failed to generate instructions, using fallback');
      const fallback = `Engage in meaningful dialogue about: ${prompt}`;
      return fallback;
    }
  },

  /**
   * Check if current dialogue has reached the fixed message count limit
   */
  dialogueHasReachedCountLimit(chatState: ChatState): boolean {
    const { activeRound: round, progress } = chatState;
    
    // Only for fixed message count mode
    const dialogueLengthMode = (round as any).dialogueLengthMode;
    if (dialogueLengthMode !== 'fixed') {
      return false;
    }
    
    // Must have active dialogue
    if (!progress.dialogue || !progress.dialogue.sender || !progress.dialogue.receiver || progress.dialogue.mode !== 'dialogue') {
      return false;
    }

    // Get current dialogue info
    const sender = progress.dialogue.senders[progress.dialogue.sender];
    const receiver = sender?.receivers[progress.dialogue.receiver];
    
    if (!receiver) {
      return false;
    }
    
    // Check if we've reached the fixed message limit
    const messageLimit = (round as any).dialogueLength || 5; // Default to 5 if not set
    return receiver.messages >= messageLimit;
  },

  /**
   * Extract dialogue end decision from message content
   * Returns null if no end marker found
   */
  extractDialogueEndDecision(content: string): { end: boolean; reason?: string } | null {
    const endDialogueMatch = content.match(/\[END_DIALOGUE:\s*(.+?)\]/i);
    
    if (endDialogueMatch) {
      return {
        end: true,
        reason: endDialogueMatch[1]?.trim()
      };
    }
    
    return null;
  },

  /**
   * Process agent dialogue end decision from message content
   * Called after message completion to check for END_DIALOGUE marker
   */
  processAgentDialogueEndDecision(chatState: ChatState, messageContent: string): ChatState {
    const { activeRound: round, progress } = chatState;
    
    // Only process for agent_decides mode
    const dialogueLengthMode = (round as any).dialogueLengthMode;
    if (dialogueLengthMode !== 'agent_decides') {
      return chatState;
    }
    
    // Must have active dialogue
    if (!progress.dialogue || !progress.dialogue.sender || !progress.dialogue.receiver || progress.dialogue.mode !== 'dialogue') {
      return chatState;
    }

    // Check for END_DIALOGUE marker
    const decision = this.extractDialogueEndDecision(messageContent);
    
    if (decision?.end) {
      // Mark current dialogue as complete
      const sender = progress.dialogue.senders[progress.dialogue.sender];
      if (sender?.receivers[progress.dialogue.receiver]) {
        sender.receivers[progress.dialogue.receiver].mode = 'complete';
      }
      
      // Clear current receiver to move to next
      progress.dialogue.receiver = undefined;
      
      // Check if sender has more receivers
      const hasMoreReceivers = Object.entries(sender?.receivers || {})
        .some(([_, receiver]) => receiver.mode === 'pending');
      
      if (!hasMoreReceivers) {
        // Mark sender as complete
        sender.mode = 'complete';
        progress.dialogue.sender = undefined;
      }
      
      // Check if all senders are complete
      const allSendersComplete = Object.values(progress.dialogue.senders)
        .every(sender => sender.mode === 'complete');
      
      if (allSendersComplete) {
        progress.dialogue.mode = 'complete';
      }
    }
    
    return chatState;
  },

  /**
   * Iterate dialogue progress after a message is complete
   * Called from progress.iterateProgress() in onComplete
   * Handles all dialogue progression logic
   */
  iterateDialogueProgress(chatState: ChatState, messageContent: string): ChatState {
    const { progress, activeRound: round } = chatState;
    
    // Only process dialogue rounds
    if (round.type !== 'dialogue') {
      return chatState;
    }

    // Must have active dialogue
    if (!progress.dialogue || !progress.dialogue.sender || !progress.dialogue.receiver || progress.dialogue.mode !== 'dialogue') {
      return chatState;
    }

    const sender = progress.dialogue.senders[progress.dialogue.sender];
    const receiver = sender?.receivers[progress.dialogue.receiver];

    if (receiver.mode !== 'complete') {

      // Increment message count for current dialogue (only if not moderator)
      if (receiver && progress.active.agent.mode !== 'moderator') {
        receiver.messages++;
      }

      // 2. Check for agent-controlled dialogue end
      chatState = this.processAgentDialogueEndDecision(chatState, messageContent);

      // 3. Check for fixed message count completion
      const reachedLimit = this.dialogueHasReachedCountLimit(chatState);
      if (reachedLimit && receiver) {
        receiver.mode = 'complete';
        progress.dialogue.receiver = undefined;
      }
    }

    // Check if current dialogue completed (by any method)
    
    if (!progress.dialogue.receiver || receiver.mode === 'complete') {
      const nextReceiver = this.findNextPendingReceiver(progress.dialogue.sender, progress);
      
      if (nextReceiver) {
        progress.dialogue.receiver = nextReceiver;
      } else {
        sender.mode = 'complete';
        progress.dialogue.sender = undefined;
        progress.dialogue.receiver = undefined;
        
        // Find next available sender and set up their receivers
        const nextSender = this.findAndSetupNextSender(progress, chatState);
        if (!nextSender) {
          progress.dialogue.mode = 'complete';
        }
      }
    }
    
    // Clear dialogue instructions so they get regenerated fresh for each message
    if (progress.dialogue?.systemPrompt) {
      delete progress.dialogue.systemPrompt;
    }

    // Check if all senders have completed all their dialogues
    if (progress.dialogue && Object.keys(progress.dialogue.senders).length > 0) {
      const allSendersComplete = Object.values(progress.dialogue.senders).every(sender => sender.mode === 'complete');
      
      if (allSendersComplete) {
        progress.active.round.isComplete = true;
        progress.dialogue.mode = 'complete';
      }
    }

    return chatState;
  },

  /**
   * Find and setup the next sender, handling receiver determination and duplicates
   */
  findAndSetupNextSender(progress: ChatProgress, chatState: ChatState): string | null {
    const { activeRound: round } = chatState;
    
    while (true) {
      // Find next pending sender
      const nextSender = this.findNextPendingSender(progress);
      if (!nextSender) {
        // No more senders - dialogue round is complete
        return null;
      }
      
      progress.dialogue!.sender = nextSender;
      
      const receiverMode = (round as any).dialogueReceiverMode || 'all_participants';
      
      // If receiver mode is moderator_decides or agent_decides, just set sender and stop
      if (receiverMode === 'moderator_decides' || receiverMode === 'agent_decides') {
        return nextSender;
      }
      
      // Otherwise, set up receivers for this sender
      const sender = progress.dialogue!.senders[nextSender];
      
      // Check if sender already has receivers set up
      if (sender.receivers && Object.keys(sender.receivers).length > 0) {
        // Find first valid receiver (non-duplicate)
        const firstReceiver = this.findNextPendingReceiver(nextSender, progress);
        if (firstReceiver) {
          progress.dialogue!.receiver = firstReceiver;
          return nextSender;
        } else {
          // All receivers are duplicates - mark sender as complete and continue loop
          sender.mode = 'complete';
          progress.dialogue!.sender = undefined;
          continue;
        }
      } else {
        // No receivers set up yet - determine and set up receivers now for all_participants/select modes
        let potentialReceivers: string[] = [];
        if (receiverMode === 'all_participants') {
          // Get all participants except sender
          potentialReceivers = (round as any).participants
            ?.map((p: any) => p.id)
            .filter((id: string) => id !== nextSender) || [];
          
        } else if (receiverMode === 'select') {
          // Get pre-selected receivers
          potentialReceivers = (round as any).dialogueSelectedReceivers || [];
        }
          
        // Add non-duplicate receivers
        potentialReceivers.forEach((receiverId: string) => {
          // Check if reverse dialogue exists and has messages > 0
          const reverseReceiver = progress.dialogue!.senders[receiverId]?.receivers[nextSender];
          const reverseHasMessages = reverseReceiver && reverseReceiver.messages > 0;
          
          if (!reverseHasMessages) {
            sender.receivers[receiverId] = {
              mode: 'pending',
              messages: 0
            };
          }
        });
        
        // Check if we have any valid receivers after filtering duplicates
        const validReceivers = Object.keys(sender.receivers);
        if (validReceivers.length > 0) {
          // Set first receiver and return sender
          progress.dialogue!.receiver = validReceivers[0];
          return nextSender;
        } else {
          // No valid receivers - mark sender as complete and continue loop
          sender.mode = 'complete';
          progress.dialogue!.sender = undefined;
          continue;
        }
      }
    }
  },

  /**
   * Find the next pending receiver for a sender, skipping duplicates
   */
  findNextPendingReceiver(senderId: string, progress: ChatProgress): string | null {
    if (!progress.dialogue) return null;
    
    const sender = progress.dialogue.senders[senderId];
    if (!sender) return null;
    
    // Find pending receivers that are not duplicates
    const pendingReceiver = Object.entries(sender.receivers)
      .find(([receiverId, receiver]) => {
        if (receiver.mode !== 'pending') return false;
        
        // Check if reverse dialogue exists and has messages > 0 (receiverId as sender -> senderId as receiver)
        const reverseReceiver = progress.dialogue!.senders[receiverId]?.receivers[senderId];
        const reverseHasMessages = reverseReceiver && reverseReceiver.messages > 0;
        
        // Skip this receiver if reverse dialogue already has messages
        return !reverseHasMessages;
      });
    
    return pendingReceiver ? pendingReceiver[0] : null;
  },

  /**
   * Find the next pending sender
   */
  findNextPendingSender(progress: ChatProgress): string | null {
    if (!progress.dialogue) return null;
    
    const pendingSender = Object.entries(progress.dialogue.senders)
      .find(([_, sender]) => sender.mode === 'pending');
    
    return pendingSender ? pendingSender[0] : null;
  },

  /**
   * Check if dialogue should count as sender completion for round progress
   * Returns true only when a sender completes (not individual dialogue messages)
   */
  shouldCountAsSenderCompletion(chatState: ChatState): boolean {
    const { progress, activeRound: round } = chatState;
    
    if (round.type !== 'dialogue' || !progress.dialogue) {
      return false;
    }
    
    // Count as sender completion only when a sender just completed all their receivers
    return progress.dialogue.sender === undefined && 
           Object.values(progress.dialogue.senders).some(sender => sender.mode === 'complete');
  },

  /**
   * Log the complete dialogue state for debugging
   */
  logDialogueState(progress: ChatProgress, _prefix: string = '') {
    // Logging disabled for production
  }
};