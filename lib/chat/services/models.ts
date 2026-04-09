import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/utils/crypto';
import { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { SYSTEM_MODELS, getModelProvider, createModelProvider } from '@/lib/utils/models';
import { getContextualModels, SpaceModelSettings } from '@/lib/utils/space-aware-models';
import { SpaceService } from '@/lib/services/SpaceService';
import { logError } from '@/lib/utils/error';
import { ChatState } from '../types';

/**
 * Initializes all available models for a user, including system and custom models.
 * @param userId - The user's internal ID (UUID format)
 * @returns A map of model IDs to their initialized LanguageModel instances.
 */
async function initializeAllModels(userId: string): Promise<Record<string, LanguageModel>> {
  const initializedModels: Record<string, LanguageModel> = {} as Record<string, LanguageModel>;

  // 1. Initialize all system models
  for (const modelId in SYSTEM_MODELS) {
    const modelInstance = getModelProvider(modelId);
    if (modelInstance) {
      initializedModels[modelId] = modelInstance as unknown as LanguageModel;
    }
  }

  // 2. Fetch, decrypt, and initialize all custom models
  const initializedCustomModels = await getInitializedCustomModels(userId);

  // 3. Merge system and custom models
  const totalModels = { ...initializedModels, ...initializedCustomModels };
  
  return totalModels;
}

/**
 * Initializes space-aware models for a user in a specific context
 * @param userId - The user's internal ID (UUID format)
 * @param spaceId - Optional space ID for space context
 * @param configId - Optional config ID to determine space context
 * @returns A map of model IDs to their initialized LanguageModel instances, filtered by space settings
 */
async function initializeContextualModels(
  userId: string, 
  spaceId?: string, 
  configId?: string
): Promise<Record<string, LanguageModel>> {
  let resolvedSpaceId = spaceId;
  let spaceModelSettings: SpaceModelSettings | null = null;
  
  // If no spaceId provided but configId is provided, try to resolve space from config
  if (!resolvedSpaceId && configId) {
    try {
      const config = await prisma.config.findUnique({
        where: { id: configId },
        select: { spaceId: true }
      });
      resolvedSpaceId = config?.spaceId || undefined;
    } catch (error) {
      console.warn('Failed to resolve space from config:', configId, error);
    }
  }
  
  // Get space model settings if in space context
  if (resolvedSpaceId) {
    try {
      const space = await SpaceService.getSpaceById(resolvedSpaceId, userId);
      if (space) {
        spaceModelSettings = (space.modelSettings as unknown as SpaceModelSettings) || {
          mode: 'all',
          defaultModel: null,
          includedModels: [],
          excludedModels: []
        };
      }
    } catch (error) {
      console.warn('Failed to fetch space model settings for model initialization:', error);
    }
  }
  
  // Get available model configurations (filtered by space settings)
  const availableModels = await getContextualModels(userId, resolvedSpaceId, spaceModelSettings);
  
  // Initialize only the available models
  const initializedModels: Record<string, LanguageModel> = {};
  
  for (const [modelKey, modelConfig] of Object.entries(availableModels)) {
    if (modelConfig.isCustom) {
      // Handle custom models - need to decrypt and initialize
      try {
        const customModel = await prisma.customModel.findUnique({
          where: { id: modelConfig.uuid }
        });
        
        if (customModel) {
          const decryptedApiKey = decrypt(customModel.apiKey);
          const provider = (customModel.provider || '').toLowerCase();

          // If provider is 'custom' or a baseURL is provided, treat as OpenAI-compatible
          if (provider === 'custom' || customModel.baseURL) {
            if (!customModel.baseURL) {
              console.warn(`Custom model ${customModel.id} marked as custom but missing baseURL; skipping.`);
              continue;
            }
            try {
              const openaiProvider = createOpenAI({ apiKey: decryptedApiKey, baseURL: customModel.baseURL, name: 'custom.chat' });
              // Use Chat Completions-compatible endpoint for OpenAI-compatible providers
              let lm = openaiProvider.chat(customModel.modelId) as unknown as LanguageModel;
              if (lm && !(lm as any).modelId) {
                lm = { ...(lm as any), modelId: customModel.modelId } as LanguageModel;
              }
              initializedModels[modelKey] = lm;
              // (debug log removed for production)
            } catch (initError) {
              logError(`ModelService.initializeContextualModels: initializing OpenAI-compatible custom model ${customModel.id}`, initError);
            }
            continue;
          }

          // Otherwise, initialize via known provider factories
          const modelInstance = createModelProvider(
            provider as any,
            customModel.modelId,
            { apiKey: decryptedApiKey }
          );
          
          if (modelInstance) {
            let finalModelInstance = modelInstance as unknown as LanguageModel;
            // Patch modelId for SDK compatibility
            if (!(finalModelInstance as any).modelId) {
              finalModelInstance = { ...(finalModelInstance as any), modelId: customModel.modelId } as LanguageModel;
            }
            initializedModels[modelKey] = finalModelInstance;
          } else {
            console.warn(`Provider SDK not found for provider: ${provider} (model ${customModel.id})`);
          }
        }
      } catch (error) {
        logError(`ModelService.initializeContextualModels: Failed to initialize custom model ${modelKey}`, error);
      }
    } else {
      // Handle system models
      const modelInstance = getModelProvider(modelKey);
      if (modelInstance) {
        initializedModels[modelKey] = modelInstance as unknown as LanguageModel;
      }
    }
  }
  
  return initializedModels;
}

/**
 * Fetches all custom models for a user, decrypts their API keys,
 * and returns a map of initialized Vercel AI SDK model objects.
 */
async function getInitializedCustomModels(userId: string): Promise<Record<string, LanguageModel>> {
  const initializedCustomModels: Record<string, LanguageModel> = {};

  try {
    // Check if userId is a Clerk external ID (starts with 'user_') or internal UUID
    let internalUserId = userId;
    
    if (userId.startsWith('user_')) {
      // This is a Clerk external ID, need to find the internal user ID
      const user = await prisma.user.findFirst({
        where: { externalId: userId },
        select: { id: true }
      });
      
      if (!user) {
        console.warn(`No user found for external ID: ${userId}`);
        return initializedCustomModels;
      }
      
      internalUserId = user.id;
    }

    const customModels = await prisma.customModel.findMany({ where: { userId: internalUserId } });

    for (const customModel of customModels) {
      const decryptedApiKey = decrypt(customModel.apiKey);
      const modelKey = `custom:${customModel.id}`;
      let modelInstance: LanguageModel;

      // Always use the provider branch (no 'custom' provider)
      const modelInstanceWithKey = createModelProvider(
        customModel.provider.toLowerCase() as any, 
        customModel.modelId, // Use .modelId (provider model name)
        { apiKey: decryptedApiKey }
      );
      if (!modelInstanceWithKey) {
        console.warn(`Skipping custom model "${customModel.name}" due to unsupported provider: ${customModel.provider}`);
        continue;
      }
      modelInstance = modelInstanceWithKey as unknown as LanguageModel;
      // Patch modelId for SDK compatibility
      if (modelInstance && !(modelInstance as any).modelId) {
        modelInstance = { ...(modelInstance as any), modelId: customModel.modelId } as LanguageModel;
      }
      initializedCustomModels[modelKey] = modelInstance;
    }
  } catch (error) {
    console.error("Failed to fetch or initialize custom models for user:", userId);
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } else {
      console.error("Non-Error object:", JSON.stringify(error, null, 2));
    }
  }

  return initializedCustomModels;
}

/**
 * Synchronously selects a language model from the pre-initialized models in the ChatState.
 * The selection is based on the hierarchy: round -> agent -> user -> random.
 * @param chatState - The current state of the chat, containing all necessary info.
 * @returns A LanguageModel instance.
 */
function getLLMModel(chatState: ChatState): LanguageModel {
  const { activeRound: round, activeAgent: agent, user, languageModels } = chatState;
  const userModelSettings = (user as any).capabilities?.modelSettings;
  const availableModelKeys = Object.keys(languageModels);


  try {
    // 1. Round-specific model
    if (round?.modelSelectionMode && round.modelSelectionMode !== 'agent') {
      if (round.modelSelectionMode === 'specific' && round.selectedModel && languageModels[round.selectedModel]) {
        return languageModels[round.selectedModel] as unknown as LanguageModel;
      }
      if (round.modelSelectionMode === 'random') {
        const randomKey = availableModelKeys[Math.floor(Math.random() * availableModelKeys.length)];
        return languageModels[randomKey] as unknown as LanguageModel;
      }
    }

    // 2. Agent-specific model
    if (agent?.modelSelectionMode && agent.modelSelectionMode !== 'default') {
      if (agent.modelSelectionMode === 'random') {
        const randomKey = availableModelKeys[Math.floor(Math.random() * availableModelKeys.length)];
        return languageModels[randomKey] as unknown as LanguageModel;
      }
      if (agent.modelSelectionMode === 'select' && agent.selectedModels && agent.selectedModels.length > 0) {
        const agentModelKeys = agent.selectedModels.filter((key: string) => availableModelKeys.includes(key));
        
        if (agentModelKeys.length > 0) {
          const randomKey = agentModelKeys[Math.floor(Math.random() * agentModelKeys.length)];
          return languageModels[randomKey] as unknown as LanguageModel;
        }
      }
    }

    // 3. User default model
    if (userModelSettings?.defaultModel && languageModels[userModelSettings.defaultModel]) {
      return languageModels[userModelSettings.defaultModel] as unknown as LanguageModel;
    }

    // 4. Random from available models (already context-filtered during initialization)
    if (availableModelKeys.length > 0) {
      const randomKey = availableModelKeys[Math.floor(Math.random() * availableModelKeys.length)];
      return languageModels[randomKey] as unknown as LanguageModel;
    }
  } catch (error) {
    console.warn('Error selecting LLM model, falling back to random selection:', error);
  }

  // Fallback: Random model from all initialized models
  const randomKey = availableModelKeys[Math.floor(Math.random() * availableModelKeys.length)];
  return languageModels[randomKey] as unknown as LanguageModel;
}

export const ModelService = {
  initializeAllModels,
  initializeContextualModels,
  getLLMModel,
}; 