// services/ProgressService.ts
import { ChatProgress, ChatState, ExtendedChatRound } from "../types";
import { createInitialProgress as sharedCreateInitialProgress, normalizeProgress as sharedNormalizeProgress } from "@/lib/types/chat-progress";
import { RoundUtils } from "./rounds";
import { LLMService } from './LLM';
import { PromptService } from './prompts';
import { DialogueService } from './dialogue';
import { MessageSenderService } from './messageSender';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Check if we need to determine the next round in a conditional transition
 */
function shouldDetermineRoundTransition(chatState: ChatState): boolean {
  const { progress } = chatState;
  
  // Check if active round status is 'transition' - waiting for moderator decision
  return progress.active.round.status === 'transition';
}

/**
 * Have the transition moderator determine the next round
 */
async function determineRoundTransition(chatState: ChatState): Promise<ChatState> {
  const { activeRound: round, agents, progress } = chatState;
  
  // Find the transition moderator agent
  const transitionModerator = agents.find(agent => agent.id === round.transitionModerator);
  if (!transitionModerator) {
    // Default to normal transition if moderator not found
    progress.active.round.status = 'closed';
    return chatState;
  }
  
  // Set moderator as active agent
  progress.active.agent.id = transitionModerator.id;
  progress.active.agent.mode = 'moderator';
  
  // Ask moderator to choose the next round
  const moderatorDecision = await askModeratorForNextRound(chatState);
  
  if (moderatorDecision.nextRoundId) {
    // Set up verbatim message for the moderator to stream
    const nextRound = chatState.rounds.find(r => r.id === moderatorDecision.nextRoundId);
    const nextRoundName = nextRound?.name || nextRound?.type || 'unknown';

    let verbatimMessage = `I've decided the next round should be: ${nextRoundName}.`;
    if (moderatorDecision.reason) {
      verbatimMessage += `\n\n${moderatorDecision.reason}`;
    }

    chatState.moderatorVerbatimMessage = verbatimMessage;
    console.log('[determineRoundTransition] Set verbatim message for moderator:', {
      moderatorId: chatState.progress.active.agent.id,
      nextRoundId: moderatorDecision.nextRoundId,
      verbatimLength: verbatimMessage.length,
      verbatimPreview: verbatimMessage.substring(0, 100)
    });
    
    // Update progress to complete the transition
    progress.active.round.status = 'closed';
    progress.active.round.isComplete = true; // Ensure completion status is preserved
    progress.next.round.id = moderatorDecision.nextRoundId;
    
    // Verify the selected round exists
    const selectedRound = chatState.rounds.find(r => r.id === moderatorDecision.nextRoundId);
    if (!selectedRound) {
      console.warn('[CONDITIONAL-TRANSITION] WARNING: Selected round ID not found in rounds array!');
    }
  } else {
    console.warn('[CONDITIONAL-TRANSITION] Moderator did not choose a valid round');
    progress.active.round.status = 'closed';
  }
  
  return chatState;
}

export async function setProgress(chatState: ChatState): Promise<ChatState> {
  const {activeRound} = chatState;

  // If no initial progress, create
  if (!chatState.progress.active) {
    chatState.progress = createInitialProgress(activeRound.id);
  } else {
    chatState.progress = normalizeProgress(chatState.progress);
  }
  
  // Check if we need to handle a conditional transition
  if (shouldDetermineRoundTransition(chatState)) {
    chatState = await determineRoundTransition(chatState);
    // Return early - moderator will stream the decision
    return chatState;
  }
  
  // Set dialogue-specific progress if this is a dialogue round
  if (activeRound.type === 'dialogue') {
    chatState = await DialogueService.setDialogueProgress(chatState);
  } else {
    // Set message sender progress for non-dialogue rounds
    chatState = await MessageSenderService.setMessageSenderProgress(chatState);
  }

  // Initialize agentMode for moderator if not set
  if (!chatState.progress.active.agent.id) {
    if (activeRound.participantOrder === 'moderator') {
      chatState.progress.active.agent.mode = 'moderator';
      if (activeRound.moderatorAgentId) {
        chatState.progress.active.agent.id = activeRound.moderatorAgentId;
      }
    } else {
      // Only set to participant if mode is not already set (preserve dialogue-set moderator mode)
      chatState.progress.active.agent.mode = 'participant';
    }
  }

  // Ask moderator about round completion
  if (shouldAskModeratorAboutRoundCompletion(chatState, activeRound)) {
    const moderatorDecision = await askModeratorIfRoundIsComplete(chatState);
    
    if (moderatorDecision.complete) {
      // Mark the round as complete immediately
      chatState.progress.active.round.isComplete = true;
      
      // Set the moderator to explain their decision (like other moderator actions)
      const lengthModerator = (activeRound as any).lengthModerator;
      if (lengthModerator && moderatorDecision.reason) {
        chatState.progress.active.agent.id = lengthModerator;
        chatState.progress.active.agent.mode = 'moderator';
        chatState.moderatorVerbatimMessage = `I've decided to complete this ${activeRound.type} round.\n\n${moderatorDecision.reason}`;
      }
    }
  }

  // Set active agent (only if not already set by moderator or dialogue service)
  if (!chatState.progress.active.agent.id || chatState.progress.active.agent.id === '') {
    const stepProgress = chatState.progress.active;
    const activeAgent = RoundUtils.determineNextAgent(chatState, stepProgress);
    chatState.progress.active.agent.id = activeAgent?.id || '';
  }
  
  // Determine if active round will be complete after next message (if not already set by moderator)
  if (!chatState.progress.active.round.isComplete) {
    const willBeComplete = isRoundCompleteAfterNextMessage(chatState.progress, activeRound);
    chatState.progress.active.round.isComplete = willBeComplete;
  }

  // Return the full chatState with updated progress
  return chatState;
}

function shouldAskModeratorAboutRoundCompletion(chatState: ChatState, round: ExtendedChatRound): boolean {
  const { progress } = chatState;

  if (round.lengthType !== 'moderator') {
    return false;
  }

  // Don't check if we have less than 1 message
  if (progress.messageAuthors.length === 0) {
    return false;
  }

  // Don't check if the last message was from a moderator selecting the next agent
  if (lastMessageWasFromModerator(progress, round)) {
    return false;
  }

  // Don't ask again if the round is already complete
  if (progress.active.round.isComplete) {
    return false;
  }

  // For moderator-controlled length, ask unless prevented by above conditions
  return true;
}

async function askModeratorForNextRound(chatState: ChatState): Promise<{nextRoundId: string, reason?: string}> {
  const { activeRound: round, agents, rounds } = chatState;

  // Build prompt with conditions
  let prompt = `You need to decide which round should come next based on the current conversation state.\n\n`;

  if (round.transitionPrompt) {
    prompt += `Instructions: ${round.transitionPrompt}\n\n`;
  }

  if (round.transitionConditions && round.transitionConditions.length > 0) {
    prompt += `Available options:\n`;
    for (const condition of round.transitionConditions) {
      const targetRound = rounds.find(r => r.id === condition.roundId);
      const roundName = targetRound?.name || targetRound?.type || 'unknown';
      prompt += `- Go to round ID "${condition.roundId}" (${roundName}) when: ${condition.condition}\n`;
    }
    prompt += `\n`;

    prompt += `Based on the conversation so far, which of these conditions is met?\n`;
    prompt += `Use the selectNextRound tool. You MUST provide both:\n1. The exact round ID from the options above (nextRoundId)\n2. A reason explaining why this condition is met (this is required and will be shared with participants)`;
  } else {
    // Fallback if no conditions are set
    prompt += `No specific conditions were configured. Please select the next round based on the conversation context.\n`;
    prompt += `Available rounds:\n`;
    for (const r of rounds) {
      const roundName = r.name || r.type || 'unknown';
      prompt += `- ID: "${r.id}" - Name: "${roundName}"\n`;
    }
    prompt += `\nUse the selectNextRound tool. You MUST provide both:\n1. The exact round ID (nextRoundId)\n2. A reason explaining your choice (this is required and will be shared with participants)`;
  }

  // Add memories if available for the moderator
  try {
    const { MemoryService } = await import('./memory');
    const memoryContents = await MemoryService.getMemoriesForPrompt(chatState);
    if (memoryContents.length > 0) {
      prompt += `\n\n<MEMORIES>\n`;
      prompt += `The following memories contain important information from previous rounds:\n\n`;
      prompt += memoryContents.join('\n\n');
      prompt += `\n</MEMORIES>`;
    }
  } catch (error) {
    console.error('[askModeratorForNextRound] ❌ Error getting memories for moderator:', error);
  }

  // Create tool for round selection
  const selectRoundTool = {
    selectNextRound: tool({
      description: 'Select which round should come next',
      inputSchema: z.object({
        nextRoundId: z.string().describe('The ID of the round to proceed to'),
        reason: z.string().describe('Your explanation of the decision based on the conditions (required)')
      }),
      execute: async ({ nextRoundId, reason }) => {
        return { nextRoundId, reason };
      },
    })
  };

  const transitionModerator = agents.find(agent => agent.id === round.transitionModerator);
  if (!transitionModerator) {
    // Default to the next round in sequence
    const nextRound = determineNextRound(chatState);
    return { nextRoundId: nextRound.id, reason: 'Moderator not found, using default sequence' };
  }

  const result = await LLMService.generateTextForModerator<{
    nextRoundId: string;
    reason?: string;
  }>(chatState, transitionModerator, { 
    userPrompt: prompt,
    tools: selectRoundTool,
    expectJson: true
  });
  
  if (result.success && result.data) {
    let nextRoundId = result.data.nextRoundId;
    
    // Validate if the returned ID is actually a round ID
    let targetRound = rounds.find(r => r.id === nextRoundId);
    
    // If not found by ID, try to find by name or type
    if (!targetRound) {
      targetRound = rounds.find(r => r.name === nextRoundId || r.type === nextRoundId);
      if (targetRound) {
        nextRoundId = targetRound.id;
      } else {
        console.warn(`[CONDITIONAL-TRANSITION] Moderator returned invalid round identifier: "${nextRoundId}"`);
        // Fallback to default transition
        const fallbackRound = determineNextRound(chatState);
        return { nextRoundId: fallbackRound.id, reason: `Invalid round selection "${nextRoundId}", using default transition` };
      }
    }
    
    return {
      nextRoundId: nextRoundId,
      reason: result.data.reason
    };
  }
  
  // Fallback to default transition
  const nextRound = determineNextRound(chatState);
  return { nextRoundId: nextRound.id, reason: 'Using default transition due to tool call failure' };
}

async function askModeratorIfRoundIsComplete(chatState: ChatState): Promise<{complete: boolean, reason?: string}> {
  const { activeRound: round, agents } = chatState;

  // Find the length moderator agent
  const moderatorAgent = agents.find(agent => agent.id === (round as any).lengthModerator);
  if (!moderatorAgent) {
    return { complete: false };
  }

  console.log('[askModeratorIfRoundIsComplete] Checking round completion:', {
    roundType: round.type,
    lengthType: round.lengthType,
    moderatorId: moderatorAgent.id,
    moderatorName: moderatorAgent.name,
    messageCount: chatState.progress.messageAuthors.length
  });

  // Get the prompt from the centralized PromptService
  const prompt = await PromptService.getModeratorCheckCompletionPrompt(chatState);

  // Create tool for completion decision
  const completionTool = {
    decideCompletion: tool({
      description: 'Decide if the current round should continue or complete',
      inputSchema: z.object({
        decision: z.enum(['CONTINUE', 'COMPLETE']).describe('Whether the round should continue or complete'),
        reason: z.string().describe('Brief explanation of your decision (required)')
      })
    })
  };

  const result = await LLMService.generateTextForModerator<{
    decision: 'CONTINUE' | 'COMPLETE';
    reason: string;
  }>(chatState, moderatorAgent, {
    userPrompt: `${prompt}\n\nUse the decideCompletion tool to make your decision. You MUST provide both:\n1. Your decision (CONTINUE or COMPLETE)\n2. A reason explaining your decision (this is required and will be shared with participants)`,
    tools: completionTool,
    expectJson: true // Fallback if tool isn't used
  });

  if (result.success && result.data) {
    console.log('[askModeratorIfRoundIsComplete] Moderator decision:', {
      decision: result.data.decision,
      complete: result.data.decision === 'COMPLETE',
      reason: result.data.reason
    });

    const shouldComplete = result.data.decision === 'COMPLETE';

    // If moderator decides to CONTINUE, clear meta prompts to prevent pollution
    // The moderator's completion check prompt should not leak into the next participant's metadata
    if (!shouldComplete && chatState.meta?.prompts) {
      console.log('[askModeratorIfRoundIsComplete] Clearing meta prompts after CONTINUE decision');
      chatState.meta.prompts = { system: '', instructions: '' };
    }

    return {
      complete: shouldComplete,
      reason: result.data.reason
    };
  }

  // Fallback to text parsing if tool wasn't used
  if (!result.success || !result.text) {
    // Clear meta prompts when falling back to prevent pollution
    if (chatState.meta?.prompts) {
      chatState.meta.prompts = { system: '', instructions: '' };
    }
    return { complete: false };
  }
  
  // Parse the response
  const response = result.text;
  const decisionMatch = response.match(/DECISION:\s*(CONTINUE|COMPLETE)/i);
  const reasonMatch = response.match(/REASON:\s*(.+?)(?:\n|$)/i);

  const decision = decisionMatch?.[1]?.toUpperCase();
  const reason = reasonMatch?.[1]?.trim();

  const shouldComplete = decision === 'COMPLETE';

  // If moderator decides to CONTINUE, clear meta prompts to prevent pollution
  if (!shouldComplete && chatState.meta?.prompts) {
    console.log('[askModeratorIfRoundIsComplete] Clearing meta prompts after CONTINUE decision (text fallback)');
    chatState.meta.prompts = { system: '', instructions: '' };
  }

  return {
    complete: shouldComplete,
    reason
  };
}

// Use the shared normalizeProgress function but adapting as needed
function normalizeProgress(progress: ChatProgress): ChatProgress {
  return sharedNormalizeProgress(progress);
}

// Create initial progress state - using the shared function but with API step default
export function createInitialProgress(roundId: string): ChatProgress {
  return sharedCreateInitialProgress(roundId, 'api');
}

// Check if a round is complete
export function isRoundCompleteAfterNextMessage(progress: ChatProgress, round: ExtendedChatRound): boolean {
  if (progress.active.agent.mode === 'moderator') {
    return false;
  }

  // For length moderator rounds, check max message limit as safety override
  if (round.lengthType === 'moderator') {
    const maxMessages = round.lengthNumber || 10;
    if (progress.messageAuthors.length + 1 >= maxMessages) {
      return true;
    }
    // For moderator-controlled rounds, only complete when they decide (isComplete will be set)
    return false;
  }

  // Create minimal chatState for round completion check
  const minimalChatState = {
    activeRound: round,
    progress
  } as ChatState;
  
  return RoundUtils.isRoundComplete(round, progress.messageAuthors.length + 1, minimalChatState);
}

export const determineNextRound = (chatState: ChatState): ExtendedChatRound => {
  const {rounds, activeRound:round} = chatState;

  if (!round || !rounds?.length) {
    return round;
  }

  const currentIndex = rounds.findIndex((r: any) => r.id === round.id);

  if (currentIndex === -1) {
    return round;
  }

  // If it's the only round, stay on it
  if (rounds.length === 1) {
    return round;
  }
  
  // If it's the last round, cycle back to the first round
  if (currentIndex === rounds.length - 1) {
    return rounds[0] as ExtendedChatRound;
  }
  
  // Otherwise return the next round
  return rounds[currentIndex + 1] as ExtendedChatRound;
};

export function iterateProgress(chatState: ChatState, result: any) {
  const {progress, activeRound:round, rounds, activeAgent:agent} = chatState;

  // Handle dialogue-specific progress iteration FIRST (so it can set round completion)
  if (round.type === 'dialogue') {
    const messageContent = result?.text || '';
    chatState = DialogueService.iterateDialogueProgress(chatState, messageContent);
  }

  // Clear moderator verbatim message for non-dialogue rounds after it's been used
  MessageSenderService.clearModeratorMessage(chatState);

  const isComplete = progress.active.round.isComplete;


  // create a local copy to stream back
  const nextProgress = {
    ...progress
  }
  nextProgress.next.step = 'api';
  nextProgress.next.agent = {
    id: '',
    mode: 'participant'
  };
  
  // Only increment message count and add author if this isn't a tool-only message
  // and if this is a participant (not a moderator)
  if (progress.active.agent.mode !== 'moderator') {
    // For dialogue rounds, only count senders completing (not individual dialogue messages)
    if (round.type === 'dialogue') {
      if (DialogueService.shouldCountAsSenderCompletion(chatState)) {
        nextProgress.messageCount++;
        nextProgress.messageAuthors.push(agent?.id);
      }
    } else {
      // Normal rounds count every participant message
      nextProgress.messageCount++;
      nextProgress.messageAuthors.push(agent?.id);
    }
  }

  // Update nextProgress with any dialogue state changes
  if (round.type === 'dialogue') {
    nextProgress.dialogue = chatState.progress.dialogue;
  }

  // Handle moderator/participant mode toggle if using moderator participant order
  if (round.participantOrder === 'moderator' && !isComplete) {
    // If we just had a moderator, next should be participant (unless explicitly set by a tool)
    if (progress.active.agent.mode === 'moderator') {
      nextProgress.next.agent.mode = 'participant';
    } 
    // If we just had a participant, next should be the moderator
    else if (progress.active.agent.mode === 'participant') {
      nextProgress.next.agent.mode = 'moderator';
      nextProgress.next.agent.id = ''; // Reset nextAgent so getNextAgent will pick the moderator
    }
  }

  // default the next round to the current round
  let nextRound = round;

  // Handle conditional transitions: set status for next round
  if (isComplete) {
    if (round.transition as string === 'conditional' && progress.active.round.status === 'active') {
      // First time completing with conditional transition - set next round to transition status
      nextProgress.next.round.status = 'transition';
    } else {
      // Normal completion or completed transition - mark active round as closed
      nextProgress.active.round.status = 'closed';
    }
  }

  if (isComplete && nextProgress.active.round.status === 'closed') {
    // Closed, determine next round and reset counts
    if (round.transition as string === 'conditional') {
      // Moderator has chosen a different round - use it
      nextRound = rounds.find(r => r.id === progress.next.round.id) as ExtendedChatRound || determineNextRound(chatState);
    } else {
      // Normal transition
      nextRound = determineNextRound(chatState);
    }

    nextProgress.next.step = round.transition === 'user' ? 'user' : 'api';
    nextProgress.messageCount = 0;
    nextProgress.messageAuthors = [];
    nextProgress.next.agent.id = '';
    nextProgress.next.agent.mode = (nextRound.participantOrder === 'moderator') ? 'moderator' : 'participant';
    
    // Reset message senders for the new round
    MessageSenderService.resetMessageSenders(nextProgress);
  } else if (isComplete && nextProgress.next.round.status === 'transition') {
    // Still waiting for moderator or moderator just made decision
    nextRound = round;
  } else {
    // Not complete - keep current round
    nextRound = round;
  }

  nextProgress.next.round.id = nextRound.id;

  return nextProgress;
}

/**
 * Activates the next progress state by moving it to active and resetting next.
 * This centralizes the common pattern of transitioning from next -> active.
 * Returns a new progress object with the transition applied.
 */
export function activateNextProgress(progress: ChatProgress): ChatProgress {
  if (!progress?.next?.round) {
    return progress;
  }

  const isRoundTransition = progress.active.round.id !== progress.next.round.id;

  // Determine which session to preserve:
  // - If transitioning to new round, ONLY use session from progress.next (replay scenario)
  //   Don't fallback to progress.active.session - let new session be created naturally
  // - If staying in same round, use session from progress.active
  const sessionToPreserve = isRoundTransition
    ? (progress.next as any)?.session
    : (progress.active as any)?.session;

  const updatedProgress: ChatProgress = {
    ...progress,
    active: {
      step: progress.next.step,
      agent: progress.next.agent || { id: '', mode: 'participant' },
      round: {
        id: progress.next.round.id,
        isComplete: false,
        status: progress.next.round.status
      },
      // Reset senders state for new rounds, preserve within same round
      senders: !isRoundTransition ? progress.active.senders : undefined,
      // Preserve session ID if it was set (important for replay to reuse existing session)
      ...(sessionToPreserve ? { session: sessionToPreserve } : {})
    } as any,
    next: { step: 'api', round: { id: '' } }
  };

  // Reset message senders when transitioning to a new round
  if (isRoundTransition) {
    MessageSenderService.resetMessageSenders(updatedProgress);
  }

  // Only clear dialogue state when transitioning to a new round, not within the same round
  if (isRoundTransition && progress.dialogue) {
    delete updatedProgress.dialogue;
  }

  return updatedProgress;
}

/**
 * Check if a round is truly closed (not just transitioning)
 */
export function isActiveRoundClosed(progress: ChatProgress): boolean {
  return progress.active.round.status === 'closed';
}

/**
 * Determines if the last message was from a moderator selecting the next agent.
 * 
 * This is complex because moderator messages are NOT tracked in messageAuthors,
 * so we can't directly check the last author. Instead, we infer this by checking
 * if we're in a moderator-controlled round where we just switched from moderator
 * mode to participant mode with existing messages.
 */
function lastMessageWasFromModerator(progress: ChatProgress, round: ExtendedChatRound): boolean {
  // Only applies to moderator-controlled rounds
  if (round.participantOrder !== 'moderator') {
    return false;
  }
  
  // If we're currently in participant mode and have messages, it means
  // the moderator just selected an agent (since moderator messages aren't in messageAuthors)
  return progress.active.agent.mode === 'participant' && progress.messageAuthors.length > 0;
}
