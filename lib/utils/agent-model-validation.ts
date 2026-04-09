import { type ModelConfig } from './models';
import { type ChatAgent } from '@/lib/stores/chatAgentStore';

export interface ModelAvailabilityInfo {
  hasUnavailableModels: boolean;
  availableModels: string[];
  unavailableModels: string[];
  totalSelectedModels: number;
  fallbackStrategy: 'none' | 'partial' | 'complete';
}

/**
 * Check which of an agent's selected models are available in the current context
 */
export function checkAgentModelAvailability(
  agent: ChatAgent,
  availableModels: Record<string, ModelConfig>
): ModelAvailabilityInfo {
  // If agent uses default or random, no specific models to check
  if (agent.modelSelectionMode !== 'select' || !agent.selectedModels || agent.selectedModels.length === 0) {
    return {
      hasUnavailableModels: false,
      availableModels: [],
      unavailableModels: [],
      totalSelectedModels: 0,
      fallbackStrategy: 'none'
    };
  }

  const availableModelKeys = Object.keys(availableModels);
  const selectedModels = agent.selectedModels || [];
  
  const availableSelected = selectedModels.filter(modelId => availableModelKeys.includes(modelId));
  const unavailableSelected = selectedModels.filter(modelId => !availableModelKeys.includes(modelId));

  let fallbackStrategy: ModelAvailabilityInfo['fallbackStrategy'] = 'none';
  if (unavailableSelected.length > 0) {
    if (availableSelected.length > 0) {
      fallbackStrategy = 'partial'; // Some models available, will use those
    } else {
      fallbackStrategy = 'complete'; // No models available, will fall back to default behavior
    }
  }

  return {
    hasUnavailableModels: unavailableSelected.length > 0,
    availableModels: availableSelected,
    unavailableModels: unavailableSelected,
    totalSelectedModels: selectedModels.length,
    fallbackStrategy
  };
}

/**
 * Get a human-readable description of what will happen with agent model selection
 */
export function getModelFallbackDescription(info: ModelAvailabilityInfo, agentName: string): string {
  if (!info.hasUnavailableModels) {
    return `${agentName} will use its configured model(s)`;
  }

  switch (info.fallbackStrategy) {
    case 'partial':
      return `${agentName} has ${info.unavailableModels.length} unavailable model(s). Will use ${info.availableModels.length} available model(s)`;
    case 'complete':
      return `${agentName} has no available models in this space. Will fall back to space default model selection`;
    default:
      return `${agentName} model configuration is valid`;
  }
}

/**
 * Get model names for display purposes
 */
export function getModelNames(modelIds: string[], availableModels: Record<string, ModelConfig>): string[] {
  return modelIds.map(id => availableModels[id]?.name || id);
}