import { create } from 'zustand';
import { type ModelConfig } from '@/lib/utils/models';

interface ModelsStore {
  availableModels: Record<string, ModelConfig>;
  isLoading: boolean;
  currentContext: { spaceId?: string } | null;
  loadModels: (spaceId?: string, forceReload?: boolean) => Promise<void>;
  clearModels: () => void;
}

export const useModelsStore = create<ModelsStore>((set, get) => ({
  availableModels: {},
  isLoading: true,
  currentContext: null,
  
  loadModels: async (spaceId?: string, forceReload = false) => {
    const { currentContext, availableModels } = get();
    
    // Check if we need to reload models
    const contextChanged = JSON.stringify(currentContext) !== JSON.stringify({ spaceId });
    const hasModels = Object.keys(availableModels).length > 0;
    
    if (!forceReload && !contextChanged && hasModels) {
      return; // Models already loaded for this context
    }
    
    // Set loading state
    set({ isLoading: true, currentContext: { spaceId } });
    
    try {
      // Use new space-aware models endpoint
      const url = new URL('/api/models', window.location.origin);
      if (spaceId) {
        url.searchParams.set('spaceId', spaceId);
      }
      
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      
      const models = await response.json();
      set({ availableModels: models, isLoading: false });
    } catch (error) {
      console.error('Error loading models:', error);
      set({ isLoading: false, availableModels: {} });
    }
  },
  
  clearModels: () => {
    set({ availableModels: {}, currentContext: null, isLoading: true });
  },
})); 