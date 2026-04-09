'use client'

import { useEffect, useState } from 'react';
import { useAppStateStore } from '@/lib/stores/appStateStore';
import { useConfigsStore, Config as StoreConfig } from '@/lib/stores/configsStore';
import { useChatProgressStore } from '@/lib/stores/chatProgressStore';
import { useChatAgentStore } from '@/lib/stores/chatAgentStore';
import { useChatMessagesStore } from '@/lib/stores/chatMessagesStore';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/hooks/use-toast';
import { Message } from '@/types/message';
import { loadShareConfig } from '../services/shareService';
import { Round } from '@/types/config-round';
import { Config as TypedConfig, ChatRound as TypedChatRound } from '@/lib/schemas/prisma-typed';
import { AgentService } from '@/lib/services/AgentService';
import { logDebug } from '@/lib/utils/debug';
import { filterDisplayMessages } from '@/lib/utils/messages';

interface ShareDataLoaderProps {
  children: React.ReactNode;
  shareId: string;
}

export function ShareDataLoader({ children, shareId }: ShareDataLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const setConfig = useAppStateStore(state => state.actions.setConfig);
  const setChat = useAppStateStore(state => state.actions.setChat);
  const setConfigStore = useConfigsStore(state => state.setConfig);
  const setActiveConfig = useConfigsStore(state => state.setActiveConfig);
  const initChat = useChatProgressStore(state => state.initChat);
  const setAgents = useChatAgentStore(state => state.setAgents);
  const setMessages = useChatMessagesStore(state => state.setMessages);

  useEffect(() => {
    async function loadAllShareData() {
      setIsLoading(true);
      const clearPreviousMessages = useChatMessagesStore.getState().clearMessages;
      clearPreviousMessages();
      try {
        // 1. Fetch share data and config in parallel
        const [shareRes, config] = await Promise.all([
          fetch(`/api/shares/${shareId}`),
          loadShareConfig(shareId)
        ]);

        if (!shareRes.ok) throw new Error(`Failed to fetch share: ${shareRes.status} ${await shareRes.text()}`);
        const shareData = await shareRes.json();
        
        // Check if share exists in the response
        if (!shareData.share) {
          throw new Error('Share data is missing from response');
        }
        
        const share = shareData.share;

        if (!share.isActive) throw new Error('Share is not active');

        // 2. Set config in both app state and configs store
        // Cast raw Prisma result (JsonValue fields) to typed overlay
        const typedConfig = config as unknown as TypedConfig;
        setConfig(typedConfig as unknown as StoreConfig);
        
        // Load agents from the share first
        const agents = await AgentService.getShareAgentsViaApi(shareId);
        setAgents(agents);
        
        // Transform rounds to include participants as expected by Round type
        // Cast raw Prisma rounds (JsonValue fields) to typed overlay
        const typedRounds = config.rounds as unknown as (TypedChatRound & { participants?: Array<{ id: string }> })[];
        const transformedRounds = typedRounds.map(round => ({
          ...round,
          participants: agents.filter(agent =>
            round.participants?.some((p: { id: string }) => p.id === agent.id)
          ),
        })) as unknown as Round[];
        
        setConfigStore({
          id: typedConfig.id,
          title: typedConfig.title,
          rounds: transformedRounds,
          projects: config.projects || [],
          chatInstructions: typedConfig.chatInstructions || undefined,
          examplePrompts: typedConfig.examplePrompts || [],
          createdAt: new Date(typedConfig.createdAt),
          lastUpdatedAt: new Date(typedConfig.lastUpdatedAt)
        });
        setActiveConfig(typedConfig.id);

        // 3. Set messages
        const messages = (shareData.messages || []) as Message[];
        const filteredMessages = filterDisplayMessages(messages);
        setMessages(filteredMessages);

        // 4. Set chat and initialize
        setChat({
          id: share.chatId,
          title: share.chat.title || 'Shared Chat',
          configId: share.chat.configId,
          configTitle: typedConfig.title,
        });

        // Note: rounds are now handled via configsStore, no need to set them separately
        logDebug('ShareDataLoader', `Share loaded with ${typedRounds?.length || 0} rounds`);
        
        initChat(share.chatId);
      } catch (error) {
        toast({
          title: 'Error loading share',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    if (shareId) loadAllShareData();
  }, [shareId, setConfig, setChat, setConfigStore, setActiveConfig, initChat, setAgents, setMessages, toast]);

  if (isLoading) {
    return <LoadingSpinner message="Loading shared chat..." />;
  }
  return <>{children}</>;
} 