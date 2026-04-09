import { create } from 'zustand';
import { Config } from '@/lib/stores/configsStore'; // Use store Config type instead of Prisma
// import { Message } from '@/types/message'; // Assuming Message includes Chat info or create a Chat type

// Defining PartialChat manually as Chat type might not be readily available
type PartialChat = { 
  id: string; 
  title?: string; 
  configId?: string; 
  configTitle?: string; // Added configTitle for share view convenience
}; 

// Added 'preview' to AppView type
type AppView = 'dashboard' | 'designer' | 'chat' | 'share' | 'preview' | 'loading' | 'unknown';

interface AppState {
  currentView: AppView;
  config: Config | null;
  chat: PartialChat | null;
  isLoadingViewData: boolean;
  actions: {
    setView: (view: AppView) => void;
    setConfig: (config: Config | null) => void;
    setChat: (chat: PartialChat | null) => void;
    setLoading: (loading: boolean) => void;
    clearTitles: () => void;
    // Added templateId to return type
    determineViewFromPath: (pathname: string | null, params: Record<string, string | string[] | undefined>) => { view: AppView, configId?: string; chatId?: string; shareId?: string; templateId?: string };
    // Added templateId to return type
    handlePathChange: (pathname: string | null, params: Record<string, string | string[] | undefined>) => { configId?: string; chatId?: string; shareId?: string; templateId?: string };
  };
}

// Separate view determination from state management
const determineView = (pathname: string | null): AppView => {
  if (!pathname) return 'unknown';
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/config/') || pathname.startsWith('/design/')) return 'designer';
  if (pathname.startsWith('/chats/')) {
    console.log('[AppStateStore Debug] Path matches /chats/, setting view to chat. Path:', pathname);
    return 'chat';
  }
  if (pathname.startsWith('/s/') || pathname.startsWith('/share/')) return 'share';
  // Added condition for preview paths
  if (pathname.startsWith('/preview/')) return 'preview';
  return 'unknown';
};

// Separate ID extraction from view determination
const extractIds = (pathname: string | null, params: Record<string, string | string[] | undefined>) => {
  const ids = {
    configId: undefined as string | undefined,
    chatId: undefined as string | undefined,
    shareId: undefined as string | undefined,
    templateId: undefined as string | undefined, // Added templateId
  };

  if (!pathname) return ids;

  if (pathname.startsWith('/config/')) {
    ids.configId = params.id as string;
  } else if (pathname.startsWith('/design/')) {
    ids.configId = params.configId as string;
  } else if (pathname.startsWith('/chats/')) {
    ids.configId = params.configId as string;
    ids.chatId = params.chatId as string;
  } else if (pathname.startsWith('/s/') || pathname.startsWith('/share/')) {
    if (params.shareId) {
      ids.shareId = params.shareId as string;
      if (params.chatId) {
        ids.chatId = params.chatId as string;
      }
    } else if (params.slug && Array.isArray(params.slug)) {
      ids.shareId = params.slug[0];
      ids.chatId = params.slug[2];
    }
  } else if (pathname.startsWith('/preview/')) { // Added condition for preview paths
    ids.templateId = params.templateId as string;
    // For preview, chat and config details will be derived from the template, loaded by AppDataLoader
  }

  return ids;
};

export const useAppStateStore = create<AppState>((set, get) => ({
  currentView: 'loading',
  config: null,
  chat: null,
  isLoadingViewData: true,
  actions: {
    setView: (view) => set({ currentView: view }),
    setConfig: (config) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AppStateStore setConfig] Called with:', {
          config: config ? { id: config.id, title: config.title } : null,
          timestamp: new Date().toISOString(),
          currentView: get().currentView
        });
      }
      
      set((state) => {
        let updatedChat = state.chat;
        if (state.chat && state.chat.id && state.chat.configId === config?.id && config?.title) {
          updatedChat = { 
            ...state.chat,
            configTitle: config.title
          };
        }
        
        const newState = {
          config,
          chat: updatedChat
        };
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[AppStateStore setConfig] Setting state to:', {
            config: newState.config ? { id: newState.config.id, title: newState.config.title } : null,
            chatUpdated: updatedChat !== state.chat,
            timestamp: new Date().toISOString()
          });
        }
        
        return newState;
      });
    },
    setChat: (chat) => set({ chat }),
    setLoading: (loading) => {
      if (process.env.NODE_ENV === 'development') {
        const currentState = get();
        console.log('[AppStateStore setLoading] Called with:', {
          loading,
          timestamp: new Date().toISOString(),
          currentView: currentState.currentView,
          currentConfig: currentState.config ? { id: currentState.config.id, title: currentState.config.title } : null
        });
      }
      set({ isLoadingViewData: loading });
    },
    clearTitles: () => set({ config: null, chat: null }),
    determineViewFromPath: (pathname, params) => {
      const view = determineView(pathname);
      const ids = extractIds(pathname, params);
      return { view, ...ids };
    },
    handlePathChange: (pathname, params) => {
      const view = determineView(pathname);
      // Added templateId to destructuring
      const { configId, chatId, shareId, templateId } = extractIds(pathname, params);
      const currentState = get();

      const viewChanged = currentState.currentView !== view;
      
      let newConfigState = currentState.config;
      let newChatState = currentState.chat;
      let setLoading = false;

      if (viewChanged) {
        switch (view) {
          case 'dashboard':
            newConfigState = null;
            newChatState = null;
            setLoading = false;
            break;
          case 'designer':
            if (currentState.config?.id !== configId) {
              newConfigState = null;
              setLoading = true;
            }
            newChatState = null;
            break;
          case 'chat':
            if (currentState.config?.id !== configId) {
              newConfigState = null;
              newChatState = null;
              setLoading = true;
            } else if (chatId === 'new') {
              newChatState = { id: 'new', title: 'New Chat', configId };
              setLoading = false;
            } else if (currentState.chat?.id !== chatId) {
              newChatState = null;
              setLoading = true;
            }
            break;
          case 'share': // Logic for share (and preview will be similar)
            newConfigState = null; // Config title comes from /api/shares/[shareId]/config
            // Chat title comes from the share data itself initially, then refined if possible
            if (currentState.chat?.id !== chatId) { // Or if shareId changes for a share view
              newChatState = null;
              setLoading = true;
            }
            break;
          case 'preview': // Added case for preview
            newConfigState = null; // Config title comes from /api/preview/[templateId]/config
            // Chat title (template title) comes from template data initially
            // We don't have a separate `chatId` in the URL for previews like we might for shares,
            // the relevant `previewChatId` is part of the template data.
            // So, we mainly check if the templateId itself has changed or if view just changed to preview.
            // For simplicity, if view changed to preview, or if the current templateId in state (if we stored it) is different,
            // we reset and load.
            // Since we don't store templateId directly in top-level state (it's part of `preview` object in `PreviewView`),
            // we will rely on AppDataLoader to fetch based on `templateId` from params.
            // We reset chat here, as AppDataLoader will populate it based on template details.
            newChatState = null;
            setLoading = true; // Always set loading true when switching to preview to fetch template and config.
            break;
          default:
            newConfigState = null;
            newChatState = null;
            setLoading = false;
        }
      } else { // Same view, handle state updates based on ID changes
        switch (view) {
          case 'chat':
            if (chatId === 'new' && currentState.chat?.id !== 'new') {
              newChatState = { id: 'new', title: 'New Chat', configId };
              setLoading = false;
            } else if (chatId !== 'new' && currentState.chat?.id !== chatId) {
              newChatState = null;
              setLoading = true;
            }
            break;
          case 'designer':
            if (currentState.config?.id !== configId) {
              newConfigState = null;
              setLoading = true;
            }
            break;
          case 'share':
            if (currentState.chat?.id !== chatId) { // Or if shareId changes
              newChatState = null;
              setLoading = true;
            }
            break;
          case 'preview': // Added case for preview
            // If the view is already 'preview', but the templateId in the URL changes (not directly stored in top-level state for now)
            // This implies AppDataLoader needs to refetch. For now, handlePathChange mainly sets the view.
            // AppDataLoader is responsible for reacting to ID changes from params.
            // If we *were* storing templateId in chat/config object for preview, we'd check it here.
            // For now, if the view is preview, and AppDataLoader sees a new templateId, it will reload.
            // This block can be enhanced if we add templateId to global state for finer control.
            // The main thing is that isLoadingViewData should be true if AppDataLoader will fetch.
            // The current logic in AppDataLoader will trigger a fetch if templateId changes in params.
            break;
        }
      }

      const stateChanged = currentState.currentView !== view ||
                          currentState.config?.id !== newConfigState?.id ||
                          currentState.config?.title !== newConfigState?.title ||
                          currentState.chat?.id !== newChatState?.id ||
                          currentState.chat?.title !== newChatState?.title ||
                          currentState.isLoadingViewData !== setLoading;

      if (stateChanged) {
        set({
          currentView: view,
          config: newConfigState,
          chat: newChatState,
          isLoadingViewData: setLoading
        });
        console.log(`[AppStateStore] State updated. New State - View: ${view}, Config: ${JSON.stringify(newConfigState)}, Chat: ${JSON.stringify(newChatState)}, Loading: ${setLoading}`);
      } else {
        console.log(`[AppStateStore] No state change needed.`);
      }
      // Return all extracted IDs
      return { configId, chatId, shareId, templateId };
    }
  }
}));

// Export actions separately for easier usage in non-hook contexts if needed
export const appStateActions = useAppStateStore.getState().actions; 