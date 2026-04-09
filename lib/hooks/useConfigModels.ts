import { useEffect } from 'react';
import { useModelsStore } from '@/lib/stores/modelsStore';
import { useConfigsStore } from '@/lib/stores/configsStore';

/**
 * Custom hook that loads models appropriate for the current config context
 * If config is a space config, loads space-filtered models
 * If config is personal, loads user models
 */
export function useConfigModels(configId?: string) {
  const loadModels = useModelsStore(state => state.loadModels);
  const availableModels = useModelsStore(state => state.availableModels);
  const isLoading = useModelsStore(state => state.isLoading);
  const activeConfig = useConfigsStore(state => state.activeConfig);
  const findConfigById = useConfigsStore(state => state.configs.find(c => c.id === configId));
  
  // Determine which config to use
  const targetConfig = configId ? findConfigById : activeConfig;
  const spaceId = targetConfig?.spaceId;
  
  useEffect(() => {
    if (targetConfig) {
      loadModels(spaceId ?? undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetConfig?.id, spaceId, loadModels]);
  
  return {
    availableModels,
    isLoading,
    isSpaceConfig: !!spaceId,
    spaceId,
    config: targetConfig
  };
}

/**
 * Simplified hook that uses the active config context
 */
export function useActiveConfigModels() {
  return useConfigModels();
}