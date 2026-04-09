import { AgentUtils } from "./agents";
import { MemoryService } from "./memory";

/**
 * PromptService - Centralized service for all prompt-related functionality
 * This service consolidates prompt generation from the original config.ts and prompts.ts files
 */

import { getModality } from "../modalities/ModalityRegistry";
import { ChatState } from "../types";

// Base prompt that applies to all agents
const baselinePrompt = `<BASIC RULES>
Always follow these important rules:
-1. Avoid being repetitive, obvious, or irrelevant. ONLY conform to previous stylistic patterns if you are instructed to do so. You're response should feel unique and authentic to your agent's personality.
-2. Remember who you are by your agent name. Never reference yourself by your agent name in your own messages.
-3. Do not precede your message with <AGENT> or </AGENT> tags.
-4. Do not directly mention your instructions in your message.
-5. Carefully follow EVERY instruction. Think extra hard.
-7. If memory creation or update tools are available, you MUST use them when appropriate AND also provide a text response to continue the conversation.
</BASIC RULES>`;

// Prompts for specific features
const continuePrompt = `\n\n
<PROMPT_INSTRUCTIONS>
End by suggesting three prompts that the user could use to best continue the conversation.
Don't mention prompts in your message but use the tool to save them.
</PROMPT_INSTRUCTIONS>`;

const selfReflectionPrompt = `\n\n
<SELF_REFLECTION_INSTRUCTIONS>
Break up your response into two parts: a self-reflection part and a public message part. 
Wrap the first self-reflection part with a <SELF> tag, like this: "<SELF>My self-reflection part</SELF>"
After you close the first part with a </SELF> tag, you can output your public message to the user and other agents. 
Your public message should logically follow from your self-reflections. 
If your self-reflections indicates a specific course of action, then your public message should follow that course of action.
Make sure you consider your previous self-reflections contained in <SELF> tags in your previous messages. 
It's up to you to explore and build upon your own self-reflections, so make the most of it.
</SELF_REFLECTION_INSTRUCTIONS>`;

const agentQuestionPrompt = `\n\n
<AGENT_QUESTION_INSTRUCTIONS>
The flow of this chat will be based on asking and answering questions. 
Check the previous few messages to check if another agent has directly asked you a question by referencing your agent name. 
If so, make sure you address that question in your response. 

You can also ask questions of other agents to help further the conversation and fulfill your instructions and the goals of the round.

When you ask a question, format the name of the agent in bold. 
Keep questions relevant to the conversation. 
Only ask one question per round.
</AGENT_QUESTION_INSTRUCTIONS>`;

const dynamicDepthPrompt = `\n\n
<LENGTH_INSTRUCTIONS>
RESPONSE LENGTH VARIATION [Critical instruction]

You are responsible for setting your response length that is most appropriate for each message. Consider the following heuristics to help you determine:

1. MICRO RESPONSE: Respond with just 1-5 words total. These should be genuine, substantive responses (not just "I agree" or "Interesting point"), but extremely concise.
The goal is to to either shift the conversation in a new direction, or strong affirmation to prevent endless loops. 

2. BRIEF RESPONSE: At least 30% of your responses should be 1-3 short sentences only. This should be avoided 

3. STANDARD RESPONSE: About 50% of your responses can be your typical length of a few paragraphs.
Usually a good candidate for starting a conversation or new round.

4. EXTENDED RESPONSE: Occasionally, when the topic truly warrants depth, provide a more comprehensive response.

Whatever you do, do NOT simply follow the same patterns of length of previous messages. 
In fact, you should likely invert any patterns and vary the lengh from the previous message to keep the energy of the conversation dynamic!
For example, if the message history has 1 or 2 concise responses in a row, then an additional concise response is not helpful, and you should add a message with more depth.
Or, if someone is directly asking you to elaborate or answer a question, then a concise response is not appropriate.
The length should be appropriate to both the flow of the conversation and the goals of your message.

Do NOT use micro or brief responses for your first message in a conversation or new round.

Above all, maintain your own natural cadence rather than becoming entrained in repetitive patterns. Your responses should feel like they are authentically in service of keeping the energy of the conversation high, not an echo.
</LENGTH_INSTRUCTIONS>
`;

/**
 * PromptService - Main service object containing all prompt-related methods
 */
export const PromptService = {
  /**
   * Get agent handoff prompt
   * @param round The round configuration
   * @param agent The current agent
   * @param agents All available agents
   * @returns The agent handoff prompt
   */
  getAgentHandoffPrompt(round: any, agent: any, agents: any) {
    // Exclude the active agent from the list of agents
    const agentChoices = AgentUtils.getAgentsForRound(round, agents)
      .filter((a: any) => a.id !== agent.id)
      .map((agent: any) => `Name: ${agent.name}, agentID: ${agent.id}`)
      .join('\n');

    return `\n\n<NEXT_AGENT_INSTRUCTIONS>After you complete your entire response, you must decide which agent will best keep the conversation generative and productive. 
Your priority is based on the following criteria, from highest priority to lowest priority:
- First, if you have addressed an agent directly in your message, or want to ask an agent a question, then always choose that agent.
- Second, if one of the agents has obviously spoken less than the others, choose that agent.
- Finally, choose the agent that is most likely to keep the conversation generative and productive.

Choose from the following list of agent names and when to choose them:
${agentChoices}

Then add this to very end of your message: 
[NEXT_AGENT:AGENT_ID]
Replace AGENT_ID with the ID of the agent who should speak next.

This should be the very last thing in your message. Do not mention anything about choosing the next agent in your message content.
</NEXT_AGENT_INSTRUCTIONS>`;
  },

  /**
   * Get moderator handoff prompt
   * @param round The round configuration
   * @param agent The current agent (moderator)
   * @param agents All available agents
   * @returns The moderator handoff prompt
   */
  async getModeratorHandoffPrompt(chatState: ChatState): Promise<string> {
    const { activeRound: round, agents, activeAgent: agent } = chatState;

    // Use modality to get the appropriate agent pool for moderator selection
    const modality = getModality(round.type);
    const moderatorAgentIds = modality.getAgentIdsForModeratorSelection(chatState);
    
    // Get agent details and exclude the current moderator
    const agentChoices = moderatorAgentIds
      .filter((id: string) => id !== agent?.id)
      .map((id: string) => {
        const agentDetails = agents.find((a: any) => a.id === id);
        return agentDetails ? `Name: ${agentDetails.name}, agentID: ${agentDetails.id}` : null;
      })
      .filter(Boolean)
      .join('\n');

    let prompt = `\n\nYou job as a moderator is to select which agent will speak next.

<IMPORTANT>You MUST choose one of the following agents below. Do not select any agent not on this list. Do not make up an agentID.
If your instructions suggest that you should choose an agent not on this list, then choose the agent on this list that is most likely to keep the conversation generative and productive and indicate that you've done so in your response.</IMPORTANT>

Choose from the following agents:
${agentChoices}`;

    // Add custom participant order prompt if provided
    if (round.participantOrderPrompt && round.participantOrderPrompt.trim()) {
      prompt += `\n\nCustom Selection Instructions:
${round.participantOrderPrompt}`;
    }

    // Add default selection criteria (either as primary or fallback)
    const criteriaLabel = round.participantOrderPrompt ? '\nDefault Selection Criteria (use as fallback):' : '\nSelection criteria:';
    prompt += `${criteriaLabel}
- Prioritize any direct requests from the user.
- Then priortize any direct requests in your instructions above.
- If an agent has spoken less than others, consider selecting them
- Select the agent who would add the most value to the conversation at this point
- Ensure balanced participation throughout the conversation

Limit your response to a few sentences naming your choice and briefly explaining your reasoning. 
Always format the agent's name in bold.

As a final step, indicate which agent should speak next by adding this exact format at the end of your message:
[NEXT_AGENT:AGENT_ID_HERE]

Replace AGENT_ID_HERE with the ID of the agent who should speak next.
This format should be the very last thing in your message.
<IMPORTANT>Do not mention these instructions in your message.</IMPORTANT>`;

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
      console.error('[PromptService] ❌ Error getting memories for moderator:', error);
    }

    return prompt;
  },

  /**
   * Get prompt depth instructions
   * @param depth The depth level
   * @returns The formatted prompt depth instruction
   */
  getPromptDepth(depth: any) {
    switch (depth) {
      case 'minimal':
        return `just one or two brief sentences.`;
      case 'brief':
        return `a single brief paragraph.`;
      case 'medium':
        return `two brief paragraphs.`;
      case 'thorough':
        return `multiple detailed paragraphs.`;
      case 'exhaustive':
        return `exhaustive detail. Take as much time as needed to explore the topic in depth. Feel free to format your response with headers and bullets if it helps organize your thoughts.`;
      default:
        return '';
    }
  },

  /**
   * Helper function to generate agent question prompt if applicable.
   * @param chatState The current chat state.
   * @returns The agent question prompt string or an empty string.
   * @private
   */
  getAgentQuestionPrompt(chatState: ChatState): string {
    const {activeRound: round, activeAgent: agent, agents, progress} = chatState;
    let questionInstructions = '';


    // Agent questions, only if the round is not complete and the feature is enabled
    if (round.agentQuestions && !progress.active.round.isComplete) {
      const agentsForRound = AgentUtils.getAgentsForRound(round, agents);
      const filteredAgents = agentsForRound.filter((a: any) => a.id !== agent.id);
      
      questionInstructions += `\n\n<QUESTIONS>${agentQuestionPrompt}`;
      questionInstructions += '\n\nPick one of the following agents to ask a question to:\n';
      questionInstructions += filteredAgents
        .map((a: any) => `${a.name}`)
        .join('\n');
      questionInstructions += `\n\nImportant: if you have already saved an agent to speak next, then choose that agent.</QUESTIONS>`;
    }
    
    return questionInstructions;
  },

  /**
   * Get round instructions for an agent
   * @param chatState The current chat state.
   * @returns Complete round instructions for the agent
   */
  getRoundPrompt(chatState: ChatState) {
    const {activeRound: round, activeAgent: agent, agents, progress} = chatState;


    // modality specific instructions
    let prompt = getModality(round.type).getSystemPrompt(chatState);

    // Custom instructions
    if (round.instructions) {
      prompt += `\n\n${round.instructions}`;
    }

    // Tool instructions for prompt suggestions
    if (round.showPrompts && progress.active.round.isComplete) {
      prompt += continuePrompt;
    }

    // Self reflection
    if (round.agentSelfReflection) {
      prompt += selfReflectionPrompt;
    }

    // Agent questions
    const agentQuestionPrompt = this.getAgentQuestionPrompt(chatState);
    prompt += agentQuestionPrompt;

    // Handoff prompt, only if the round is not complete
    if (round.participantOrder === 'handoff') {
      let handoffPrompt = '';
      if (!progress.active.round.isComplete) {
        handoffPrompt = this.getAgentHandoffPrompt(round, agent, agents);
      } else {
        handoffPrompt = '\n\nThis round is now complete so do not ask any questions like previous agents might have.'
      }
      prompt += handoffPrompt;
    }

    // Response depth instructions
    if (round.type !== 'brainstorm') {
      if (round.depth === 'dynamic') {
        prompt += dynamicDepthPrompt;
      } else {
        prompt += `\n\n
<LENGTH_INSTRUCTIONS>
Limit your response to ${this.getPromptDepth(round.depth)}
</LENGTH_INSTRUCTIONS>`;
      }
    }

    return prompt;
  },

  /**
   * Get agent prompt
   * @param agent The agent
   * @returns The agent's system prompt
   */
  async getAgentPrompt(chatState: ChatState, agent: any) {
    const {activeRound: round, agents} = chatState;

    let prompt = `You are <AGENT>${agent.name}</AGENT>. `

    // Get all non-moderator participant IDs for this round
    const modality = getModality(round.type);
    const nonModeratorIds = modality.getAllNonModeratorIds(chatState);
    
    // Get other non-moderator participants (excluding the current agent)
    const otherAgents = nonModeratorIds
      .filter(id => id !== agent.id)
      .map(id => agents.find((a: any) => a.id === id))
      .filter(Boolean);
    
    const otherAgentCount = otherAgents.length;

    if (otherAgentCount > 0) {
      const agentNames = otherAgents.map((a: any) => a.name).join(', ');
      if (otherAgentCount === 1) {
        prompt += `You are participating in a group conversation with 1 other LLM agent: ${agentNames}. `;
      } else {
        prompt += `You are participating in a group conversation with ${otherAgentCount} other LLM agents: ${agentNames}. `;
      }
    } else {
      prompt += `You are participating in a group conversation. `;
    }

    prompt += `Previous messages from other agents are visible to you. Each previous assistant message begins with the agent's name, for example: <AGENT>Agent 1</AGENT>. `;
    prompt += `Your own previous messages are visible to you. These messages begin with your own name, like this: <AGENT>${agent.name}</AGENT>. `;
    
    prompt += `\n\n${agent.systemPrompt}`;

    return prompt;
  },

  /**
   * Get memory-related prompts for an agent
   * @param chatState The current chat state.
   * @returns Memory prompts string or null if no memory functionality needed
   */
  async getMemoryPrompts(chatState: ChatState): Promise<string | null> {
    const hasMemoryCreation = MemoryService.shouldEnableMemoryCreation(chatState);
    const hasMemoryUpdates = MemoryService.shouldEnableMemoryUpdates(chatState);
    const currentRoundId = chatState.activeRound.id;
    const round = chatState.activeRound as any;
    let memoryPrompt = '';

    // Add memory tool instructions if memory tools are available
    if (hasMemoryCreation || hasMemoryUpdates) {
      memoryPrompt += `\n\n<MEMORY_TOOLS>\n`;

      if (hasMemoryCreation) {
        // Get privacy-aware creatable memories for current agent
        const creatableMemories = await MemoryService.getCreatableMemories(chatState);

        memoryPrompt += `MEMORY CREATION: You have access to create memories in this round. `;
        if (creatableMemories.length > 0) {
          memoryPrompt += `Use the createMemory tool to save memories about the following:\n`;
          creatableMemories.forEach((memory: any) => {
            // memorizeRound is always the current round for creatable memories,
            // so memorizeInstructions is the correct field (no round-specific override needed)
            memoryPrompt += `- "${memory.name}": ${memory.memorizeInstructions || `Record memories about "${memory.name}"`}\n`;
          });
        }
      }

      if (hasMemoryUpdates) {
        // Get privacy-aware updatable memories for current agent
        const updatableMemories = await MemoryService.getUpdatableMemories(chatState);

        memoryPrompt += `MEMORY UPDATES: You can update existing memories in this round. `;
        if (updatableMemories.length > 0) {
          memoryPrompt += `Updatable memories:\n`;
          updatableMemories.forEach((memory: any) => {
            // Check for round-specific update instructions first
            let updateInstructions = '';
            if (memory.updateWhen === 'specific_rounds' && memory.updateRounds) {
              const roundConfig = memory.updateRounds.find((r: any) => r.roundId === currentRoundId);
              updateInstructions = roundConfig?.instructions || '';
            }

            // Fall back to default update instructions if no round-specific ones
            if (!updateInstructions) {
              updateInstructions = memory.updateInstructions || 'Update with new information';
            }

            memoryPrompt += `- "${memory.name}": ${updateInstructions}\n`;
          });
        }
      }
      memoryPrompt += `<CRITICAL>
Remember: Generate a text message to the user *before* using any memory tools. 
NEVER mention anything about memories or using memory tools. 
Instead, respond to user messages using non-memory instructions.`

if (round.agentSelfReflection) {
  memoryPrompt += `\nFinally, remember to use your self-reflection before using any memory tools.`
}

memoryPrompt +=`
</CRITICAL>\n`;
      memoryPrompt += `</MEMORY_TOOLS>`;
    }

    // Inject memories (instructions are now included in each memory)
    try {
      // Get memory contents with instructions already included
      const memoryContents = await MemoryService.getMemoriesForPrompt(chatState);

      if (memoryContents.length > 0) {
        memoryPrompt += `\n\n<MEMORIES>\n`;
        memoryPrompt += `The following memories contain important information from previous rounds:\n\n`;
        memoryPrompt += memoryContents.join('\n\n');
        memoryPrompt += `\n</MEMORIES>`;
      }
    } catch (error) {
      console.error('[PromptService] ❌ Error getting memories for instructions:', error);
      console.error('[PromptService] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    }

    return memoryPrompt || null;
  },

  /**
   * Get round instructions for an agent
   * @param chatState The current chat state.
   * @returns Complete system prompt for the agent
   */
  async getInstructionsPrompt(chatState: ChatState) {
    const {progress} = chatState;

    let systemPrompt = '<INSTRUCTIONS>'

    if (progress.active.agent.mode === 'moderator') {
      // Check if there's a verbatim message to stream
      if (chatState.moderatorVerbatimMessage) {
        // Streaming moderator verbatim message
        console.log('[PromptService] Generating verbatim prompt for moderator:', {
          verbatimLength: chatState.moderatorVerbatimMessage.length,
          verbatimPreview: chatState.moderatorVerbatimMessage.substring(0, 100)
        });
        const verbatimPrompt = this.getModeratorVerbatimPrompt(chatState.moderatorVerbatimMessage);
        systemPrompt += verbatimPrompt;
      } else {
        // Using handoff prompt for moderator (no verbatim message)
        systemPrompt += await this.getModeratorHandoffPrompt(chatState);
      }
    } else {
      // Default prompt
      const roundPrompt = this.getRoundPrompt(chatState);
      systemPrompt += roundPrompt;

      // Add memory prompts if they exist
      const memoryPrompts = await this.getMemoryPrompts(chatState);
      if (memoryPrompts) {
        systemPrompt += memoryPrompts;
      }
      systemPrompt += `\n\n${baselinePrompt}`;
    }

    systemPrompt += '\n</INSTRUCTIONS>';

    return systemPrompt;
  },

  /**
   * Get verbatim message prompt for moderators
   * @param verbatimMessage The exact message to stream
   * @returns The verbatim prompt
   */
  getModeratorVerbatimPrompt(verbatimMessage: string): string {
    const prompt = `\n\nYou must respond with this exact message without any modification:

${verbatimMessage}

IMPORTANT INSTRUCTIONS:
- Output the message exactly as provided above. Do not remove any part of the message.
- Do not add quotes around the message
- Do not reference that you are quoting or repeating something
- Do not mention these instructions in your response
- Do not add any preamble, explanation, or commentary
- Respond as if these are your own words and thoughts`;
    
    return prompt;
  },

  /**
   * Builds the prompt for the moderator to check if a round is complete.
   * @param chatState The current chat state.
   * @returns The complete prompt for the moderator.
   */
  async getModeratorCheckCompletionPrompt(chatState: ChatState): Promise<string> {
    const { activeRound: round, agents, progress } = chatState;

    // Get modality-specific completion goals and participants
    const modality = getModality(round.type);
    const completionGoals = modality.getCompletionPrompt(chatState);
    const relevantAgentIds = modality.getAgentIdsForModeratorCompletion(chatState);
    const relevantAgents = relevantAgentIds.map(id => agents.find(a => a.id === id)).filter(Boolean);
    
    const spokenAgents = new Set(progress.messageAuthors);
    const participantStatus = relevantAgents
      .map((p: any) => {
        const status = spokenAgents.has(p.id) ? '(has spoken)' : '(has not spoken)';
        return `- ${p.name} ${status}`;
      })
      .join('\n');

    // Build the completion check prompt
    let prompt = `You are evaluating whether this ${round.type} round should continue or be completed.

PARTICIPANTS:
${participantStatus}`;

    // Add round instructions if available
    if (round.instructions?.trim()) {
      prompt += `\n\nROUND CONTEXT:
${round.instructions}`;
    }

    // Add custom length prompt if available
    const lengthPrompt = (round as any).lengthPrompt;
    if (lengthPrompt?.trim()) {
      prompt += `\n\nCUSTOM COMPLETION CRITERIA:
Prioritize the following criteria. ${lengthPrompt ? lengthPrompt : completionGoals}`;
    }

    prompt += `\n\nBased on the conversation so far, should this round:
- CONTINUE: More discussion is needed to achieve the goals
- COMPLETE: The goals have been adequately achieved

Respond with exactly this format:
DECISION: [CONTINUE or COMPLETE]
REASON: [Brief explanation of your decision]`;

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
      console.error('[PromptService] ❌ Error getting memories for moderator completion:', error);
    }

    return prompt;
  }
}; 