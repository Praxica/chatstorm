import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { deepseek, createDeepSeek } from '@ai-sdk/deepseek';
import { xai, createXai } from '@ai-sdk/xai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'xai' | 'google';
  id: string;
  name: string;
  description: string;
  maxOutputTokens: number;
  temperatureMultiplier: number;
  isCustom?: boolean; // New field to identify custom models
  modelId?: string; // Provider model name for custom models
  uuid?: string; // DB UUID for custom models
  baseURL?: string; // Optional: base URL for custom providers
}

// Provider-level configuration for custom models
export const PROVIDER_CONFIG = {
  anthropic: {
    temperatureMultiplier: 1,
    defaultMaxTokens: 200000,
    sdk: 'anthropic'
  },
  openai: {
    temperatureMultiplier: 2,
    defaultMaxTokens: 128000,
    sdk: 'openai'
  },
  deepseek: {
    temperatureMultiplier: 2,
    defaultMaxTokens: 128000,
    sdk: 'deepseek'
  },
  xai: {
    temperatureMultiplier: 2,
    defaultMaxTokens: 32768,
    sdk: 'xai'
  },
  google: {
    temperatureMultiplier: 2,
    defaultMaxTokens: 32000,
    sdk: 'google'
  }
} as const;

// Default/System models that come with the app
export const SYSTEM_MODELS: Record<string, ModelConfig> = {
  'claude-3-sonnet': {
    provider: 'anthropic',
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Anthropic\'s Claude Haiku 4.5 model - balanced performance and efficiency',
    maxOutputTokens: 200000,
    temperatureMultiplier: 1,
  },
  'gpt-4': {
    provider: 'openai',
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI\'s most capable model, optimized for both complex tasks and speed',
    maxOutputTokens: 128000,
    temperatureMultiplier: 2,
  },
  'gemini-flash': {
    provider: 'google',
    id: 'gemini-3-pro-preview',
    name: 'Gemini 2.5 Flash-Lite',
    description: 'Google\'s advanced language model with strong multimodal capabilities',
    maxOutputTokens: 32000,
    temperatureMultiplier: 2,
  },
  'grok-2': {
    provider: 'xai',
    id: 'grok-3-mini',
    name: 'Grok 3',
    description: 'X.ai\'s Grok 3 mini, A lightweight model that thinks before responding. Fast, smart, and great for logic-based tasks that do not require deep domain knowledge.',
    maxOutputTokens: 32768,
    temperatureMultiplier: 2,
  }
};

// Backward compatibility alias
export const AVAILABLE_MODELS = SYSTEM_MODELS;

/**
 * Returns the default utility model for lightweight, fast LLM tasks
 * that don't require high reasoning depth. Currently points to the
 * latest Gemini Flash-Lite model.
 */
export function getUtilityModel(): LanguageModel {
  // Prefer Google's fast, inexpensive model for utility work
  const model = createModelProvider('google', SYSTEM_MODELS['gemini-flash'].id);
  if (!model) {
    // Fallback: keep a stable backup if provider resolution fails
    return google(SYSTEM_MODELS['gemini-flash'].id) as unknown as LanguageModel;
  }
  return model as LanguageModel;
}

/**
 * Gets the Vercel AI SDK provider function for a given model ID from system models.
 * This is a client-safe function that does not handle authentication.
 * @param modelId The ID of the model (e.g., 'gpt-4').
 * @returns The corresponding provider function or null if not found.
 */
export function getModelProvider(modelId: string, options?: { apiKey?: string }): LanguageModel | null {
  const modelConfig = AVAILABLE_MODELS[modelId];
  if (!modelConfig) {
    console.warn(`Model config not found for ID: ${modelId}`);
    return null;
  }

  return createModelProvider(modelConfig.provider, modelConfig.id, options);
}

/**
 * Creates a model provider directly from provider name and model ID.
 * This bypasses the system models lookup and allows any model ID for the provider.
 * For custom API keys, we must use the provider factory (e.g., createOpenAI({ apiKey }))
 * to ensure the correct key is used, as passing apiKey as a model option is ignored by the SDK.
 * @param provider The provider name (e.g., 'anthropic', 'openai')
 * @param modelId The actual model ID to use (e.g., 'claude-opus-4-20250514')
 * @param options Optional configuration including API key
 * @returns The provider function or null if provider not supported
 */
export function createModelProvider(
  provider: ModelConfig['provider'], 
  modelId: string, 
  options?: { apiKey?: string }
) : LanguageModel | null {
  let model;
  
  // Use the provider factory if an apiKey is provided, otherwise use the default SDK
  if (provider === 'anthropic') {
    if (options?.apiKey) {
      const anthropicProvider = createAnthropic({ apiKey: options.apiKey });
      model = anthropicProvider(modelId);
    } else {
      model = anthropic(modelId);
    }
  } else if (provider === 'openai') {
    if (options?.apiKey) {
      const openaiProvider = createOpenAI({ apiKey: options.apiKey });
      model = openaiProvider(modelId);
    } else {
      model = openai(modelId);
    }
  } else if (provider === 'deepseek') {
    if (options?.apiKey) {
      const deepseekProvider = createDeepSeek({ apiKey: options.apiKey });
      model = deepseekProvider(modelId);
    } else {
      model = deepseek(modelId);
    }
  } else if (provider === 'xai') {
    if (options?.apiKey) {
      const xaiProvider = createXai({ apiKey: options.apiKey });
      model = xaiProvider(modelId);
    } else {
      model = xai(modelId);
    }
  } else if (provider === 'google') {
    if (options?.apiKey) {
      const googleProvider = createGoogleGenerativeAI({ apiKey: options.apiKey });
      model = googleProvider(modelId);
    } else {
      model = google(modelId);
    }
  } else {
    // fallback
    console.warn(`Provider SDK not found for provider: ${provider}`);
    return null;
  }
  
  // Add modelId property if it doesn't exist
  if (model && !(model as any).modelId) {
    model = { ...(model as any), modelId };
  }
  
  return model as LanguageModel;
}

// Filter system models based on user settings (client-safe)
export const getFilteredModels = (modelSettings: any) => {
  if (!modelSettings || modelSettings.mode === 'all') {
    return SYSTEM_MODELS;
  }

  const modelEntries = Object.entries(SYSTEM_MODELS);
  
  if (modelSettings.mode === 'include') {
    // If includedModels is empty, return all models as a fallback
    if (!modelSettings.includedModels?.length) {
      return SYSTEM_MODELS;
    }
    
    // Only include the models specified in includedModels
    return Object.fromEntries(
      modelEntries.filter(([key]) => modelSettings.includedModels.includes(key))
    );
  }
  
  if (modelSettings.mode === 'exclude') {
    // Exclude the models specified in excludedModels
    return Object.fromEntries(
      modelEntries.filter(([key]) => !modelSettings.excludedModels.includes(key))
    );
  }
  
  // Default fallback
  return SYSTEM_MODELS;
};

// Note: Server-side model functions have been moved to lib/utils/models-server.ts
// This file only contains client-safe model definitions and filtering functions 