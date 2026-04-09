/**
 * Client-side utility for fetching and managing user's available models
 */

export interface UserModel {
  id: string;
  name: string;
  provider: string;
  isSystemModel: boolean;
  isCustomModel: boolean;
  isAvailable: boolean;
}

/**
 * Fetches all models available to the current user
 */
export async function getUserAvailableModels(): Promise<UserModel[]> {
  try {
    const response = await fetch('/api/user/models');
    if (!response.ok) {
      throw new Error('Failed to fetch user models');
    }
    
    const data = await response.json();
    
    // Transform the response to our expected format
    const models: UserModel[] = [];
    
    // Add system models
    if (data.systemModels) {
      Object.entries(data.systemModels).forEach(([provider, providerModels]: [string, any]) => {
        Object.entries(providerModels).forEach(([modelId, model]: [string, any]) => {
          models.push({
            id: modelId,
            name: (model as any).name || modelId,
            provider,
            isSystemModel: true,
            isCustomModel: false,
            isAvailable: (model as any).isAvailable !== false
          });
        });
      });
    }
    
    // Add custom models
    if (data.customModels && Array.isArray(data.customModels)) {
      data.customModels.forEach((model: any) => {
        models.push({
          id: model.id,
          name: model.name || model.id,
          provider: model.provider,
          isSystemModel: false,
          isCustomModel: true,
          isAvailable: model.isActive !== false
        });
      });
    }
    
    // Filter out unavailable models and sort by provider then name
    return models
      .filter(model => model.isAvailable)
      .sort((a, b) => {
        if (a.provider !== b.provider) {
          return a.provider.localeCompare(b.provider);
        }
        return a.name.localeCompare(b.name);
      });
    
  } catch (error) {
    console.error('Error fetching user models:', error);
    return [];
  }
}

/**
 * Gets the default fallback models for overloaded error scenarios
 * These should be reliable, fast models that are less likely to be overloaded
 */
export function getDefaultFallbackModels(): UserModel[] {
  return [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      isSystemModel: true,
      isCustomModel: false,
      isAvailable: true
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      isSystemModel: true,
      isCustomModel: false,
      isAvailable: true
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      isSystemModel: true,
      isCustomModel: false,
      isAvailable: true
    }
  ];
}

/**
 * Checks if an error message indicates an overloaded service
 */
export function isOverloadedError(error: Error | string | null | undefined): boolean {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' ? error : (error?.message || '');
  
  // Check for overloaded error indicators
  return (
    errorMessage.includes('overloaded') ||
    errorMessage.includes('Overloaded') ||
    errorMessage.includes('service is currently overloaded') ||
    errorMessage.includes('overloaded_error') ||
    errorMessage.toLowerCase().includes('rate limit') ||
    errorMessage.includes('429') // Too Many Requests
  );
}