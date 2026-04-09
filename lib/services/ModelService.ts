import { SYSTEM_MODELS, PROVIDER_CONFIG } from '@/lib/utils/models';
import { prisma } from '@/lib/prisma';

export async function getAllAvailableModels(userId: string, spaceId?: string) {
  const allModels = { ...SYSTEM_MODELS };
  
  // Load ONLY space custom models for space context, ONLY user custom models for user context
  const customModels = await prisma.customModel.findMany({ 
    where: spaceId 
      ? { spaceId } // Only space models when in space context
      : { userId }  // Only user models when in user context
  });
  
  for (const customModel of customModels) {
    const modelKey = `custom:${customModel.id}`;
    const providerKey = customModel.provider.toLowerCase() as keyof typeof PROVIDER_CONFIG;
    const providerConfig = PROVIDER_CONFIG[providerKey];
    
    allModels[modelKey] = {
      provider: providerKey as import('@/lib/utils/models').ModelConfig['provider'],
      id: customModel.modelId, // modelId for chat engine compatibility
      uuid: customModel.id,    // DB UUID for edit/delete
      modelId: customModel.modelId, // explicit
      name: customModel.name,
      description: `Custom ${customModel.provider} model`,
      maxOutputTokens: providerConfig?.defaultMaxTokens || 128000,
      temperatureMultiplier: providerConfig?.temperatureMultiplier || 2,
      isCustom: true,
      baseURL: customModel.baseURL || undefined,
    };
  }
  
  return allModels;
} 