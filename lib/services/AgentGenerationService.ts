import { generateText, generateObject } from 'ai'
import { getUtilityModel } from '@/lib/utils/models'
import { z } from 'zod'
import { createAvatar } from '@dicebear/core'
import * as miniavs from '@dicebear/miniavs'
import * as bottts from '@dicebear/bottts'
import * as funEmoji from '@dicebear/fun-emoji'
import * as pixelArt from '@dicebear/pixel-art'
import { PromptService } from '@/lib/chat/services/prompts'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { type DepthLevel } from '@/types/config-round'
import { logError } from '../utils/error'

interface AgentBlueprint {
  name: string
  instructions: string
}

export type AgentStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface AgentProgress {
  name: string
  status: AgentStatus
  attempt: number
  maxAttempts: number
}

export interface GenerationProgress {
  total: number
  completed: number
  failed: number
  agentProgress: AgentProgress[]
}

interface GeneratedAgent {
  id: string
  name: string
  systemPrompt: string
  avatar: string
  isActive: boolean
  temperature: number
  role: string
  priority: string
}

interface GenerateAgentsParams {
  userId: string
  prompt: string
  count?: number // Optional when using AI_DECIDES
  lengthType: 'FIXED' | 'AI_DECIDES'
  creativity?: number
  depth?: DepthLevel
  projectIds?: string[]
  sessionId?: string // If provided, marks agents as dynamic
  messageHistory?: any[] // Optional message history for context-aware generation
}

interface GenerateSessionAgentsParams {
  chatRoundSessionId: string
  userId: string
  participantGenerationPrompt: string
  participantLength: number
  participantLengthType: 'FIXED' | 'AI_DECIDES'
  creativity?: number
  depth?: DepthLevel
  messageHistory?: any[] // Optional message history for context-aware generation
}

// In-memory storage for generation progress
declare global {
  // eslint-disable-next-line no-var
  var generationProgressMap: Map<string, GenerationProgress> | undefined
}

const getProgressMap = (): Map<string, GenerationProgress> => {
  if (!global.generationProgressMap) {
    global.generationProgressMap = new Map()
  }
  return global.generationProgressMap
}

export class AgentGenerationService {
  constructor() {
    // No cleanup interval for now
  }

  /**
   * Core agent generation method - used by both API and session generation
   */
  async generateAgents(params: GenerateAgentsParams): Promise<string> {
    const { userId, prompt, lengthType, creativity = 0.7, depth = 'medium', projectIds = [], sessionId, messageHistory } = params
    
    // Validate creativity is a valid number
    const validCreativity = (typeof creativity === 'number' && !isNaN(creativity)) ? creativity : 0.7
    
    // Determine count based on lengthType
    let count: number
    if (lengthType === 'FIXED') {
      if (!params.count) {
        throw new Error('Count is required when lengthType is FIXED')
      }
      count = params.count
    } else {
      // For AI_DECIDES, we'll let the AI determine the count via blueprints
      count = params.count || 10 // Use max as fallback, AI will determine actual count
    }

    // Generate unique ID for this generation process
    const generationId = randomUUID()
    
    // Initialize progress tracking
    const initialProgress: GenerationProgress = {
      total: 0, // Will be updated after blueprints are generated
      completed: 0,
      failed: 0,
      agentProgress: []
    }
    const progressMap = getProgressMap()
    progressMap.set(generationId, initialProgress)

    try {
      // Phase 1: Generate agent blueprints
      console.log('Phase 1: Generating agent blueprints...')
      console.log(`[MULTI-ROUND] Generating blueprints with message history: ${messageHistory ? `${messageHistory.length} messages` : 'none'}`)
      const blueprints = await this.generateAgentBlueprints(count, prompt, validCreativity, depth, lengthType, messageHistory)
      
      if (blueprints.length === 0) {
        progressMap.delete(generationId)
        throw new Error('Failed to generate agent blueprints')
      }

      console.log(`Generated ${blueprints.length} agent blueprints`)
      console.log(`[MULTI-ROUND] Parsed blueprints:`)
      blueprints.forEach((bp, i) => {
        console.log(`[MULTI-ROUND]   ${i + 1}. ${bp.name}: ${bp.instructions}`)
      })

      // Update progress with actual count from AI
      const currentProgress = progressMap.get(generationId)
      if (currentProgress) {
        currentProgress.total = blueprints.length
        currentProgress.agentProgress = blueprints.map(blueprint => ({
          name: blueprint.name,
          status: 'pending' as AgentStatus,
          attempt: 0,
          maxAttempts: 3
        }))
        progressMap.set(generationId, currentProgress)
      }

      // Phase 2: Generate agents in parallel (don't wait for completion)
      this.generateAgentsInParallel(blueprints, prompt, depth, generationId, userId, projectIds, sessionId)
        .catch(error => {
          console.error('Error in parallel agent generation:', error)
        })

      return generationId
    } catch (error) {
      progressMap.delete(generationId)
      throw error
    }
  }

  /**
   * Session-specific wrapper for dynamic agent generation
   */
  async generateSessionAgents(params: GenerateSessionAgentsParams): Promise<string> {
    console.log(`[MULTI-ROUND] generateSessionAgents() called for session ${params.chatRoundSessionId}`)
    console.log(`[MULTI-ROUND] Message history provided: ${params.messageHistory ? `${params.messageHistory.length} messages` : 'none'}`)
    
    return this.generateAgents({
      userId: params.userId,
      prompt: params.participantGenerationPrompt,
      count: params.participantLength,
      lengthType: params.participantLengthType,
      creativity: params.creativity,
      depth: params.depth,
      sessionId: params.chatRoundSessionId,
      messageHistory: params.messageHistory
    })
  }

  /**
   * Generate session agents and wait for completion
   * Returns the actual agents instead of just the generation ID
   */
  async generateSessionAgentsAndWait(params: GenerateSessionAgentsParams): Promise<any[]> {
    const generationId = await this.generateSessionAgents(params);
    const expectedCount = params.participantLength || 3;
    
    console.log(`Waiting for ${expectedCount} agents to be generated (${generationId})`);
    
    const maxWaitTime = 60000; // 60 seconds max
    const pollInterval = 2000;  // Check every 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const progress = await this.getProgress(generationId);
      if (progress && progress.completed >= expectedCount) {
        console.log(`Generation complete! Successfully created ${progress.completed}/${expectedCount} dynamic agents`);
        // Get the actual agents from the database
        const agents = await prisma.chatAgent.findMany({
          where: {
            chatRoundSessionId: params.chatRoundSessionId,
            isDynamic: true
          }
        });
        return agents;
      }

      const currentCompleted = progress?.completed || 0;
      console.log(`Still generating... ${currentCompleted}/${expectedCount} completed (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout - return whatever agents we have
    const agents = await prisma.chatAgent.findMany({
      where: {
        chatRoundSessionId: params.chatRoundSessionId,
        isDynamic: true
      }
    });
    
    if (agents.length > 0) {
      console.log(`Generation timeout but found ${agents.length}/${expectedCount} agents`);
      return agents;
    }

    throw new Error(`Agent generation timed out after ${maxWaitTime / 1000} seconds - expected ${expectedCount} agents`);
  }

  /**
   * Get generation progress
   */
  async getProgress(generationId: string): Promise<GenerationProgress | null> {
    const progressMap = getProgressMap()
    return progressMap.get(generationId) || null
  }

  /**
   * Cancel ongoing generation
   */
  async cancelGeneration(generationId: string): Promise<void> {
    const progressMap = getProgressMap()
    progressMap.delete(generationId)
  }

  /**
   * Generate agent blueprints with AI using structured tool-based approach
   */
  private async generateAgentBlueprints(
    maxCount: number, 
    prompt: string, 
    creativity: number | null | undefined, 
    depth: DepthLevel,
    lengthType: 'FIXED' | 'AI_DECIDES',
    messageHistory?: any[]
  ): Promise<AgentBlueprint[]> {
    const countInstruction = lengthType === 'AI_DECIDES' 
      ? `Determine the optimal number of agents (between 2 and ${maxCount}) for this scenario.`
      : `Create exactly ${maxCount} agent(s).`

    const systemPrompt = `You are an expert at creating prompts for chat agents.

${countInstruction}

For each agent, provide:
1. A name that reflects their role, expertise, or perspective
2. Brief instructions (2-3 sentences) for creating their detailed system prompt later

If generating multiple agents, they should have different viewpoints, backgrounds, or areas of expertise to create engaging discussions.
Make them diverse in perspective and approach.

<IMPORTANT>The types of agents and prompts should be based on the following instructions: ${prompt}</IMPORTANT>

If the instructions reference previous agents or messages, please reference the message history provided to figure out the best agents to create.

Remember: ${countInstruction}.`

    // Create the schema for agent blueprints
    const agentBlueprintSchema = z.object({
      agents: z.array(
        z.object({
          name: z.string().describe("The agent's name that reflects their role, expertise, or perspective"),
          instructions: z.string().describe("Brief instructions (2-3 sentences) for creating their detailed system prompt later")
        })
      ).min(1).max(maxCount).describe("Array of agent blueprints")
    })

    // Log the full prompt being sent to the AI for debugging
    console.log(`[MULTI-ROUND] ======= TOOL-BASED AGENT GENERATION =======`);
    console.log(`[MULTI-ROUND] User prompt: "${prompt}"`);
    console.log(`[MULTI-ROUND] Max count: ${maxCount}, Length type: ${lengthType}`);
    console.log(`[MULTI-ROUND] Message history: ${messageHistory ? `${messageHistory.length} messages` : 'None provided'}`);
    
    if (messageHistory && messageHistory.length > 0) {
      console.log(`[MULTI-ROUND] Message history details:`);
      messageHistory.forEach((msg, i) => {
        const firstLine = msg.content.split('\n')[0].substring(0, 100);
        console.log(`[MULTI-ROUND]   ${i + 1}. ${msg.role}: ${firstLine}${msg.content.length > 100 ? '...' : ''}`);
      });
    }
    
    console.log(`[MULTI-ROUND] ================================================`);

    try {
      const result = await generateObject({
        model: getUtilityModel(),
        temperature: creativity || 0.7,  // Default to 0.7 if creativity is null/undefined
        system: systemPrompt,
        messages: messageHistory && messageHistory.length > 0 
          ? [...messageHistory, { role: 'user', content: 'Create agents based on the conversation history and the instructions provided in the system prompt.' }]
          : [{ role: 'user', content: 'Create agents based on the instructions provided in the system prompt.' }],
        schema: agentBlueprintSchema
      })

      console.log(`[MULTI-ROUND] AI Generator Success - Generated ${result.object.agents.length} agents`);
      result.object.agents.forEach((agent, i) => {
        console.log(`[MULTI-ROUND]   ${i + 1}. ${agent.name}: ${agent.instructions.substring(0, 100)}...`);
      });

      return this.validateAndProcessBlueprints(result.object.agents, lengthType, maxCount);
    } catch (error) {
      logError('Failed to generate agent blueprints with structured approach', {
        error,
        prompt,
        maxCount,
        lengthType
      });
      throw new Error(`Failed to generate agent blueprints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  private validateAndProcessBlueprints(blueprints: any, lengthType: string, maxCount: number): AgentBlueprint[] {
    if (!Array.isArray(blueprints) || blueprints.length === 0) {
      throw new Error('Invalid blueprints format')
    }
    
    // For FIXED mode, ensure we don't exceed the requested count
    if (lengthType === 'FIXED') {
      return blueprints.slice(0, maxCount)
    }
    
    // For AI_DECIDES, return all generated agents (AI determined the count)
    return blueprints.slice(0, maxCount) // Still cap at maxCount for safety
  }

  /**
   * Generate agents in parallel with progress tracking
   */
  private async generateAgentsInParallel(
    blueprints: AgentBlueprint[],
    originalPrompt: string,
    depth: DepthLevel,
    generationId: string,
    userId: string,
    projectIds: string[],
    sessionId?: string
  ): Promise<void> {
    const progressMap = getProgressMap()
    
    // Generate all agents in parallel
    const promises = blueprints.map(async (blueprint, index) => {
      // Update agent status to generating
      const currentProgress = progressMap.get(generationId)
      if (currentProgress) {
        currentProgress.agentProgress[index].status = 'generating'
        progressMap.set(generationId, currentProgress)
      }

      const agent = await this.generateSingleAgentWithProgress(
        blueprint, 
        originalPrompt, 
        depth, 
        generationId, 
        index
      )
      
      // Update final progress and save to database
      const updatedProgress = progressMap.get(generationId)
      if (updatedProgress) {
        if (agent) {
          updatedProgress.completed++
          updatedProgress.agentProgress[index].status = 'completed'
        
          // Save to database
          try {
            console.log(`Saving agent ${agent.name} to database...`, {
              userId,
              sessionId: sessionId || null,
              isDynamic: !!sessionId,
              projectIds: projectIds.length > 0 ? projectIds : 'none'
            })
            
            await prisma.chatAgent.create({
              data: {
                ...agent,
                userId: userId,
                chatRoundSessionId: sessionId || null,
                isDynamic: !!sessionId,
                projects: projectIds.length > 0 ? {
                  connect: projectIds.map((id: string) => ({ id }))
                } : undefined
              }
            })
            
            console.log(`Successfully saved agent ${agent.name}`)
          } catch (error) {
            console.error(`Error saving agent ${agent.name} to database:`, {
              error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                code: (error as any).code
              } : error,
              agentData: {
                id: agent.id,
                name: agent.name,
                userId,
                sessionId: sessionId || null,
                isDynamic: !!sessionId,
                projectIds: projectIds.length > 0 ? projectIds : 'none'
              }
            })
          }
        } else {
          updatedProgress.failed++
          updatedProgress.agentProgress[index].status = 'failed'
        }
        
        progressMap.set(generationId, updatedProgress)
      }
    })

    // Wait for all agents to complete
    await Promise.all(promises)
  }

  /**
   * Generate a single agent with retry logic
   */
  private async generateSingleAgentWithProgress(
    blueprint: AgentBlueprint, 
    originalPrompt: string, 
    depth: DepthLevel,
    generationId: string,
    agentIndex: number,
    retries = 3
  ): Promise<GeneratedAgent | null> {
    const progressMap = getProgressMap()
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Update attempt count in progress
        const currentProgress = progressMap.get(generationId)
        if (currentProgress) {
          currentProgress.agentProgress[agentIndex].attempt = attempt
          progressMap.set(generationId, currentProgress)
        }

        const systemPrompt = `You are creating a detailed system prompt for a chat agent.

Agent Name: ${blueprint.name}
Agent Instructions: ${blueprint.instructions}

Original User Request: ${originalPrompt}

Create a comprehensive system prompt that defines this agent's:
- Personality and communication style
- Area of expertise and background
- Perspective on the topics they'll discuss
- How they should behave in conversations

The system prompt should be ${PromptService.getPromptDepth(depth)}.

Make the agent feel authentic and distinct. They should have a clear voice and perspective.

Respond with just the system prompt text, no additional formatting or explanations.`

        const result = await generateText({
          model: getUtilityModel(),
          temperature: 0.7,
          prompt: systemPrompt,
        })

        if (!result.text || result.text.trim().length < 50) {
          throw new Error('Generated system prompt too short')
        }

        // Generate avatar
        const avatarStyles = [
          (seed: string) => createAvatar(miniavs, { seed }),
          (seed: string) => createAvatar(bottts, { seed, backgroundColor: ['b6e3f4'] }),
          (seed: string) => createAvatar(funEmoji, { seed }),
          (seed: string) => createAvatar(pixelArt, { seed, backgroundColor: ['d1d4f9'] })
        ]
        
        const randomStyle = avatarStyles[Math.floor(Math.random() * avatarStyles.length)]
        const avatar = randomStyle(blueprint.name).toString()

        return {
          id: randomUUID(),
          name: blueprint.name,
          systemPrompt: result.text.trim(),
          avatar,
          isActive: true,
          temperature: 0.7,
          role: 'chat',
          priority: ''
        };
      } catch (error) {
        console.error(`Attempt ${attempt} failed for agent ${blueprint.name}:`, error)
        
        if (attempt === retries) {
          console.error(`All ${retries} attempts failed for agent ${blueprint.name}`)
          return null
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
    
    return null
  }
}

// Export singleton instance
export const agentGenerationService = new AgentGenerationService()