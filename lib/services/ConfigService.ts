import { Config, ChatAgent, ChatRound, RoundStance, Project, Prisma } from '@prisma/client'
import { Config as StoreConfig } from '../stores/configsStore'
import { prisma } from '@/lib/prisma'
import { getModality } from '@/lib/chat/modalities/ModalityRegistry'

type ConfigWithRelations = Config & {
  rounds: (ChatRound & {
    participants: ChatAgent[]
    stances: RoundStance[]
  })[]
  projects: Project[]
}

/**
 * Client-side utility functions for working with Config objects
 */
export const ConfigUtils = {
  /**
   * Get a config from the store by its ID, looking in both the configs array and activeConfig
   */
  findById(configs: StoreConfig[], activeConfig: StoreConfig | null, configId: string): StoreConfig | null {
    // First check direct match in configs array
    const directMatch = configs.find(c => c.id === configId);
    if (directMatch) return directMatch;
    
    // Check if activeConfig matches
    if (activeConfig?.id === configId) return activeConfig;
    
    return null;
  },

  /**
   * Safely get the chat instructions from a config, with fallback
   */
  getChatInstructions(config: StoreConfig | null | undefined): string {
    return config?.chatInstructions || '';
  },

  /**
   * Safely get example prompts from a config, with fallback
   */
  getExamplePrompts(config: StoreConfig | null | undefined): string[] {
    return config?.examplePrompts || [];
  },

  /**
   * Safely get project IDs from a config, with fallback
   */
  getProjectIds(config: StoreConfig | null | undefined): string[] {
    return config?.projects?.map(p => p.id) || [];
  },

  /**
   * Create a payload for updating config fields in the API
   */
  createUpdatePayload(
    title?: string,
    projectIds?: string[],
    chatInstructions?: string,
    examplePrompts?: string[],
    designSettings?: any
  ) {
    return {
      title,
      projects: projectIds?.map(id => ({ id })),
      chatInstructions,
      examplePrompts,
      designSettings
    };
  }
};

export class ConfigService {
  /**
   * Unified server-side method to copy a config with options for reusing or creating new resources
   * Use this when calling from API routes or server-side code
   */
  static async copyConfig(
    config: ConfigWithRelations,
    userId: string,
    options: {
      appendToTitle?: string
      appendToAgentNames?: string
      reuseAgents?: boolean // true for same-user copies, false for cross-user shares
      reuseProjects?: boolean // true to reuse existing projects, false to create new ones
      spaceId?: string // optional spaceId for space-scoped configs
    } = {}
  ) {
    const { 
      appendToTitle = '', 
      appendToAgentNames = '',
      reuseAgents = false,
      reuseProjects = true,
      spaceId = null 
    } = options
    
    const agentIdMapping = new Map<string, string>()
    const missingAgents: string[] = []

    if (reuseAgents) {
      // For same-user copies, just map existing agent IDs to themselves
      const allAgentIds = new Set<string>()

      for (const round of config.rounds) {
        // Add participant IDs
        for (const participant of round.participants) {
          if (participant?.id) allAgentIds.add(participant.id)
        }

        // Add dialogue sender and receiver IDs if they exist
        if (round.dialogueSelectedSenders && Array.isArray(round.dialogueSelectedSenders)) {
          round.dialogueSelectedSenders.forEach(id => {
            if (id) allAgentIds.add(id)
          })
        }
        if (round.dialogueSelectedReceivers && Array.isArray(round.dialogueSelectedReceivers)) {
          round.dialogueSelectedReceivers.forEach(id => {
            if (id) allAgentIds.add(id)
          })
        }

        // Add all moderator IDs using modality system
        const modality = getModality(round.type);
        const moderatorIds = modality.getRoundModerators(round);
        moderatorIds.forEach(id => {
          if (id) allAgentIds.add(id)
        });
      }

      // Map each agent ID to itself
      for (const agentId of allAgentIds) {
        agentIdMapping.set(agentId, agentId)
      }
    } else {
      // For cross-user copies, create new agents
      const allAgentIds = new Set<string>()

      for (const round of config.rounds) {
        // Add participant IDs
        for (const participant of round.participants) {
          if (participant?.id) allAgentIds.add(participant.id)
        }

        // Add dialogue sender and receiver IDs if they exist
        if (round.dialogueSelectedSenders && Array.isArray(round.dialogueSelectedSenders)) {
          round.dialogueSelectedSenders.forEach(id => {
            if (id) allAgentIds.add(id)
          })
        }
        if (round.dialogueSelectedReceivers && Array.isArray(round.dialogueSelectedReceivers)) {
          round.dialogueSelectedReceivers.forEach(id => {
            if (id) allAgentIds.add(id)
          })
        }

        // Add all moderator IDs using modality system
        const modality = getModality(round.type);
        const moderatorIds = modality.getRoundModerators(round);
        moderatorIds.forEach(id => {
          if (id) allAgentIds.add(id)
        });
      }

      if (allAgentIds.size === 0) {
        throw new Error('Config copy failed: No agents found in source config')
      }

      // Fetch all the original agents
      const originalAgents = await prisma.chatAgent.findMany({
        where: {
          id: {
            in: Array.from(allAgentIds)
          }
        }
      })

      // Check for missing agents
      const foundAgentIds = new Set(originalAgents.map(a => a.id))
      for (const requestedId of allAgentIds) {
        if (!foundAgentIds.has(requestedId)) {
          missingAgents.push(requestedId)
          console.warn(`[ConfigService.copyConfig] Agent not found: ${requestedId}`)
        }
      }

      if (missingAgents.length > 0) {
        console.error('[ConfigService.copyConfig] Missing agents during copy', {
          configId: config.id,
          missingCount: missingAgents.length,
          missingAgentIds: missingAgents
        })
      }

      // Copy each agent for the new user
      for (const originalAgent of originalAgents) {
        const newAgentId = crypto.randomUUID()
        agentIdMapping.set(originalAgent.id, newAgentId)

        await prisma.chatAgent.create({
          data: {
            id: newAgentId,
            name: `${originalAgent.name}${appendToAgentNames}`,
            role: originalAgent.role,
            systemPrompt: originalAgent.systemPrompt,
            priority: originalAgent.priority,
            avatar: originalAgent.avatar,
            model: originalAgent.model,
            temperature: originalAgent.temperature,
            isActive: originalAgent.isActive,
            userId: userId,
            modelSelectionMode: originalAgent.modelSelectionMode,
            selectedModels: originalAgent.selectedModels,
          }
        })
      }
    }
    
    // Create a copy of the config with all its rounds
    // Use spread to copy all config fields, then override specific ones
    const {
      id: _id,
      createdAt: _createdAt,
      lastUpdatedAt: _lastUpdatedAt,
      rounds: _rounds,
      projects: _projects,
      userId: _originalUserId,
      ...configDataToCopy
    } = config;

    // CRITICAL: Sort rounds by sequence to ensure correct order
    const sortedRounds = [...config.rounds].sort((a, b) => a.sequence - b.sequence);

    // Handle Prisma 5 null Json fields at config level — Prisma requires Prisma.JsonNull for explicit nulls
    const jsonSafeConfigData = {
      ...configDataToCopy,
      retentionSettings: configDataToCopy.retentionSettings ?? Prisma.JsonNull,
      memorySettings: configDataToCopy.memorySettings ?? Prisma.JsonNull,
      designSettings: configDataToCopy.designSettings ?? Prisma.JsonNull,
    };

    const newConfig = await prisma.config.create({
      data: {
        ...jsonSafeConfigData, // Copies all fields with Json-safe values
        title: `${config.title}${appendToTitle}`, // Override title
        userId, // Set new owner
        spaceId, // Set spaceId if provided
        rounds: {
          create: sortedRounds.map(round => {
            // Extract fields that should NOT be copied
            const {
              id: _roundId,
              configId: _configId,
              createdAt: _roundCreatedAt,
              updatedAt: _roundUpdatedAt,
              participants: _participants,
              stances: _stances,
              ...roundDataToCopy
            } = round;

            // Map all moderator fields explicitly based on known field names
            const moderatorFieldMapping = {
              moderatorAgentId: round.moderatorAgentId,
              lengthModerator: round.lengthModerator,
              dialogueLengthModerator: round.dialogueLengthModerator,
              dialogueReceiverModerator: round.dialogueReceiverModerator,
              dialogueSenderModerator: round.dialogueSenderModerator,
              messageSenderModerator: round.messageSenderModerator,
              transitionModerator: round.transitionModerator,
            };

            const mappedModeratorFields: Record<string, string | null> = {};

            for (const [fieldName, fieldValue] of Object.entries(moderatorFieldMapping)) {
              if (fieldValue && typeof fieldValue === 'string') {
                const mappedId = agentIdMapping.get(fieldValue);
                if (mappedId) {
                  mappedModeratorFields[fieldName] = mappedId;
                } else {
                  // Set to null if agent mapping not found
                  mappedModeratorFields[fieldName] = null;
                  console.warn(`[ConfigService.copyConfig] Unmapped moderator ${fieldName}=${fieldValue} in round ${round.sequence}`)
                }
              }
            }

            // Handle Prisma 5 null Json fields — Prisma requires Prisma.JsonNull for explicit nulls
            const jsonSafeRoundData = {
              ...roundDataToCopy,
              dataTool: roundDataToCopy.dataTool ?? Prisma.JsonNull,
              retentionSettings: roundDataToCopy.retentionSettings ?? Prisma.JsonNull,
              transitionConditions: roundDataToCopy.transitionConditions ?? Prisma.JsonNull,
            };

            return {
              ...jsonSafeRoundData,
              // Map participant IDs to the new copied agent IDs
              participants: {
                connect: round.participants
                  .filter(p => p?.id && agentIdMapping.has(p.id))
                  .map(p => ({
                    id: agentIdMapping.get(p.id)!,
                  })),
              },
              // Map dialogue sender and receiver arrays if they exist
              ...(round.dialogueSelectedSenders && round.dialogueSelectedSenders.length > 0 ? {
                dialogueSelectedSenders: round.dialogueSelectedSenders
                  .map(senderId => agentIdMapping.get(senderId))
                  .filter(Boolean) as string[]
              } : {}),
              ...(round.dialogueSelectedReceivers && round.dialogueSelectedReceivers.length > 0 ? {
                dialogueSelectedReceivers: round.dialogueSelectedReceivers
                  .map(receiverId => agentIdMapping.get(receiverId))
                  .filter(Boolean) as string[]
              } : {}),
              // Apply mapped moderator fields - this MUST come after ...roundDataToCopy to override
              ...mappedModeratorFields,
            }
          })
        },
        projects: reuseProjects ? {
          connect: config.projects.map(p => ({ id: p.id }))
        } : undefined
      },
      include: {
        rounds: {
          include: {
            participants: true,
          },
        },
        projects: true
      },
    })

    // Add stances for each round if they exist, using mapped agent IDs
    // Get the newly created rounds to process stances
    const newRounds = await prisma.chatRound.findMany({
      where: { configId: newConfig.id },
      orderBy: { sequence: 'asc' }
    })

    if (newRounds.length !== sortedRounds.length) {
      throw new Error(`Config copy failed: Round count mismatch (source: ${sortedRounds.length}, created: ${newRounds.length})`)
    }

    // CRITICAL: Use sortedRounds to match with newRounds (both sorted by sequence)
    for (let i = 0; i < sortedRounds.length; i++) {
      const sourceRound = sortedRounds[i]
      const newRound = newRounds[i]

      if (sourceRound.stances && sourceRound.stances.length > 0) {
        const stanceData = sourceRound.stances
          .filter(stance => agentIdMapping.has(stance.agentId))
          .map(stance => ({
            roundId: newRound.id,
            agentId: agentIdMapping.get(stance.agentId)!,
            stance: stance.stance
          }))

        if (stanceData.length > 0) {
          await prisma.roundStance.createMany({
            data: stanceData
          })
        }
      }
    }

    // Build round ID mapping from original to new rounds
    // CRITICAL: Use sortedRounds to match the creation order
    const roundIdMapping = new Map<string, string>()
    for (let i = 0; i < sortedRounds.length; i++) {
      const originalRoundId = sortedRounds[i].id
      const newRoundId = newRounds[i].id
      roundIdMapping.set(originalRoundId, newRoundId)
    }

    // Update transitionConditions in rounds to use new round IDs
    for (let i = 0; i < sortedRounds.length; i++) {
      const sourceRound = sortedRounds[i]
      const newRound = newRounds[i]

      if (sourceRound.transitionConditions && Array.isArray(sourceRound.transitionConditions)) {
        const updatedConditions = sourceRound.transitionConditions.map((condition: any) => {
          const mappedRoundId = roundIdMapping.get(condition.roundId)
          if (!mappedRoundId) {
            console.warn(`[ConfigService.copyConfig] Transition condition references unmapped round ${condition.roundId}`)
          }
          return {
            ...condition,
            roundId: mappedRoundId || condition.roundId
          }
        })

        await prisma.chatRound.update({
          where: { id: newRound.id },
          data: { transitionConditions: updatedConditions }
        })
      }
    }

    // Update memory settings to use new round IDs if memorySettings exist
    if (config.memorySettings && typeof config.memorySettings === 'object' && (config.memorySettings as any).memories) {
      const memorySettings = config.memorySettings as any
      const updatedMemories = memorySettings.memories.map((memory: any) => {
        const updatedMemory = { ...memory }
        
        // Map memorizeRound ID
        if (memory.memorizeRound && roundIdMapping.has(memory.memorizeRound)) {
          updatedMemory.memorizeRound = roundIdMapping.get(memory.memorizeRound)
        }
        
        // Map rememberRounds array
        if (memory.rememberRounds && Array.isArray(memory.rememberRounds)) {
          updatedMemory.rememberRounds = memory.rememberRounds.map((roundRef: any) => ({
            ...roundRef,
            roundId: roundIdMapping.get(roundRef.roundId) || roundRef.roundId
          }))
        }
        
        // Map updateRounds array
        if (memory.updateRounds && Array.isArray(memory.updateRounds)) {
          updatedMemory.updateRounds = memory.updateRounds.map((roundRef: any) => ({
            ...roundRef,
            roundId: roundIdMapping.get(roundRef.roundId) || roundRef.roundId
          }))
        }
        
        return updatedMemory
      })
      
      // Update the config with mapped memory settings
      await prisma.config.update({
        where: { id: newConfig.id },
        data: {
          memorySettings: {
            ...memorySettings,
            memories: updatedMemories
          }
        }
      })
      
    }

    // Get the updated config with all relations
    const updatedConfig = await prisma.config.findUnique({
      where: { id: newConfig.id },
      include: {
        rounds: {
          include: {
            participants: true,
            stances: true
          },
          orderBy: { sequence: 'asc' }
        },
        projects: true
      }
    })

    if (!updatedConfig) {
      throw new Error('Config copy failed: Could not retrieve created config')
    }

    // Log completion summary
    console.log('[ConfigService.copyConfig] Copy complete', {
      sourceConfigId: config.id,
      newConfigId: newConfig.id,
      roundsCount: updatedConfig.rounds.length,
      agentsCount: agentIdMapping.size,
      missingAgentsCount: missingAgents.length
    })

    return updatedConfig
  }


  /**
   * Client-side method to copy a config via HTTP request
   * Use this when calling from client-side components
   */
  static async copyConfigViaApi(
    config: ConfigWithRelations,
    userId: string,
    options: {
      title?: string
      appendToTitle?: string
      appendToAgentNames?: string
    } = {}
  ) {
    const { title, appendToTitle = '', appendToAgentNames = '' } = options

    const response = await fetch(`/api/configs/${config.id}/copy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title, // Pass the full title if provided
        appendToTitle,
        appendToAgentNames,
        userId
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to copy config')
    }

    return response.json()
  }

  static async updateConfigViaApi(
    configId: string,
    data: {
      title?: string
      projectIds?: string[]
      projects?: { id: string }[]
      chatInstructions?: string
      examplePrompts?: string[]
      retentionSettings?: any
      designSettings?: any
    }
  ) {
    // Build a payload with only the specified fields
    const apiData: Record<string, unknown> = {}

    if (data.title !== undefined) apiData.title = data.title
    if (data.chatInstructions !== undefined) apiData.chatInstructions = data.chatInstructions
    if (data.examplePrompts !== undefined) apiData.examplePrompts = data.examplePrompts
    if (data.retentionSettings !== undefined) apiData.retentionSettings = data.retentionSettings
    if (data.designSettings !== undefined) apiData.designSettings = data.designSettings

    if (data.projectIds) {
      apiData.projectIds = data.projectIds
    } else if (data.projects) {
      apiData.projectIds = data.projects.map(p => p.id)
    }

    const response = await fetch(`/api/configs/${configId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to update config:', errorText)
      throw new Error('Failed to update config')
    }

    return response.json()
  }

  static async deleteConfig(configId: string) {
    const response = await fetch(`/api/configs/${configId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to delete config')
    }

    return response.json()
  }

  static async shareConfig(
    configId: string,
    recipientEmail: string,
    senderUserId: string
  ) {
    const response = await fetch(`/api/configs/${configId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientEmail,
        senderUserId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to share config')
    }

    return response.json()
  }

  static async getConfigWithRelations(configId: string) {
    const response = await fetch(`/api/configs/${configId}`)

    if (!response.ok) {
      throw new Error('Failed to get config')
    }

    return response.json()
  }
} 