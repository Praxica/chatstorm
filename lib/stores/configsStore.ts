import { create } from 'zustand';
import { type Round } from '@/types/config-round';
import { useMemo } from 'react';
import { type ConfigUI } from '@/lib/schemas/config';
import { useChatProgressStore } from './chatProgressStore';
import { createInitialProgress } from '../types/chat-progress';

// Re-export so existing consumers of `Config` from this file continue working.
// ConfigUI is the canonical definition in lib/schemas/config.ts.
export type Config = ConfigUI;

interface ConfigsStore {
  configs: Config[];
  activeConfig: Config | null;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  hasStartedLoading: boolean;
  loadConfigs: (spaceId?: string) => Promise<void>;
  setConfigs: (configs: Config[]) => void;
  addConfig: (config: Config) => void;
  updateConfig: (configId: string, updates: Partial<Config>) => void;
  setActiveConfig: (configId: string | null) => void;
  deleteConfig: (id: string) => void;
  setConfig: (config: Config) => void;

  // Round management utilities
  findRoundById: (configId: string, roundId: string) => Round | undefined;
  getRoundBySequence: (configId: string, sequence: number) => Round | undefined;
  getNextRound: (configId: string, currentRoundId: string) => Round | undefined;
  addRound: (configId: string, round: Round) => Promise<void>;
  setRound: (configId: string, round: Round) => void;
  updateRound: (configId: string, roundId: string, updates: Partial<Round>) => void;
  deleteRound: (configId: string, roundId: string) => void;
  reorderRounds: (configId: string, roundIds: string[]) => void;

  // Helper functions
  findActiveRoundById: (roundId: string) => Round | undefined;
  getRounds: (configId: string) => Round[];
  getActiveConfigRounds: () => Round[];
}

export const useConfigsStore = create<ConfigsStore>((set, get) => ({
  configs: [],
  activeConfig: null,
  isLoading: false,
  hasLoadedOnce: false,
  hasStartedLoading: false,
  loadConfigs: async (spaceId?: string) => {
    set({ isLoading: true, hasStartedLoading: true });
    try {
      const url = spaceId ? `/api/configs?spaceId=${spaceId}` : '/api/configs';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch configs');
      }
      const configsData = await response.json();
      const configsWithDates = configsData.map((config: any) => ({
        ...config,
        createdAt: new Date(config.createdAt),
        lastUpdatedAt: new Date(config.lastUpdatedAt)
      }));
      set({ configs: configsWithDates, isLoading: false, hasLoadedOnce: true });
    } catch (error) {
      console.error('Error loading configs:', error);
      set({ isLoading: false, hasLoadedOnce: true });
      // Optionally handle the error in the UI
    }
  },
  setConfigs: (configs) => set({ configs }),
  addConfig: (config) => set((state) => ({ 
    configs: [config, ...state.configs] 
  })),
  updateConfig: (configId, updates) => set((state) => {
    const updatedConfigs = state.configs.map(config => 
      config.id === configId ? { ...config, ...updates } : config
    );
    
    // If we're updating the active config, update that too
    const updatedActiveConfig = state.activeConfig?.id === configId
      ? { ...state.activeConfig, ...updates }
      : state.activeConfig;
    
    return {
      configs: updatedConfigs,
      activeConfig: updatedActiveConfig
    };
  }),
  setActiveConfig: (configId) => set(state => ({
    activeConfig: configId ? state.configs.find(c => c.id === configId) || null : null
  })),
  deleteConfig: (id) => set((state) => ({
    configs: state.configs.filter(config => config.id !== id),
    activeConfig: null
  })),
  setConfig: (config) => set((state) => {
    const existingConfigIndex = state.configs.findIndex(c => c.id === config.id);
    let updatedConfigs;
    
    if (existingConfigIndex >= 0) {
      // Update existing config
      updatedConfigs = state.configs.map(c => c.id === config.id ? config : c);
    } else {
      // Add new config
      updatedConfigs = [config, ...state.configs];
    }
    
    return {
      configs: updatedConfigs,
      activeConfig: state.activeConfig?.id === config.id ? config : state.activeConfig
    };
  }),
  
  // Round management utilities
  getRounds: (configId) => {
    const state = get();
    const config = state.configs.find(c => c.id === configId) || 
                   (state.activeConfig?.id === configId ? state.activeConfig : null);
    return config?.rounds || [];
  },
  
  findRoundById: (configId, roundId) => {
    const rounds = get().getRounds(configId);
    return rounds.find(r => r.id === roundId);
  },
  
  getRoundBySequence: (configId, sequence) => {
    const rounds = get().getRounds(configId);
    return rounds.find(r => r.sequence === sequence) || rounds[sequence];
  },
  
  getNextRound: (configId, currentRoundId) => {
    const rounds = get().getRounds(configId);
    const currentIndex = rounds.findIndex(r => r.id === currentRoundId);
    
    if (currentIndex === -1) {
      return rounds[0]; // Return first round if current not found
    }
    
    // If we're at the last round, wrap around to the first round
    if (currentIndex >= rounds.length - 1) {
      return rounds[0];
    }
    
    // Return the next round in sequence
    return rounds[currentIndex + 1];
  },
  
  addRound: async (configId, round) => {
    // Transform round data for API (participants should be array of IDs)
    const roundData: any = {
      ...round,
      participants: round.participants.map(p => p.id)
    };

    // Ensure required defaults if missing
    if (!roundData.depth) {
      roundData.depth = 'medium';
    }
    if (!roundData.lengthType) {
      roundData.lengthType = 'rounds';
    }
    if (typeof roundData.lengthNumber !== 'number') {
      roundData.lengthNumber = 3;
    }
    if (typeof roundData.lengthRounds !== 'number') {
      roundData.lengthRounds = 1;
    }
    if (!roundData.participantOrder) {
      roundData.participantOrder = 'default';
    }
    if (!roundData.transition) {
      roundData.transition = 'user';
    }

    // Remove empty icon and instructions
    if (!roundData.icon || roundData.icon === '') {
      delete roundData.icon;
    }
    if (!roundData.instructions || roundData.instructions === '') {
      delete roundData.instructions;
    }

    // Make API call first
    const response = await fetch(`/api/configs/${configId}/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roundData)
    });

    if (!response.ok) {
      throw new Error('Failed to create round');
    }

    const createdRound = await response.json();

    // Only update local state after successful API response
    get().setRound(configId, createdRound);

    return createdRound;
  },

  // Internal method to just update the store (used when API call is made externally)
  setRound: (configId, round) => set((state) => {
    const config = state.configs.find(c => c.id === configId);
    const isFirstRound = config?.rounds.length === 0;

    const updatedConfigs = state.configs.map(config => {
      if (config.id === configId) {
        return {
          ...config,
          rounds: [...config.rounds, round]
        };
      }
      return config;
    });

    // Update active config if it matches
    const updatedActiveConfig = state.activeConfig?.id === configId
      ? { ...state.activeConfig, rounds: [...state.activeConfig.rounds, round] }
      : state.activeConfig;

    // If this is the first round being added and there's an active chat,
    // initialize the progress store with this round
    if (isFirstRound) {
      const progressStore = useChatProgressStore.getState();

      // Only initialize if there's a current chat and no progress yet
      if (progressStore.currentChatId && !progressStore.progress) {
        const initialProgress = createInitialProgress(round.id, 'user');
        progressStore.setProgress(round.id, initialProgress);
      }
    }

    return {
      configs: updatedConfigs,
      activeConfig: updatedActiveConfig
    };
  }),
  
  updateRound: (configId, roundId, updates) => set((state) => {
    const updatedConfigs = state.configs.map(config => {
      if (config.id === configId) {
        return {
          ...config,
          rounds: config.rounds.map(round => 
            round.id === roundId ? { ...round, ...updates } : round
          )
        };
      }
      return config;
    });
    
    // Update active config if it matches
    const updatedActiveConfig = state.activeConfig?.id === configId
      ? {
          ...state.activeConfig,
          rounds: state.activeConfig.rounds.map(round => 
            round.id === roundId ? { ...round, ...updates } : round
          )
        }
      : state.activeConfig;
    
    return {
      configs: updatedConfigs,
      activeConfig: updatedActiveConfig
    };
  }),
  
  deleteRound: (configId, roundId) => set((state) => {
    const updatedConfigs = state.configs.map(config => {
      if (config.id === configId) {
        return {
          ...config,
          rounds: config.rounds.filter(round => round.id !== roundId)
        };
      }
      return config;
    });
    
    // Update active config if it matches
    const updatedActiveConfig = state.activeConfig?.id === configId
      ? {
          ...state.activeConfig,
          rounds: state.activeConfig.rounds.filter(round => round.id !== roundId)
        }
      : state.activeConfig;
    
    return {
      configs: updatedConfigs,
      activeConfig: updatedActiveConfig
    };
  }),
  
  reorderRounds: (configId, roundIds) => set((state) => {
    const config = state.configs.find(c => c.id === configId);
    if (!config) return state;
    
    // Reorder rounds based on the provided roundIds array
    const reorderedRounds = roundIds.map(id => 
      config.rounds.find(round => round.id === id)
    ).filter(Boolean) as Round[];
    
    const updatedConfigs = state.configs.map(c => 
      c.id === configId ? { ...c, rounds: reorderedRounds } : c
    );
    
    // Update active config if it matches
    const updatedActiveConfig = state.activeConfig?.id === configId
      ? { ...state.activeConfig, rounds: reorderedRounds }
      : state.activeConfig;
    
    return {
      configs: updatedConfigs,
      activeConfig: updatedActiveConfig
    };
  }),
  
  // Helper functions for active config
  getActiveConfigRounds: () => {
    const state = get();
    return state.activeConfig?.rounds || [];
  },
  
  findActiveRoundById: (roundId) => {
    const state = get();
    return state.activeConfig?.rounds.find(r => r.id === roundId);
  }
}));

export const useConfigRounds = (configId: string): Round[] => {
  const rounds = useConfigsStore(
    state => state.configs.find(c => c.id === configId)?.rounds
  );
  return useMemo(() => rounds || [], [rounds]);
}; 