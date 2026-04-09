import { z } from 'zod';
import { tool } from 'ai';
import { ChatState } from '@/lib/chat/types';
import { ExtractDataService } from './extractdata';
import { MemoryService } from './memory';
/**
 * Service for managing AI tools and tool-related operations
 */
export const ToolsService = {

  async addToolParams(chatState: ChatState) {
    const {activeRound: round, progress} = chatState;

    let hasTools = false;
    const tools: Record<string, any> = {};
    let expectedCount = 0;
    
    try {
    
    if (round.showPrompts && progress.active.round.isComplete) {
      tools.savePromptSuggestions = tool({
        description: 'Suggest prompts for the user to best continue the conversation',
        inputSchema: z.object({
          suggestions: z.array(z.string()).describe('Array of suggested prompts for the user'),
        }),
        execute: async ({ suggestions }) => {
          return { promptSuggestions: suggestions };
        },
      });
      
      hasTools = true;
      // Count prompt suggestions as one potential tool call
      expectedCount += 1;
    }

    // Memory creation tool - available when memories are configured to be memorized in this round
    if (MemoryService.shouldEnableMemoryCreation(chatState)) {
      // Get memory configurations that can be created (respects privacy and existence checks)
      const creatableMemories = await MemoryService.getCreatableMemories(chatState);

      console.log(`[MEMORY] Added createMemory tool (${creatableMemories.length} memories available)`);
      
      // Increment expected tool count by number of creatable memories
      expectedCount += (creatableMemories.length || 0);

      // Only create the tool if there are memories that can be created
      if (creatableMemories.length > 0) {
        tools.createMemory = tool({
          description: `Create a memory entry. Available memories for this round: ${creatableMemories.map((m: any) => `"${m.name}" - ${m.memorizeInstructions}`).join(', ')}`,
        inputSchema: z.object({
          memoryName: z.string().describe('The name of the memory to create (must match configured memory names)'),
          content: z.string().describe('The content to store in this memory'),
        }),
        execute: async ({ memoryName, content }) => {
          
          // Find the memory configuration to get the ID
          const memories = (chatState.config as any)?.memorySettings?.memories || [];
          const memoryConfig = memories.find((memory: any) => 
            memory.memorizeRound === chatState.activeRound.id && memory.name === memoryName
          );
          
          if (!memoryConfig) {
            throw new Error(`No memory configuration found for "${memoryName}" in this round`);
          }
          
          // Return the memory operation details for processing in onComplete()
          console.log(`[MEMORY] Tool executed: createMemory "${memoryName}"`);
          return { 
            success: true, 
            memoryOperation: {
              type: 'create',
              memoryName,
              memoryConfigId: memoryConfig.id,
              content
            }
          };
        },
        });
        
        hasTools = true;
      }
    }

    // Memory update tool - available when memories are configured to be updated in this round  
    if (MemoryService.shouldEnableMemoryUpdates(chatState)) {
      // Get memory configurations that can be updated (respects privacy and existence checks)
      const updatableMemories = await MemoryService.getUpdatableMemories(chatState);

      console.log(`[TEMP] Adding updateMemory tool for ${updatableMemories.length} updatable memory configs in round ${round.id} for agent ${chatState.activeAgent.id}`);
      
      // Increment expected tool count by number of updatable memories
      expectedCount += (updatableMemories.length || 0);

      // Only create the tool if there are memories that can be updated
      if (updatableMemories.length > 0) {
        tools.updateMemory = tool({
          description: `Update an existing memory. Available memories for update: ${updatableMemories.map((m: any) => `"${m.name}" - ${m.updateInstructions || 'Update as needed'}`).join(', ')}. Only update if the conditions are met.`,
        inputSchema: z.object({
          memoryName: z.string().describe('The name of the memory to update'),
          newContent: z.string().describe('The new content for this memory'),
        }),
        execute: async ({ memoryName, newContent }) => {
          
          // Find the memory configuration to get the ID
          const memories = (chatState.config as any)?.memorySettings?.memories || [];
          const memoryConfig = memories.find((memory: any) => memory.name === memoryName);
          
          if (!memoryConfig) {
            throw new Error(`No memory configuration found for "${memoryName}"`);
          }
          
          // Return the memory operation details for processing in onComplete()
          console.log(`[MEMORY] Tool executed: updateMemory "${memoryName}"`);
          return { 
            success: true, 
            memoryOperation: {
              type: 'update',
              memoryName,
              memoryConfigId: memoryConfig.id,
              content: newContent
            }
          };
        },
        });
        
        hasTools = true;
      }
    }
    // Persist the expected tool count once at the end
    try {
      (chatState.meta ||= {} as any);
      (chatState.meta as any).expectedToolCount = expectedCount;
    } catch {}

    return hasTools ? tools : undefined;
    
    } catch (error) {
      console.error('[ToolsService] Error in addToolParams:', error);
      console.error('[ToolsService] Error occurred for agent:', chatState.activeAgent?.id);
      console.error('[ToolsService] Error occurred in round:', round?.id);
      throw error; // Re-throw to surface the actual error instead of masking as overload
    }
  },

  /**
   * Get tools for a specific round and progress state
   * @param round The round configuration
   * @param progress The current progress state
   * @returns The tools to include in the LLM request
   */
  getTools(round: any, progress: any) {
    if (!round) return undefined;
    
    const tools: Record<string, any> = {};
    let hasTools = false;
    
    // Prompt suggestions tool - for when the round is complete
    if (round.showPrompts && progress.isComplete) {
      tools.savePromptSuggestions = tool({
        description: 'Suggest prompts for the user to best continue the debate',
        inputSchema: z.object({
          suggestions: z.array(z.string()).describe('Array of suggested prompts for the user'),
        }),
        execute: async ({ suggestions }) => {
          return { promptSuggestions: suggestions };
        },
      });
      
      hasTools = true;
    }

    // Data extraction tool for structured data
    if (round.dataTool && round.dataTool.parameters && round.dataTool.parameters.length > 0) {
      const schema = ExtractDataService.buildParameterSchema(round.dataTool.parameters);
      
      tools.extractData = tool({
        description: round.dataTool.instructions || 'Extract structured data from the conversation',
        inputSchema: schema,
        execute: async (params) => {
          // The actual saving happens elsewhere, this just returns the extracted data
          return params;
        },
      });
      
      hasTools = true;
    }
    return hasTools ? tools : undefined;
  },

  /**
   * Extract next agent information from structured format in response
   * @param content The text response from the LLM
   * @returns The extracted next agent ID and cleaned content
   */
  extractNextAgentInfo(content: string) {
    // Simplified regex to match just the agent ID
    const regex = /\[NEXT_AGENT:([^\]]+)\]/;
    const match = content.match(regex);
    
    if (match) {
      return {
        nextAgentId: match[1],
        cleanedContent: content.replace(regex, '').trim()
      };
    }
    
    return {
      nextAgentId: null,
      cleanedContent: content
    };
  },

  /**
   * Process tool calls from the model's response
   * @param toolInvocations The tool invocations from the LLM response
   * @param availableTools The tools available for execution
   * @returns The processed tool calls with results
   */
  processToolCalls(toolInvocations: any[], availableTools: Record<string, any>) {
    if (!toolInvocations || !toolInvocations.length) {
      return [];
    }
    
    return toolInvocations.map(invocation => {
      const { toolName, args } = invocation;
      const tool = availableTools[toolName];
      
      if (!tool) {
        console.warn(`Tool '${toolName}' was called but is not available`);
        return {
          toolName,
          result: { error: `Tool '${toolName}' not found` }
        };
      }
      
      try {
        // Execute the tool with the provided arguments
        const result = tool.execute(args);
        return {
          toolName,
          result
        };
      } catch (error) {
        console.error(`Error executing tool '${toolName}':`, error);
        return {
          toolName,
          result: { error: `Tool execution failed: ${error}` }
        };
      }
    });
  },
}; 