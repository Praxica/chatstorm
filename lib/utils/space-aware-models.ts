import { ModelConfig } from './models';
import { getAllAvailableModels } from '@/lib/services/ModelService';
export type { SpaceModelSettings } from '@/lib/schemas/prisma-typed'
import type { SpaceModelSettings } from '@/lib/schemas/prisma-typed'

/**
 * Filters models based on space settings
 * @param allModels - All available models (system + custom)
 * @param spaceModelSettings - Space model configuration
 * @returns Filtered models according to space settings
 */
export function filterModelsBySpaceSettings(
  allModels: Record<string, ModelConfig>,
  spaceModelSettings: SpaceModelSettings | null
): Record<string, ModelConfig> {
  // If no space settings, return all models
  if (!spaceModelSettings) {
    return allModels;
  }

  const { mode, includedModels, excludedModels } = spaceModelSettings;
  const modelEntries = Object.entries(allModels);

  switch (mode) {
    case 'all':
      return allModels;
    
    case 'include':
      if (includedModels.length === 0) {
        return {}; // If include mode but no models specified, show none
      }
      return Object.fromEntries(
        modelEntries.filter(([modelId]) => includedModels.includes(modelId))
      );
    
    case 'exclude':
      return Object.fromEntries(
        modelEntries.filter(([modelId]) => !excludedModels.includes(modelId))
      );
    
    default:
      return allModels;
  }
}

/**
 * Gets available models for a specific context (user or space)
 * @param userId - User ID
 * @param spaceId - Optional space ID
 * @param spaceModelSettings - Optional space model settings (if in space context)
 * @returns Filtered models based on context
 */
export async function getContextualModels(
  userId: string,
  spaceId?: string,
  spaceModelSettings?: SpaceModelSettings | null
): Promise<Record<string, ModelConfig>> {
  // Get all models (respects spaceId for custom models)
  const allModels = await getAllAvailableModels(userId, spaceId);
  
  // If in space context, apply space filtering
  if (spaceId && spaceModelSettings) {
    return filterModelsBySpaceSettings(allModels, spaceModelSettings);
  }
  
  return allModels;
}

/**
 * Determines the default model for a context
 * @param availableModels - Models available in current context
 * @param spaceModelSettings - Space settings (if in space context)
 * @param userDefaultModel - User's default model preference
 * @returns Default model ID or null
 */
export function getDefaultModelForContext(
  availableModels: Record<string, ModelConfig>,
  spaceModelSettings?: SpaceModelSettings | null,
  userDefaultModel?: string | null
): string | null {
  // In space context, prefer space default
  if (spaceModelSettings?.defaultModel && availableModels[spaceModelSettings.defaultModel]) {
    return spaceModelSettings.defaultModel;
  }
  
  // Fall back to user default if available
  if (userDefaultModel && availableModels[userDefaultModel]) {
    return userDefaultModel;
  }
  
  // Fall back to first available model
  const firstModel = Object.keys(availableModels)[0];
  return firstModel || null;
}

/**
 * Validates that a model is available in the current context
 * @param modelId - Model ID to validate
 * @param availableModels - Models available in current context
 * @returns Whether the model is available
 */
export function isModelAvailableInContext(
  modelId: string,
  availableModels: Record<string, ModelConfig>
): boolean {
  return !!availableModels[modelId];
}