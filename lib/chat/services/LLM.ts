/**
 * LLMService - Centralized service for all LLM-related functionality
 * This service consolidates model configuration, temperature settings, and stream handling
 */

import { ChatState, LLMParams } from '../types';
import { PromptService } from './prompts';
import { ModelService } from './models';
import { ToolsService } from './tools';
import { MessageUtils } from './messages';
import { CHAT_USER_CONTINUE } from '@/lib/constants';
import { smoothStream, generateText, stepCountIs } from 'ai';
import { convertUIMessagesToModelMessages } from './ui-message';
// logDebug import removed - not used in production
import { logError } from '@/lib/utils/error';
import { logDebug } from '@/lib/utils/debug';

function getTemperature(chatState: ChatState): number {
  const { activeAgent, activeRound } = chatState;
  const defaultTemp = 0.7;

  if (activeAgent.temperature) {
    return activeAgent.temperature;
  }
  
  if (activeRound.creativityType === 'agent_default' || !activeRound.creativityNumber) {
    return defaultTemp;
  }

  return activeRound.creativityNumber || defaultTemp;
}

function addOnFinishHandler(chatState: ChatState, onComplete?: any) {
  return (result: any) => {
    if (onComplete) {
      onComplete(chatState, result);
    }
  };
};

async function getLLMParams(chatState: ChatState, onComplete?: any) {
  // Debug logging for moderator verbatim messages
  if (chatState.progress?.active?.agent?.mode === 'moderator') {
    console.log('[LLM.getLLMParams] Moderator mode detected:', {
      agentId: chatState.progress.active.agent.id,
      activeAgentName: chatState.activeAgent?.name,
      hasVerbatimMessage: !!chatState.moderatorVerbatimMessage,
      verbatimLength: chatState.moderatorVerbatimMessage?.length,
      verbatimPreview: chatState.moderatorVerbatimMessage?.substring(0, 100)
    });
  }

  const model = ModelService.getLLMModel(chatState);
  const agentPrompt = await PromptService.getAgentPrompt(chatState, chatState.activeAgent);
  let uiMessages = MessageUtils.buildLlmMessages(chatState) as any[];

  let instructionsPrompt = '';

  if (uiMessages.length > 0 && uiMessages[uiMessages.length - 1].role === 'user') {
    instructionsPrompt = await PromptService.getInstructionsPrompt(chatState);
    let newMessageContent = instructionsPrompt;
    const lastMessageContent = String(uiMessages[uiMessages.length - 1].parts?.find((p: any) => p?.type === 'text')?.text ?? '');

    if (lastMessageContent !== CHAT_USER_CONTINUE) {
      newMessageContent += `\n\n${lastMessageContent}`;
    }
    uiMessages = [
      ...uiMessages.slice(0, uiMessages.length - 1),
      {
        ...uiMessages[uiMessages.length - 1],
        parts: [{ type: 'text', text: newMessageContent }],
      },
    ];
  }

  // Convert UI messages to model format while preserving <AGENT> tags
  const messages = convertUIMessagesToModelMessages(uiMessages);

  const tools = await ToolsService.addToolParams(chatState);
  
  // Determine tool choice based on memory requirements and round type
  let toolChoice: 'auto' | 'required' | undefined = undefined;
  if (tools) {
    // Always use 'auto' to ensure text responses are provided
    // The model should provide dialogue text along with memory tool calls
    // 'required' forces tool usage but skips text responses, violating core requirements
    toolChoice = 'auto';
    console.log(`[MEMORY] Set toolChoice to '${toolChoice}' with ${Object.keys(tools).length} tools available`);
  }
  
  const baseParams: LLMParams = {
    model,
    system: agentPrompt,
    messages: messages,
    temperature: getTemperature(chatState),
    tools: tools,
    toolChoice: toolChoice,
    maxRetries: 1, // Reduced from SDK default of 2 since we have adapter-level retry logic
    maxToolRoundtrips: 5, // Allow up to 5 tool roundtrips per conversation turn
  };

  // Store the actual prompts used in ChatState meta for accurate metadata
  if (!chatState.meta) {
    chatState.meta = {};
  }
  if (!chatState.meta.prompts) {
    chatState.meta.prompts = { system: '', instructions: '' };
  }

  // Store actual system prompt
  chatState.meta.prompts.system = agentPrompt;
  if (!chatState.meta.prompts.instructions && instructionsPrompt) {
    chatState.meta.prompts.instructions = instructionsPrompt;
  }

  if (chatState.chat.generationMode === 'stream') {
    baseParams.experimental_transform = smoothStream();
    baseParams.onFinish = addOnFinishHandler(chatState, onComplete);
    // Encourage a post-tool assistant message. If multiple memory ops are expected,
    // allow exactly that many steps plus one for the assistant text.
    if (tools) {
      const expected = (chatState.meta as any)?.expectedToolCount;
      if (typeof expected === 'number' && expected >= 1) {
        // add one for the assistant text
        (baseParams as any).stopWhen = stepCountIs(expected + 1);
        console.log(`[MEMORY] Set stopWhen to ${expected + 1} steps (${expected} tools + 1 text)`);
      } else {
        // Fallback to a simple two-step allowance if counts are missing
        (baseParams as any).stopWhen = stepCountIs(2);
        console.log(`[MEMORY] Set stopWhen to 2 steps (fallback, expectedToolCount: ${expected})`);
      }
    }
  }

  return baseParams;
}

interface ModeratorTextOptions {
  expectJson?: boolean;
  userPrompt?: string;
  tools?: Record<string, any>;
}

interface GenericTextOptions {
  systemPrompt?: string;
  userPrompt: string;
  expectJson?: boolean;
  includeHistory?: boolean;
}

async function generateTextForModerator<T = any>(
  chatState: ChatState,
  moderatorAgent: any,
  options: ModeratorTextOptions = {}
): Promise<{ success: boolean; text?: string; data?: T; error?: string }> {
  try {
    // Create a temporary chat state for the moderator
    const moderatorChatState: ChatState = {
      ...chatState,
      activeAgent: moderatorAgent
    };
    
    // Use the existing service methods to get model and build messages
    const model = ModelService.getLLMModel(moderatorChatState);
    const agentPrompt = await PromptService.getAgentPrompt(moderatorChatState, moderatorAgent);
    
    // If there's a verbatim message, we don't need message history (saves tokens)
    let uiMessages: any[] = [];
    if (chatState.moderatorVerbatimMessage) {
      uiMessages = [];
    } else {
      uiMessages = MessageUtils.buildLlmMessagesForModerator(moderatorChatState) as any[];
      }
    
    // Handle the user prompt if provided
    if (options.userPrompt) {
      if (uiMessages.length > 0 && uiMessages[uiMessages.length - 1].role === 'user') {
        // Append to existing user message to avoid consecutive user messages
        const lastText = String(uiMessages[uiMessages.length - 1].parts?.find((p: any) => p?.type === 'text')?.text ?? '');
        uiMessages = [...uiMessages];
        uiMessages[uiMessages.length - 1] = { ...uiMessages[uiMessages.length - 1], parts: [{ type: 'text', text: lastText + '\n\n' + options.userPrompt }] };
      } else {
        // Add as new user message
        uiMessages = [...uiMessages, { role: 'user' as const, parts: [{ type: 'text', text: options.userPrompt }] }];
      }
    }

    // Store the actual prompts used in ChatState meta for accurate metadata (moderator case)
    if (!chatState.meta) {
      chatState.meta = {};
    }
    if (!chatState.meta.prompts) {
      chatState.meta.prompts = { system: '', instructions: '' };
    }

    // For moderator, store the actual system prompt used
    chatState.meta.prompts.system = agentPrompt;

    // For moderator instructions:
    // - If verbatim, use the original moderator prompt that was stored
    // - If regular moderator, store the constructed user message or moderator prompt
    if (options.userPrompt) {
      // If a user prompt was provided directly (e.g., for round completion check)
      chatState.meta.prompts.instructions = options.userPrompt;
    }

    // Make a direct, non-streaming call to the LLM
    const result = await generateText({
      model,
      system: agentPrompt,
      messages: convertUIMessagesToModelMessages(uiMessages),
      temperature: getTemperature(moderatorChatState),
      tools: options.tools,
      maxRetries: 1, // Consistent with main LLM params
    });
    
    const text = result.text || '';
    
    // Check for tool calls first (preferred method)
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0] as any;
      // AI SDK v5 structure: toolCall.input contains the parsed arguments
      if (toolCall.input) {
        return { success: true, text, data: toolCall.input as T };
      }
    }
    
    // Fallback to JSON parsing for backward compatibility
    if (options.expectJson) {
      if (!text || text.trim() === '') {
        console.warn('[LLMService] Empty response from moderator, returning default');
        return { success: false, text: '', error: 'Empty response from moderator' };
      }
      
      try {
        // Strip markdown code block formatting and agent tags if present
        let jsonText = text.trim();
        const codeBlockMatch = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1].trim();
        }
        
        // Strip agent tags from the beginning if present
        const agentTagMatch = jsonText.match(/^<AGENT>.*?<\/AGENT>\s*([\s\S]*)$/);
        if (agentTagMatch) {
          jsonText = agentTagMatch[1].trim();
        }

        // Guard: only attempt JSON parsing if the text plausibly looks like JSON
        const firstChar = jsonText[0];
        if (firstChar !== '{' && firstChar !== '[') {
          // Not JSON-shaped; let callers fall back to text parsing without treating this as an error
          return { success: true, text };
        }
        
        const data = JSON.parse(jsonText) as T;
        return { success: true, text, data };
      } catch (parseError) {
        // Avoid noisy server error logs for benign JSON parse fallbacks.
        // Log at debug level with a short preview and let upstream fallback handle plain-text parsing.
        try {
          const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
          logDebug('LLMService', 'Moderator JSON parse failed; falling back to text parsing', { preview });
        } catch {}
        logError('LLMService: parsing moderator JSON response', parseError);
        return { success: true, text };
      }
    }
    
    return { success: true, text };
  } catch (error) {
    logError('LLMService: generateTextForModerator', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function generateTextWithAI<T = any>(
  chatState: ChatState,
  options: GenericTextOptions
): Promise<{ success: boolean; text?: string; data?: T; error?: string }> {
  try {
    // Build messages array
    let uiMessages: any[] = [];
    
    // Optionally include chat history
    if (options.includeHistory !== false) {
      uiMessages = MessageUtils.buildLlmMessages(chatState) as any[];
    }
    
    // Add the user prompt
    if (uiMessages.length > 0 && uiMessages[uiMessages.length - 1].role === 'user') {
      // Append to existing user message to avoid consecutive user messages
      const lastText = String(uiMessages[uiMessages.length - 1].parts?.find((p: any) => p?.type === 'text')?.text ?? '');
      uiMessages = [...uiMessages];
      uiMessages[uiMessages.length - 1] = { ...uiMessages[uiMessages.length - 1], parts: [{ type: 'text', text: lastText + '\n\n' + options.userPrompt }] };
    } else {
      // Add as new user message
      uiMessages = [...uiMessages, { role: 'user' as const, parts: [{ type: 'text', text: options.userPrompt }] }];
    }
    
    // Get model from chatState (using default config, not agent-specific)
    const model = ModelService.getLLMModel(chatState);
    
    // Use provided system prompt or a generic one
    const systemPrompt = options.systemPrompt || 
      'You are a helpful AI assistant that generates clear, contextual instructions for dialogue participants.';
    
    // Make a direct, non-streaming call to the LLM
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: convertUIMessagesToModelMessages(uiMessages),
      temperature: 0.7, // Use a neutral temperature
      maxRetries: 1, // Consistent with main LLM params
    });
    
    const text = result.text || '';
    
    // Handle JSON parsing if expected
    if (options.expectJson) {
      try {
        let jsonText = text.trim();
        const codeBlockMatch = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1].trim();
        }
        
        const data = JSON.parse(jsonText) as T;
        return { success: true, text, data };
      } catch (parseError) {
        logError('LLMService: Error parsing AI JSON response', parseError);
        return { success: false, text, error: 'Failed to parse JSON response' };
      }
    }
    
    return { success: true, text };
  } catch (error) {
    logError('LLMService: generateTextWithAI', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export const LLMService = {
  getLLMParams,
  getTemperature,
  generateTextForModerator,
  generateTextWithAI,
}; 