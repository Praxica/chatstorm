import { generateText } from 'ai';
import { ChatRoundSessionService } from './sessions';
import { Message, ChatState } from '../types';
import { ChatAgent } from '@prisma/client';
import type { ChatRound } from '@/lib/schemas/prisma-typed';
import { getModelProvider } from '@/lib/utils/models';
import {
  DEFAULT_CHAT_RETENTION_SETTINGS,
  DEFAULT_ROUND_RETENTION_SETTINGS,
  type ChatRetentionSettings,
  type RoundRetentionSettings,
  type SummaryData,
  type DialogueCompressionData
} from './retention-types';

/** Extract plain text from a ChatMessage's parts array */
function textFromParts(msg: Message): string {
  return (msg.parts ?? [])
    .filter(p => p.type === 'text' && p.text)
    .map(p => p.text!)
    .join('');
}

//--------------------------------------------------------------------------------
// Settings Interfaces and Defaults
//--------------------------------------------------------------------------------

//--------------------------------------------------------------------------------
// Retention Service
//--------------------------------------------------------------------------------

export class RetentionService {
  
  /**
   * Groups messages by dialogue annotations for dialogue-specific summarization
   */
  static groupMessagesByDialogue(messages: Message[]): {
    general: Message[];
    dialogues: { [dialogueKey: string]: { messages: Message[]; participants: [string, string] } };
  } {
    const general: Message[] = [];
    const dialogues: { [dialogueKey: string]: { messages: Message[]; participants: [string, string] } } = {};
    
    for (const message of messages) {
      const dialoguePart = Array.isArray((message as any).parts)
        ? (message as any).parts.find((p: any) => p?.type === 'data-dialogue')?.data
        : undefined;
      if (dialoguePart && dialoguePart.senderId && dialoguePart.receiverId) {
        const senderId = dialoguePart.senderId;
        const receiverId = dialoguePart.receiverId;
        const dialogueKey = `${senderId}||${receiverId}`;
        
        if (!dialogues[dialogueKey]) {
          dialogues[dialogueKey] = {
            messages: [],
            participants: [senderId, receiverId]
          };
        }
        dialogues[dialogueKey].messages.push(message);
      } else {
        general.push(message);
      }
    }
    
    return { general, dialogues };
  }
  
  /**
   * Generates a summary for a specific set of messages using the existing logic
   */
  static async generateSummaryForMessages(
    messages: Message[],
    round: ChatRound,
    contextLabel: string = 'conversation'
  ): Promise<string> {
    const roundSettings = this.getRoundRetentionSettings((round as any).retentionSettings);
    const summarizerSettings = roundSettings.summarizer!;

    // ChatMessage only has 'user' | 'assistant' roles; system messages aren't in this array.
    if (messages.length === 0) {
      return '';
    }


    const lengthGoal = summarizerSettings.output.type === 'percentage'
      ? `in about ${summarizerSettings.output.value}% of the original length`
      : `in about ${summarizerSettings.output.value} words`;

    const agents = (round as any).participants as ChatAgent[] || [];
    const participantNames = agents.length > 0
      ? agents.map(agent => agent.name).join(', ')
      : 'Unknown participants';

    const chatHistory = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: textFromParts(msg).replace(/<SELF>[\s\S]*?<\/SELF>/g, '').trim()
    }));
    
    const customPrompt = summarizerSettings.prompt;

    const systemPrompt = `You are a conversation summarizer. You excel at extracting the most vital information from a ${contextLabel} and concisely summarizing without sacrificing critical details. Your summary will be used as context for future AI agents continuing this conversation.

When summarizing the messages in this ${contextLabel}, focus on information that would be MAXIMALLY RELEVANT for agents to:
- Understand key decisions made
- Know important context and insights discovered  
- See how the conversation evolved
- Retain only the most important details
- Understand which agents were responsible for key insights and decisions
- Continue effectively from where this left off

Provide only the compressed summary, no additional formatting or explanation.`;
      
    const finalUserMessage = `Please provide a clear and concise summary of the ${contextLabel} above by following your instructions.

Original ${contextLabel} had ${messages.length} messages. Compress to a summary of ${lengthGoal}.

Round type: ${round.type}
Participants: ${participantNames}
${customPrompt ? `\nAdditional Instructions: ${customPrompt}` : ''}`;

    const model = getModelProvider('grok-2');
    if (!model) {
      throw new Error('Model provider grok-2 not available');
    }

    
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [...chatHistory, {
        role: 'user',
        content: finalUserMessage
      }],
      temperature: 0.3
    });

    const summary = result.text.trim();
    return summary;
  }

  /**
   * Gets the chat-level retention settings, merging them with defaults.
   */
  static getChatRetentionSettings(settings: any): ChatRetentionSettings {
    return {
      ...DEFAULT_CHAT_RETENTION_SETTINGS,
      ...(settings || {}),
    };
  }

  /**
   * Gets the round-level retention settings, merging them with defaults.
   */
  static getRoundRetentionSettings(settings: any): RoundRetentionSettings {
    const mergedSettings = {
      ...DEFAULT_ROUND_RETENTION_SETTINGS,
      ...(settings || {}),
      summarizer: {
        ...DEFAULT_ROUND_RETENTION_SETTINGS.summarizer,
        ...((settings as RoundRetentionSettings)?.summarizer || {}),
      },
    };
    return mergedSettings as RoundRetentionSettings;
  }

  /**
   * Called when a round is complete. It decides if a summary should be generated
   * and triggers it as a background task.
   * A summary is generated for EVERY completed round, regardless of 'ignore' settings,
   * to allow for future changes in settings.
   */
  static async handleRoundCompletion(chatState: ChatState, finalMessage?: Message): Promise<void> {
    const { currentSessionId, messages, activeRound } = chatState;


    if (!currentSessionId || !activeRound) {
      console.error('Cannot handle round completion: missing currentSessionId or activeRound from state.');
      return;
    }
    
    const allMessages = finalMessage ? [...messages, finalMessage] : messages;
    const roundMessages = allMessages.filter(msg => (msg as any)?.metadata?.roundId === activeRound.id);
    
    // Fire-and-forget the summary generation
    this.generateSummaryForSession(
      currentSessionId,
      roundMessages,
      activeRound
    ).catch(error => {
      console.error(`Error during background summary generation for session ${currentSessionId}:`, error);
    });
  }

  /**
   * Generates a summary for the messages of a given round session.
   * This is always done, even if the round is set to be ignored later,
   * to provide flexibility if settings are changed.
   * Now supports dialogue-specific summaries for dialogue privacy.
   */
  static async generateSummaryForSession(
    sessionId: string,
    messages: Message[],
    round: ChatRound
  ): Promise<void> {
    try {
      // ChatMessage only has 'user' | 'assistant' roles; no system messages to filter.
      if (messages.length === 0) {
        return;
      }

      let compressionData: DialogueCompressionData | SummaryData;

      // Fork based on round type
      if (round.type === 'dialogue') {
        // Handle dialogue rounds with dialogue-specific summaries
        const { general, dialogues } = this.groupMessagesByDialogue(messages);
        
        const dialogueData: DialogueCompressionData = {
          summarizedAt: new Date()
        };

        // Generate dialogue-specific summaries
        if (Object.keys(dialogues).length > 0) {
          dialogueData.dialogues = {};
          
          // Process each dialogue separately
          for (const [dialogueKey, dialogueInfo] of Object.entries(dialogues)) {
            const dialogueSummary = await this.generateSummaryForMessages(
              dialogueInfo.messages,
              round,
              'private dialogue'
            );
            
            dialogueData.dialogues[dialogueKey] = {
              summary: dialogueSummary,
              originalMessageCount: dialogueInfo.messages.length,
              participants: dialogueInfo.participants
            };
          }
        }

        // Generate general summary for non-dialogue messages if any exist
        if (general.length > 0) {
          const generalSummary = await this.generateSummaryForMessages(general, round, 'conversation');
          dialogueData.summary = generalSummary;
          dialogueData.originalMessageCount = general.length;
        }

        compressionData = dialogueData;
      } else {
        // Handle non-dialogue rounds with standard summarization
        const summary = await this.generateSummaryForMessages(messages, round, 'conversation');

        compressionData = {
          summary,
          originalMessageCount: messages.length,
          summarizedAt: new Date()
        };
      }

      
      await ChatRoundSessionService.setCompression(sessionId, compressionData, 'v2');
      
    } catch (error) {
      console.error(`Failed to generate summary for session ${sessionId}:`, error);
    }
  }
} 