'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useAppStateStore } from '@/lib/stores/appStateStore';
import { useConfigsStore } from '@/lib/stores/configsStore';
import { useToast } from '@/components/hooks/use-toast';
import { Config as StoreConfig } from '@/lib/stores/configsStore'; // Using store Config type
import { Message } from '@/types/message';

// Helper for development-only logging
const logDebug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG][AppDataLoader] ${message}`, ...args);
  }
};

// Define expected API response structures
interface ChatApiResponse {
  id: string;
  title?: string;
  configId: string;
  messages?: Message[];
}


// Use the store Config type directly - no need to redefine fields
type ConfigApiResponse = StoreConfig;
type ShareConfigApiResponse = StoreConfig;

// Added for Preview Config API response
type PreviewConfigApiResponse = StoreConfig;

export function AppDataLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const { toast } = useToast();
  
  // Get actions from app state store
  const actions = useAppStateStore(state => state.actions);
  const { currentView, isLoadingViewData } = useAppStateStore();
  
  // Get configsStore actions
  const setConfig = useConfigsStore(state => state.setConfig);
  const setActiveConfig = useConfigsStore(state => state.setActiveConfig);

  // Track previous values to detect changes
  const previousView = useRef<string | null>(null);
  const previousConfigId = useRef<string | null>(null);
  const previousChatId = useRef<string | null>(null);

  // Effect 1: Update view state based on path changes
  useEffect(() => {
    logDebug(`Pathname or params changed: ${pathname}`);
    // handlePathChange now determines if state needs update and returns relevant IDs
    actions.handlePathChange(pathname, params || {});
  }, [pathname, params, actions]);

  // Effect 2: Fetch data based on specific changes
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component
    
    // Use reactive state instead of getState() to ensure we have the latest
    logDebug(`Effect 2 running. Current state:`, {
      currentView,
      isLoadingViewData,
      pathname,
      timestamp: new Date().toISOString()
    });

    // Determine required IDs based on the current path
    const { configId, chatId, shareId, templateId } = actions.determineViewFromPath(pathname, params || {});

    // Detect what changed
    const viewChanged = previousView.current !== currentView;
    const configIdChanged = previousConfigId.current !== configId;
    const chatIdChanged = previousChatId.current !== chatId;
    
    // Check if this is initial load (previous values are null)
    const isInitialLoad = previousView.current === null;

    logDebug(`Change detection:`, {
      viewChanged,
      configIdChanged,
      chatIdChanged,
      isInitialLoad,
      previousView: previousView.current,
      currentView: currentView,
      previousConfigId: previousConfigId.current,
      currentConfigId: configId,
      previousChatId: previousChatId.current,
      currentChatId: chatId
    });

    const fetchData = async () => {
      if (!isMounted) return; // Exit if unmounted during async operation
      logDebug(`Running fetchData effect. View: ${currentView}, configId: ${configId}, chatId: ${chatId}, shareId: ${shareId}, templateId: ${templateId}`);
      actions.setLoading(true);

      let fetchedConfigData: StoreConfig | null = null;
      let fetchedChatData: { id: string, title?: string, configId: string, configTitle?: string } | null = null;

      try {
        // --- Fetch Config Data ---
        if ((currentView === 'designer' || currentView === 'chat') && configId) {
          logDebug(`Fetching config data for ID: ${configId}`);
          const res = await fetch(`/api/configs/${configId}`);
          if (!res.ok) throw new Error(`Failed to fetch config ${configId}`);
          const configData: ConfigApiResponse = await res.json();
          fetchedConfigData = configData; // Use the response directly
          logDebug(`Fetched config:`, fetchedConfigData);
        } else if (currentView === 'share' && shareId) {
           logDebug(`Fetching config data for Share ID: ${shareId}`);
           const res = await fetch(`/api/shares/${shareId}/config`);
           if (!res.ok) throw new Error(`Failed to fetch config for share ${shareId}`);
           const shareConfigData: ShareConfigApiResponse = await res.json();
           fetchedConfigData = shareConfigData; // Use the response directly
           logDebug(`Fetched share config:`, fetchedConfigData);
        } else if (currentView === 'preview' && templateId) { // Added for preview
          logDebug(`Fetching config data for Template ID: ${templateId}`);
          const res = await fetch(`/api/preview/${templateId}/config`);
          if (!res.ok) throw new Error(`Failed to fetch config for template ${templateId}`);
          const previewConfigData: PreviewConfigApiResponse = await res.json();
          fetchedConfigData = previewConfigData;
          logDebug(`Fetched preview config:`, fetchedConfigData);
        } else {
           logDebug(`Skipping config fetch. View: ${currentView}, configId: ${configId}, shareId: ${shareId}, templateId: ${templateId}`);
        }

        // --- Fetch Chat Data ---
        const currentConfigId = configId;
        if (currentView === 'chat' && chatId && chatId !== 'new' && currentConfigId) {
          logDebug(`Fetching chat data for ID: ${chatId}`);
          const res = await fetch(`/api/chats/${currentConfigId}/chat/${chatId}`);
          if (!res.ok) throw new Error(`Failed to fetch chat ${chatId}`);
          const chatData: ChatApiResponse = await res.json();

          // *** Explicitly add configTitle here ***
          // Get title from the config we just fetched OR from existing state if fetch was skipped
          const state = useAppStateStore.getState();
          const configTitleForChat = fetchedConfigData?.title || state.config?.title;
          if (!configTitleForChat) {
             // This might happen if config fetch failed or state was cleared unexpectedly
             logDebug("Config title missing when preparing chat data for TitleBar");
          }

          fetchedChatData = {
            id: chatData.id,
            title: chatData.title || `Chat ${chatData.id.substring(0, 4)}`,
            configId: chatData.configId,
            configTitle: configTitleForChat // Add the config title
          };
          logDebug(`Fetched chat (with config title):`, fetchedChatData);

        } else {
           logDebug(`Skipping chat fetch. View: ${currentView}, chatId: ${chatId}`);
        }

        if (!isMounted) return; // Check again before setting state

        // --- Update State ---
        logDebug(`[UpdateState] Before updates - Config:`, useAppStateStore.getState().config, `Chat:`, useAppStateStore.getState().chat);

        if (fetchedConfigData) {
           logDebug(`[UpdateState] Calling setConfig with:`, fetchedConfigData);
           
           // Update both app state and configs store
           actions.setConfig(fetchedConfigData);
           setConfig(fetchedConfigData);
           setActiveConfig(fetchedConfigData.id);
           
           logDebug(`[UpdateState] After setConfig - AppState Config:`, useAppStateStore.getState().config);
           logDebug(`[UpdateState] After setConfig - ConfigsStore has ${fetchedConfigData.rounds?.length || 0} rounds`);
        }
        // Handle "New Chat" title explicitly
        if (currentView === 'chat' && chatId === 'new') {
            const newChatState = { id: 'new', title: 'New Chat', configId: configId };
            logDebug(`[UpdateState] Determined newChatState:`, newChatState);
            actions.setChat(newChatState);
            logDebug(`[UpdateState] After setChat (new) - Chat:`, useAppStateStore.getState().chat);
        // Only set fetchedChatData if it was actually fetched (i.e., not for 'share' view here)
        } else if (fetchedChatData && currentView !== 'share' && currentView !== 'preview') {
             logDebug(`[UpdateState] Calling setChat with fetched data:`, fetchedChatData);
             actions.setChat(fetchedChatData);
             logDebug(`[UpdateState] After setChat (fetched) - Chat:`, useAppStateStore.getState().chat);
        }

        // For share and preview views, the chat title often comes from the config/template title itself.
        // PreviewView and ShareView already set their chat specific title (from template.title or share.chat.title).
        // Here, we ensure that for share/preview, if we fetched a config, its title is used for the chat state's configTitle.
        // The PreviewView/ShareView will later refine this with the specific chat/template title.
        if ((currentView === 'share' || currentView === 'preview') && fetchedConfigData) {
          const placeholderChatId = currentView === 'share' ? shareId : templateId; 
          
          let initialChatTitle: string | undefined;
          if (currentView === 'share') {
            // For share, using the fetched config title as an initial chat title might be acceptable 
            // if the actual shared chat title isn't immediately available from another source for AppDataLoader.
            // However, ShareView will eventually set the correct one.
            // For consistency and to rely on ShareView to set the final title, we can also set it to undefined here.
            initialChatTitle = undefined; // Or fetchedConfigData.title if preferred as an initial placeholder for share.
          } else { // For 'preview' view
            initialChatTitle = undefined; // Ensure template title is not prematurely set to config title
          }

          if(fetchedConfigData.id && placeholderChatId) {
            const placeholderChat = {
              id: placeholderChatId, 
              title: initialChatTitle, // Set to undefined for preview, ShareView/PreviewView will provide actual title
              configId: fetchedConfigData.id,
              configTitle: fetchedConfigData.title // This is the Design/Config Title
            };
            logDebug(`[UpdateState] Calling setChat for ${currentView} view with placeholder:`, placeholderChat);
            actions.setChat(placeholderChat);
            logDebug(`[UpdateState] After setChat (${currentView}) - Chat:`, useAppStateStore.getState().chat);
          } else {
            logDebug(`[UpdateState] Skipping setChat for ${currentView} as fetchedConfigData.id or placeholderChatId is missing.`);
          }
        }

      } catch (error) {
        console.error('[AppDataLoader] Error fetching view data:', error);
        if (isMounted) {
            toast({
            title: 'Error loading data',
            description: error instanceof Error ? error.message : 'Could not load necessary information.',
            variant: 'destructive',
            });
        }
      } finally {
         if (isMounted) {
            logDebug(`Fetch data finished. Current state - Config:`, useAppStateStore.getState().config, `Chat:`, useAppStateStore.getState().chat, `Loading:`, useAppStateStore.getState().isLoadingViewData);
            logDebug(`Fetch data finished. Setting loading false.`);
            actions.setLoading(false);
         }
      }
    };

    // --- Determine if fetch is needed based on the 3 conditions ---
    let shouldFetch = false;
    
    logDebug(`Checking fetch conditions for view: ${currentView}`);
    
    if (currentView === 'loading' || currentView === 'dashboard' || currentView === 'unknown') {
      // Never fetch for these views
      logDebug(`View is ${currentView}, no fetch needed`);
      shouldFetch = false;
    } else if (isInitialLoad) {
      // Initial load of a view that needs data
      logDebug(`Initial load of ${currentView} view, will fetch data`);
      shouldFetch = true;
    } else if (viewChanged) {
      // Condition 1: View changed to a view that needs data
      logDebug(`View changed from ${previousView.current} to ${currentView}, will fetch data`);
      shouldFetch = true;
    } else if (currentView === 'designer' && configIdChanged && configId) {
      // Condition 2: configId changed in designer view
      logDebug(`ConfigId changed in designer view, will fetch data`);
      shouldFetch = true;
    } else if ((currentView === 'chat' || currentView === 'share' || currentView === 'preview') && chatIdChanged) {
      // Condition 3: chatId changed in chat/share/preview view
      // For share/preview, chatId might actually be shareId or templateId
      logDebug(`ChatId changed in ${currentView} view, will fetch data`);
      shouldFetch = true;
    } else {
      logDebug(`No fetch conditions met`);
    }

    logDebug(`Final shouldFetch decision: ${shouldFetch}`);

    // Update previous values for next comparison
    previousView.current = currentView;
    previousConfigId.current = configId || null;
    previousChatId.current = chatId || null;

    if (shouldFetch) {
      logDebug(`Triggering fetchData`);
      fetchData();
    } else {
      // If no fetch is needed, ensure loading is set to false.
      if (isLoadingViewData) {
         logDebug(`No fetch needed, setting loading false.`);
         actions.setLoading(false);
      }
    }

    return () => {
        isMounted = false; // Cleanup function to prevent state updates after unmount
        logDebug("AppDataLoader unmounting or dependencies changed.");
    };

  // Dependencies: React to changes in view identified by the store, and path/params for ID extraction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, pathname, params, actions, toast]); // Removed isLoadingViewData from dependencies to avoid loops

  return <>{children}</>;
}