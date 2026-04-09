import { prisma } from '@/lib/prisma';
import { ChatState } from '../types';
import { logError } from '@/lib/utils/error';
import type { MemorySettings } from '@/lib/schemas/prisma-typed';

type Memory = NonNullable<MemorySettings['memories']>[number];

/**
 * MemoryService - Handles memory operations for chat sessions
 * Integrates with the tool system for LLM-driven memory creation/updates
 */
export class MemoryService {


  /**
   * Get memories that should be injected into prompts for the current round/agent
   */
  static async getMemoriesForPrompt(chatState: ChatState): Promise<string[]> {

    try {
      const config = chatState.config;
      const currentRoundId = chatState.activeRound.id;

      // Use moderator agent ID when in moderator mode, otherwise use active agent
      let currentAgentId: string;
      let agentName: string;

      if (chatState.progress.active.agent.mode === 'moderator') {
        // In moderator mode, use the moderator agent ID
        const round = chatState.activeRound as any;
        const moderatorId = round.lengthModerator || round.participantModerator;
        if (moderatorId) {
          const moderatorAgent = chatState.agents.find(a => a.id === moderatorId);
          currentAgentId = moderatorId;
          agentName = moderatorAgent?.name || 'Moderator';
        } else {
          // Fallback to active agent if no moderator found
          currentAgentId = chatState.activeAgent.id;
          agentName = chatState.activeAgent.name;
        }
      } else {
        currentAgentId = chatState.activeAgent.id;
        agentName = chatState.activeAgent.name;
      }

      console.log(`[MEMORY] getMemoriesForPrompt called for agent ${currentAgentId} in round ${currentRoundId} (mode: ${chatState.progress.active.agent.mode})`);


      console.log(`[MEMORY] Loading memories for agent ${agentName} (${currentAgentId}) in round ${currentRoundId}`);

      if (!config?.memorySettings?.memories) {
        console.log(`[MEMORY] No memory configuration found for agent ${agentName}`);
        return [];
      }

      const memories = config?.memorySettings?.memories as Memory[];
      console.log(`[MEMORY] Found ${memories.length} total memory configurations`);


      // Find memories that should be remembered in this round
      const relevantMemories = memories.filter(memory => {
        // Check if this memory should be remembered in this round
        const shouldRemember = memory.rememberWhen === 'every_round' ||
          (memory.rememberWhen === 'specific_rounds' &&
           memory.rememberRounds?.some(r => r.roundId === currentRoundId));

        return shouldRemember;
        // Note: We'll filter by agent access when querying the database
      });

      console.log(`[MEMORY] Found ${relevantMemories.length} memories configured for this round`);

      // Fetch actual memory content from database
      const memoryContents: string[] = [];

      for (const memory of relevantMemories) {
        try {
          // Build the where clause based on who should remember
          const whereClause: any = {
            chatId: chatState.chat.id,
            memoryConfigId: memory.id,
            isActive: true
          };

          // CRITICAL: Filter by agent ID if memory is restricted to original agent
          if (memory.rememberWho === 'original_agent') {
            whereClause.createdByAgentId = currentAgentId;
            console.log(`[MEMORY] Memory "${memory.name}" restricted to original agent - filtering by creator ${currentAgentId}`);
          } else {
            console.log(`[MEMORY] Memory "${memory.name}" accessible to all agents`);
          }

          // Get the latest active memory content for this chat session
          const memoryRecord = await prisma.chatMemory.findFirst({
            where: whereClause,
            orderBy: {
              version: 'desc'
            }
          });

          if (memoryRecord) {
            console.log(`[MEMORY] Found memory "${memory.name}" (v${memoryRecord.version}) for agent ${agentName}`);
            console.log(`[MEMORY] Content: ${memoryRecord.content}`);

            // Get remember instructions for this memory
            let instructions = '';
            if (memory.rememberWhen === 'specific_rounds' && memory.rememberRounds) {
              const roundConfig = memory.rememberRounds.find(r => r.roundId === currentRoundId);
              instructions = roundConfig?.instructions || '';
            }

            // Fall back to default instructions if no round-specific ones
            if (!instructions) {
              instructions = memory.rememberInstructions || '';
            }

            // Format memory with instructions if they exist
            let formattedMemory = `[MEMORY: ${memory.name}]`;
            if (instructions.trim()) {
              formattedMemory += `\nInstructions: ${instructions}`;
            }
            formattedMemory += `\n${memoryRecord.content}`;
            memoryContents.push(formattedMemory);
          } else {
            console.log(`[MEMORY] No memory content found for "${memory.name}" for agent ${agentName}`);
          }
        } catch (error) {
          console.log(`[MEMORY] Error fetching memory content for "${memory.name}": ${error}`);
          logError(`MemoryService: Error fetching memory content for ${memory.name}`, error);
        }
      }

      console.log(`[MEMORY] Loaded ${memoryContents.length} memories into prompt for agent ${agentName}`, {
        memoryContentLengths: memoryContents.map(m => m.length),
        totalChars: memoryContents.reduce((sum, m) => sum + m.length, 0)
      });
      return memoryContents;
      
    } catch (error) {
      logError('MemoryService: Error getting memories for prompt', error);
      return [];
    }
  }

  /**
   * Check if the current round should have memory creation capabilities
   */
  static shouldEnableMemoryCreation(chatState: ChatState): boolean {
    const config = chatState.config;
    if (!config?.memorySettings?.memories) return false;

    const memories = config?.memorySettings?.memories as Memory[];
    const currentRoundId = chatState.activeRound.id;
    
    // Check if any memory is configured to be memorized in this round
    const hasMemoryCreation = memories.some(memory => 
      memory.memorizeRound === currentRoundId
    );

    return hasMemoryCreation;
  }

  /**
   * Check if the current round should have memory update capabilities
   */
  static shouldEnableMemoryUpdates(chatState: ChatState): boolean {
    const config = chatState.config;
    if (!config?.memorySettings?.memories) return false;

    const memories = config?.memorySettings?.memories as Memory[];
    const currentRoundId = chatState.activeRound.id;
    
    // Check if any memory is configured to be updated in this round
    const hasMemoryUpdates = memories.some(memory => 
      memory.updateEnabled && (
        memory.updateWhen === 'every_round' ||
        (memory.updateWhen === 'specific_rounds' && 
         memory.updateRounds?.some(r => r.roundId === currentRoundId))
      )
    );

    return hasMemoryUpdates;
  }

  /**
   * Create a new memory entry (called from tool execution)
   */
  static async createMemory(
    chatState: ChatState,
    memoryName: string,
    memoryContent: string,
    messageId?: string,
    memoryConfigId?: string
  ): Promise<{ success: boolean; error?: string; memoryId?: string }> {
    
    try {
      const config = chatState.config;
      if (!config?.memorySettings?.memories) {
        return { success: false, error: 'No memory configuration found' };
      }

      // Use provided memoryConfigId if available, otherwise fall back to name search
      const currentRoundId = chatState.activeRound.id;
      let memoryConfig;
      if (memoryConfigId) {
        const memories = config?.memorySettings?.memories as Memory[];
        memoryConfig = memories.find(memory => memory.id === memoryConfigId);
      } else {
        // Fallback to name-based search for backward compatibility
        const memories = config?.memorySettings?.memories as Memory[];
        memoryConfig = memories.find(memory => 
          memory.memorizeRound === currentRoundId && memory.name === memoryName
        );
      }

      if (!memoryConfig) {
        return { success: false, error: `No memory configuration found for "${memoryName}"` };
      }

      // Create the memory record
      const memoryRecord = await prisma.chatMemory.create({
        data: {
          chatId: chatState.chat.id,
          memoryConfigId: memoryConfig.id,
          roundId: currentRoundId,
          messageId: messageId!,  // Message ID is always provided from onComplete
          content: memoryContent,
          createdByAgentId: chatState.activeAgent.id,
          version: 1,
          isActive: true
        }
      });

      // Log memory creation
      console.log(`[MEMORY] ${chatState.activeAgent.name} created memory "${memoryName}" (ID: ${memoryRecord.id})`);
      console.log(`[MEMORY] Content: ${memoryContent}`);

      return { success: true, memoryId: memoryRecord.id };

    } catch (error) {
      logError('MemoryService: Error creating memory', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating memory'
      };
    }
  }

  /**
   * Update an existing memory entry (called from tool execution)
   */
  static async updateMemory(
    chatState: ChatState,
    memoryName: string,
    newContent: string,
    messageId?: string,
    memoryConfigId?: string
  ): Promise<{ success: boolean; error?: string }> {
    
    try {
      const config = chatState.config;
      if (!config?.memorySettings?.memories) {
        return { success: false, error: 'No memory configuration found' };
      }

      // Use provided memoryConfigId if available, otherwise fall back to name search
      let memoryConfig;
      if (memoryConfigId) {
        const memories = config?.memorySettings?.memories as Memory[];
        memoryConfig = memories.find(memory => memory.id === memoryConfigId);
      } else {
        // Fallback to name-based search for backward compatibility
        const memories = config?.memorySettings?.memories as Memory[];
        memoryConfig = memories.find(memory => memory.name === memoryName);
      }
      
      if (!memoryConfig) {
        return { success: false, error: `No memory configuration found for "${memoryName}"` };
      }

      // Find the current active memory
      const currentMemory = await prisma.chatMemory.findFirst({
        where: {
          chatId: chatState.chat.id,
          memoryConfigId: memoryConfig.id,
          isActive: true
        },
        orderBy: {
          version: 'desc'
        }
      });

      if (!currentMemory) {
        return { success: false, error: `No existing memory found for "${memoryName}"` };
      }

      // Deactivate the current memory
      await prisma.chatMemory.update({
        where: { id: currentMemory.id },
        data: { isActive: false }
      });

      // Create new version
      const newMemoryRecord = await prisma.chatMemory.create({
        data: {
          chatId: chatState.chat.id,
          memoryConfigId: memoryConfig.id,
          roundId: chatState.activeRound.id,
          messageId: messageId!,  // Message ID is always provided from onComplete
          content: newContent,
          createdByAgentId: chatState.activeAgent.id,
          version: currentMemory.version + 1,
          isActive: true
        }
      });

      // Log memory update
      console.log(`[MEMORY] ${chatState.activeAgent.name} updated memory "${memoryName}" (v${newMemoryRecord.version}, ID: ${newMemoryRecord.id})`);
      console.log(`[MEMORY] Content: ${newContent}`);

      return { success: true };

    } catch (error) {
      logError('MemoryService: Error updating memory', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error updating memory'
      };
    }
  }

  /**
   * Process memory operations from tool results after message completion
   * @param chatState The current chat state
   * @param result The result containing tool calls
   * @param messageId The saved message ID
   */
  static async processMessageResultMemories(
    chatState: ChatState,
    result: any,
    messageId: string
  ): Promise<void> {
    // Check all possible tool call arrays
    const allToolCalls = [
      ...(result?.toolCalls || []),
      ...(result?.staticToolCalls || []),
      ...(result?.dynamicToolCalls || [])
    ];

    // Also check the steps array for tool results
    const toolResultsFromSteps: any[] = [];
    if (result?.steps && Array.isArray(result.steps)) {
      for (const step of result.steps) {
        if (step?.content && Array.isArray(step.content)) {
          for (const contentItem of step.content) {
            if (contentItem?.type === 'tool-result' &&
                (contentItem?.toolName === 'createMemory' || contentItem?.toolName === 'updateMemory')) {
              toolResultsFromSteps.push(contentItem);
            }
          }
        }
      }
    }

    if (allToolCalls.length === 0 && toolResultsFromSteps.length === 0) {
      return;
    }

    console.log(`[MEMORY] Processing ${allToolCalls.length + toolResultsFromSteps.length} memory operations in onFinish`);

    let memoryOperationsProcessed = 0;

    // Process tool calls from top-level arrays
    for (const toolCall of allToolCalls) {
      if (toolCall.toolName === 'createMemory' || toolCall.toolName === 'updateMemory') {
        memoryOperationsProcessed++;
        try {

          // The AI SDK might structure this differently - let's extract from input and result
          const toolInput = toolCall.input;
          const toolResult = toolCall.result;
          
          
          // Check if we have memoryOperation in result, otherwise construct from input
          let memoryOperation = toolResult?.memoryOperation;
          
          if (!memoryOperation && toolInput) {
            // Fallback: construct operation from input
            if (toolCall.toolName === 'createMemory') {
              memoryOperation = {
                type: 'create',
                memoryName: toolInput.memoryName,
                content: toolInput.content
              };
            } else if (toolCall.toolName === 'updateMemory') {
              memoryOperation = {
                type: 'update', 
                memoryName: toolInput.memoryName,
                content: toolInput.newContent
              };
            }
          }
          
          if (memoryOperation) {
            
            if (memoryOperation.type === 'create') {
              await MemoryService.createMemory(
                chatState,
                memoryOperation.memoryName,
                memoryOperation.content,
                messageId,
                memoryOperation.memoryConfigId
              );
            } else if (memoryOperation.type === 'update') {
              await MemoryService.updateMemory(
                chatState,
                memoryOperation.memoryName,
                memoryOperation.content,
                messageId,
                memoryOperation.memoryConfigId
              );
            }
          } else {
            console.warn('[MemoryService] ⚠️ No memory operation found in tool result');
          }
        } catch (error) {
          console.error('[MemoryService] ❌ Error processing memory operation from tool result:', error);
          console.error('[MemoryService] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
        }
      } else {
      }
    }

    // Process tool results from steps array
    for (const toolResult of toolResultsFromSteps) {
      try {
        memoryOperationsProcessed++;
        const toolOutput = toolResult.output;

        // Extract memory operation from the tool result output
        let memoryOperation;
        if (toolOutput?.value?.memoryOperation) {
          memoryOperation = toolOutput.value.memoryOperation;
        } else if (toolOutput?.memoryOperation) {
          memoryOperation = toolOutput.memoryOperation;
        }

        if (memoryOperation) {

          if (memoryOperation.type === 'create') {
            await MemoryService.createMemory(
              chatState,
              memoryOperation.memoryName,
              memoryOperation.content,
              messageId,
              memoryOperation.memoryConfigId
            );
          } else if (memoryOperation.type === 'update') {
            await MemoryService.updateMemory(
              chatState,
              memoryOperation.memoryName,
              memoryOperation.content,
              messageId,
              memoryOperation.memoryConfigId
            );
          }
        } else {
          console.warn('[MemoryService] ⚠️ No memory operation found in step tool result');
        }
      } catch (error) {
        console.error('[MemoryService] ❌ Error processing memory operation from step result:', error);
        console.error('[MemoryService] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
      }
    }

    if (memoryOperationsProcessed > 0) {
      console.log(`[MEMORY] Successfully processed ${memoryOperationsProcessed} memory operations`);
    }
  }

  /**
   * Get memory configurations that can be created by the current agent in the current round
   * (respects privacy settings and checks if memories already exist)
   */
  static async getCreatableMemories(chatState: ChatState): Promise<any[]> {
    try {
      const config = chatState.config;
      const round = chatState.activeRound;
      const currentAgentId = chatState.activeAgent.id;

      if (!config?.memorySettings?.memories) {
        return [];
      }

      const memories = config?.memorySettings?.memories as Memory[];
      const memoriesForThisRound = memories.filter((memory: any) => 
        memory.memorizeRound === round.id
      );

      // Filter out memories that already exist (respecting privacy settings)
      const creatableMemories = [];
      for (const memory of memoriesForThisRound) {
        // Build where clause respecting who can remember this memory
        const whereClause: any = {
          chatId: chatState.chat.id,
          memoryConfigId: memory.id,
          isActive: true
        };
        
        // If memory is restricted to original agent, check if current agent created it
        if (memory.rememberWho === 'original_agent') {
          whereClause.createdByAgentId = currentAgentId;
        }
        
        const existingMemory = await prisma.chatMemory.findFirst({
          where: whereClause
        });
        
        if (!existingMemory) {
          creatableMemories.push(memory);
        }
      }

      return creatableMemories;
    } catch (error) {
      logError('MemoryService: Error getting creatable memories', error);
      return [];
    }
  }

  /**
   * Get memory configurations that can be updated by the current agent in the current round
   * (respects privacy settings and checks if memories exist and are accessible)
   */
  static async getUpdatableMemories(chatState: ChatState): Promise<any[]> {
    try {
      const config = chatState.config;
      const round = chatState.activeRound;
      const currentAgentId = chatState.activeAgent.id;

      if (!config?.memorySettings?.memories) {
        return [];
      }

      const memories = config?.memorySettings?.memories as Memory[];
      const updatableMemoryConfigs = memories.filter((memory: any) => 
        memory.updateEnabled && (
          memory.updateWhen === 'every_round' ||
          (memory.updateWhen === 'specific_rounds' && 
           memory.updateRounds?.some((r: any) => r.roundId === round.id))
        )
      );

      // Filter to only memories that exist and are accessible (respecting privacy settings)
      const updatableMemories = [];
      for (const memory of updatableMemoryConfigs) {
        // Build where clause respecting who can update this memory
        const whereClause: any = {
          chatId: chatState.chat.id,
          memoryConfigId: memory.id,
          isActive: true
        };
        
        // If memory update is restricted to original agent, check if current agent created it
        if (memory.updateWho === 'original_agent') {
          whereClause.createdByAgentId = currentAgentId;
        }
        
        const existingMemory = await prisma.chatMemory.findFirst({
          where: whereClause
        });
        
        if (existingMemory) {
          updatableMemories.push(memory);
        }
      }

      return updatableMemories;
    } catch (error) {
      logError('MemoryService: Error getting updatable memories', error);
      return [];
    }
  }
}