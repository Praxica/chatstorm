import { create } from 'zustand';
import { SpaceService, SpaceWithMembers } from '@/lib/services/SpaceService';

interface SpacesStore {
  spaces: SpaceWithMembers[];
  isLoading: boolean;
  error: string | null;
  hasSpaces: boolean;
  loadSpaces: () => Promise<void>;
  setSpaces: (spaces: SpaceWithMembers[]) => void;
  reset: () => void;
}

export const useSpacesStore = create<SpacesStore>((set, _get) => ({
  spaces: [],
  isLoading: false,
  error: null,
  hasSpaces: false,

  loadSpaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const spaces = await SpaceService.getSpacesViaApi();
      set({ 
        spaces, 
        isLoading: false, 
        hasSpaces: spaces.length > 0,
        error: null 
      });
    } catch (error) {
      console.error('Error loading spaces:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load spaces', 
        isLoading: false,
        hasSpaces: false
      });
    }
  },

  setSpaces: (spaces: SpaceWithMembers[]) => set({ 
    spaces, 
    hasSpaces: spaces.length > 0 
  }),

  reset: () => set({ 
    spaces: [], 
    isLoading: false, 
    error: null,
    hasSpaces: false
  }),
}));