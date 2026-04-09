import { create } from 'zustand'
import type { Round } from '@/types/config-round'
import { ChatProgress, createInitialProgress } from '@/lib/types/chat-progress'
import { useConfigsStore } from './configsStore'

// Simplified chat state that doesn't track progress per round
type ChatState = {
  currentRoundId: string | null;
}

export interface ChatProgressStore {
  // Chat progress state
  chats: Record<string, ChatState>
  currentChatId: string | null
  currentRoundId: string | null
  progress: ChatProgress | null
  initChat: (chatId: string) => void
  setProgress: (roundId: string, data: Partial<ChatProgress>) => void
  getProgress: () => ChatProgress
  getCurrentRoundId: () => string
  clearChat: () => void
  forceResetState: () => void
  getNextRound: (configId: string) => Round | null
  
  // Helper functions to get rounds from configsStore
  getRounds: (configId: string) => Round[]
  findRoundById: (configId: string, roundId: string) => Round | undefined
  
  // Active round ID for ChatProgress processing
  activeRoundId: string | null
  updateActiveRoundId: (roundId: string) => void
  
  // Message count for triggering ChatProgress processing
  messageCount: number
  updateMessageCount: (count: number) => void
  
  // Global loading state
  isGlobalLoading: boolean
  setGlobalLoading: (isLoading: boolean) => void
}

// Helper for development-only logging
const logDebug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

export const useChatProgressStore = create<ChatProgressStore>((set, get) => ({
  // Chat progress state
  chats: {},
  currentChatId: null,
  currentRoundId: null,
  progress: null,
  
  // Global loading state
  isGlobalLoading: false,
  setGlobalLoading: (isLoading: boolean) => set({ isGlobalLoading: isLoading }),

  // Helper functions to get rounds from configsStore
  getRounds: (configId) => {
    if (!configId) return [];
    return useConfigsStore.getState().getRounds(configId);
  },

  findRoundById: (configId, roundId) => {
    if (!configId) return undefined;
    return useConfigsStore.getState().findRoundById(configId, roundId);
  },

  initChat: (chatId: string) => set((state) => {
    // If transitioning from 'new' to a specific chatId, log for debugging
    if (state.currentChatId === 'new' && chatId !== 'new') {
      logDebug(`Transitioning from 'new' to specific chatId: ${chatId}`);
    }
    
    // If already have this chat ID, just ensure it's current
    if (state.currentChatId === chatId) {
      logDebug(`initChat called with already active chatId: ${chatId}`);
      return state;
    }
    
    logDebug(`Initializing chat: ${chatId}, previous: ${state.currentChatId}`);

    return {
      ...state,
      currentChatId: chatId,
      currentRoundId: null, // Will be set when rounds are available
      progress: null,
      chats: {
        ...state.chats,
        [chatId]: state.chats[chatId] || {
          currentRoundId: null
        }
      }
    };
  }),
  
  setProgress: (roundId: string, data: Partial<ChatProgress>) => set((state) => {
    if (!state.currentChatId) {
      console.error('Chat not initialized');
      return state;
    }

    // Ensure the roundId passed is used consistently
    if (!roundId) {
      console.error('setProgress called without a valid roundId');
      return state;
    }

    // Update the chat's currentRoundId if it's changing
    const chatState = roundId !== state.currentRoundId ? {
      ...(state.chats[state.currentChatId!] || {}), // Use non-null assertion and provide fallback
      currentRoundId: roundId
    } : state.chats[state.currentChatId!];

    // --- Ensure existingProgress and data are objects before merging ---
    let currentProgress = state.progress || createInitialProgress(roundId, 'user');
    let incomingData = data;

    if (typeof currentProgress === 'string') {
      try {
        console.warn('[setProgress Store] Parsing existingProgress from string');
        currentProgress = JSON.parse(currentProgress);
      } catch (e) {
        console.error('[setProgress Store] Failed to parse existingProgress string:', currentProgress, e);
        currentProgress = createInitialProgress(roundId, 'user'); // Fallback
      }
    }
    if (typeof incomingData === 'string') {
      try {
        console.warn('[setProgress Store] Parsing incomingData from string');
        incomingData = JSON.parse(incomingData);
      } catch (e) {
        console.error('[setProgress Store] Failed to parse incomingData string:', incomingData, e);
        incomingData = {}; // Fallback to empty object
      }
    }
    // ------------------------------------------------------------------

    // Construct the updated progress carefully USING the potentially parsed versions
    const existingProgress = currentProgress; // Use potentially parsed version
    const parsedData = incomingData as Partial<ChatProgress>;

    const incomingActive = parsedData.active || { round: { id: roundId }, step: undefined };
    const existingActive = existingProgress.active || { round: { id: roundId }, step: 'user' };
    const incomingActiveRound = incomingActive.round || { id: roundId };
    const existingActiveRound = existingActive.round || { id: roundId };

    const updatedProgress: ChatProgress = {
      ...existingProgress, // Now definitely spreading an object
      ...parsedData,       // Now definitely spreading an object
      active: {
        ...existingActive,
        ...incomingActive, 
        round: {
          ...existingActiveRound,
          ...incomingActiveRound, 
          id: roundId 
        },
        step: incomingActive.step || existingActive.step || 'user' 
      },
      next: {
        ...(existingProgress.next || {}),
        ...(parsedData.next || {})
      }
    };

    return {
      ...state,
      currentRoundId: roundId,
      progress: updatedProgress,
      chats: {
        ...state.chats,
        [state.currentChatId!]: chatState
      }
    };
  }),

  getProgress: () => {
    const state = get();
    
    if (!state.currentChatId) {
      throw new Error('Chat not initialized');
    }

    if (!state.progress && state.currentRoundId) {
      // If no progress exists but we have a round ID, create initial progress
      return createInitialProgress(state.currentRoundId, 'user');
    }
    
    if (!state.progress) {
      throw new Error('No progress available - chat needs to be properly initialized');
    }
    
    return state.progress;
  },

  getCurrentRoundId: () => {
    const state = get();
    
    if (!state.currentChatId) {
      console.log('Chat not initialized');
      return '';
    }

    // If we have progress, use the active round ID from there
    if (state.progress?.active?.round?.id) {
      return state.progress.active.round.id;
    }

    // Otherwise, use the currentRoundId
    return state.currentRoundId || '';
  },

  clearChat: () => set((state) => {
    const chatId = state.currentChatId;
    if (!chatId) return state;

    logDebug(`Clearing chat: ${chatId}`);
    
    const { [chatId]: _, ...rest } = state.chats;
    return {
      ...state,
      chats: rest,
      currentChatId: null,
      currentRoundId: null,
      progress: null
    }
  }),

  // Reset store state
  forceResetState: () => set((state) => {
    logDebug(`Resetting chat progress state`);
    return {
      ...state,
      currentChatId: null,
      currentRoundId: null,
      progress: null
    };
  }),

  getNextRound: (configId) => {
    const currentRoundId = get().getCurrentRoundId();
    
    if (!configId) {
      console.warn('No configId set in chatProgressStore');
      return null;
    }
    
    // Use configsStore to get the next round
    return useConfigsStore.getState().getNextRound(configId, currentRoundId) || null;
  },

  // Active round ID for ChatProgress processing
  activeRoundId: null,
  updateActiveRoundId: (roundId: string) => set(() => ({
    activeRoundId: roundId
  })),

  // Message count for triggering ChatProgress processing
  messageCount: 0,
  updateMessageCount: (count: number) => set(() => ({
    messageCount: count
  })),
})) 