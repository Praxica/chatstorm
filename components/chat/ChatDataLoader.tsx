'use client'

import { useEffect, useState, useCallback } from 'react';
import { useConfigsStore } from '@/lib/stores/configsStore';
import { useChatAgentStore } from '@/lib/stores/chatAgentStore';
import { useChatProgressStore } from '@/lib/stores/chatProgressStore';
import { useChatsStore } from '@/lib/stores/chatsStore';
import { LoadingSpinner } from '../LoadingSpinner';
import { useToast } from "@/components/hooks/use-toast";

// Helper for development-only logging
const logDebug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

interface ChatDataLoaderProps {
  children: React.ReactNode;
  configId: string;
  chatId?: string;
}

export function ChatDataLoader({ 
  children, 
  configId, 
  chatId 
}: ChatDataLoaderProps) {
  // Only load data for existing chats
  return <ExistingChatLoader configId={configId} chatId={chatId}>
    {children}
  </ExistingChatLoader>;
}

function ExistingChatLoader({ 
  children, 
  configId, 
  chatId 
}: { 
  children: React.ReactNode;
  configId: string;
  chatId?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const setConfig = useConfigsStore(state => state.setConfig);
  const setActiveConfig = useConfigsStore(state => state.setActiveConfig);
  
  // Access store functions directly with individual selectors
  const loadAgents = useChatAgentStore(state => state.loadAgents);
  const setAgents = useChatAgentStore(state => state.setAgents);
  const initChat = useChatProgressStore(state => state.initChat);
  const forceResetState = useChatProgressStore(state => state.forceResetState);
  const isGlobalLoading = useChatProgressStore(state => state.isGlobalLoading);
  const setGlobalLoading = useChatProgressStore(state => state.setGlobalLoading);
  const setChats = useChatsStore(state => state.setChats);
  const { toast } = useToast();

  // Handle URL/store synchronization when component mounts or chatId changes
  useEffect(() => {
    const storeCurrentChatId = useChatProgressStore.getState().currentChatId;
    logDebug(`ChatDataLoader URL/Store sync:`, { chatId, storeId: storeCurrentChatId });
    
    // Case 1: URL is 'new' but store has a specific chatId (needs reset)
    if (chatId === 'new' && storeCurrentChatId && storeCurrentChatId !== 'new') {
      logDebug(`URL is /new but store has a specific chatId: ${storeCurrentChatId} - resetting`);
      forceResetState(); 
      initChat('new');
    }
    // Case 2: URL has a specific chatId but store has different or no ID
    else if (chatId && chatId !== 'new' && storeCurrentChatId !== chatId) {
      logDebug(`URL/store mismatch. URL: ${chatId}, Store: ${storeCurrentChatId}`);
      
      // Reset store first if needed to avoid conflicts
      if (storeCurrentChatId) {
        logDebug(`Resetting store before initializing with URL chatId`);
        forceResetState();
      }
      
      // Will initialize with URL chatId after data load
    }
  }, [chatId, forceResetState, initChat]);

  // Memoize the loadAllData function to prevent recreation on each render
  const loadAllData = useCallback(async () => {
    logDebug(`Loading all data for chat:`, { configId, chatId });
    setIsLoading(true);
    
    try {
      // Load config and chats data in parallel
      const [configData, chatsData] = await Promise.all([
        // Fetch config data
        fetch(`/api/configs/${configId}`)
          .then(response => {
            if (!response.ok) throw new Error('Failed to load config data');
            return response.json();
          }),
        // Fetch chats data
        fetch(`/api/chats/${configId}`)
          .then(response => {
            if (!response.ok) throw new Error('Failed to load chats data');
            return response.json();
          })
      ]);

      // Set config in configsStore (includes rounds)
      setConfig({
        ...configData,
        createdAt: new Date(configData.createdAt),
        lastUpdatedAt: new Date(configData.lastUpdatedAt)
      });
      
      // Set as active config
      setActiveConfig(configId);
      
      // Load agents based on context - use chat-specific agents if chatId is provided
      let currentAgents;
      if (chatId && chatId !== 'new') {
        // Load agents specific to this chat (which may include agents from other users)
        const chatAgentsResponse = await fetch(`/api/chats/${configId}/chat/${chatId}/agents`);
        if (!chatAgentsResponse.ok) {
          throw new Error('Failed to load chat-specific agents');
        }
        currentAgents = await chatAgentsResponse.json();
        setAgents(currentAgents);
      } else {
        // Load user's agents for new chats
        await loadAgents();
        currentAgents = useChatAgentStore.getState().agents;
      }
      
      logDebug(`Config loaded with ${configData.rounds?.length || 0} rounds`);
      
      // Set chats
      setChats(chatsData.map((chat: any) => ({
        ...chat,
        createdAt: new Date(chat.createdAt)
      })));

      // Find the active chat
      const activeChat = chatsData.find((chat: any) => chat.id === chatId);
      logDebug(`Found Active chat:`, { found: activeChat?.id, requested: chatId });

      // Synchronize URL and store state
      const storeCurrentChatId = useChatProgressStore.getState().currentChatId;
      
      // Special handling for URL/store mismatch
      if (chatId && chatId !== 'new' && storeCurrentChatId !== chatId) {
        if (activeChat) {
          logDebug(`Syncing store with URL chatId: ${activeChat.id}`);
          
          // Reset store if needed
          if (storeCurrentChatId) {
            forceResetState();
          }
          
          // Initialize with URL chatId
          initChat(activeChat.id);
          
          // Verify store was updated
          if (useChatProgressStore.getState().currentChatId !== activeChat.id) {
            logDebug(`Direct state update needed`);
            useChatProgressStore.setState({ currentChatId: activeChat.id });
          }
        }
      } 
      // Handle case where no mismatch, but need to initialize chat
      else if (activeChat) {
        initChat(activeChat.id);
      } 
      // Handle new chat case
      else if (chatId === 'new' && storeCurrentChatId && storeCurrentChatId !== 'new') {
        logDebug(`URL is /new but store has chatId: ${storeCurrentChatId} - resetting`);
        forceResetState(); 
        initChat('new');
      }

      logDebug('All data loaded successfully in parallel');
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error loading data",
        description: error instanceof Error ? error.message : "Please try refreshing the page",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  }, [configId, setConfig, setActiveConfig, loadAgents, setChats, toast, chatId, initChat, forceResetState, setGlobalLoading, setAgents]);

  // Load ALL data on mount or when dependencies change
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return (
    <div className="relative h-full w-full">
      {(isLoading || isGlobalLoading) ? (
        <LoadingSpinner variant="overlay" message="Loading chat data..." />
      ) : (
        children
      )}
    </div>
  );
}