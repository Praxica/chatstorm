'use client'

import { useEffect, useState } from 'react';
import { useAppStateStore } from '@/lib/stores/appStateStore';
import { useChatProgressStore } from '@/lib/stores/chatProgressStore';
import { useChatAgentStore } from '@/lib/stores/chatAgentStore';
import { useChatMessagesStore } from '@/lib/stores/chatMessagesStore';
import { useConfigsStore } from '@/lib/stores/configsStore';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/hooks/use-toast';
import { Round } from '@/types/config-round';
import { MessageService } from '@/lib/services/MessageService';
import { AgentService } from '@/lib/services/AgentService';
import { TemplateService } from '@/lib/services/TemplateService';
import { logDebug } from '@/lib/utils/debug';

interface PreviewDataLoaderProps {
  children: React.ReactNode;
  templateId: string;
}

export function PreviewDataLoader({ children, templateId }: PreviewDataLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const setConfig = useAppStateStore(state => state.actions.setConfig);
  const setChat = useAppStateStore(state => state.actions.setChat);
  const initChat = useChatProgressStore(state => state.initChat);
  const setAgents = useChatAgentStore(state => state.setAgents);
  const setMessages = useChatMessagesStore(state => state.setMessages);
  const updateConfig = useConfigsStore(state => state.updateConfig);

  useEffect(() => {
    async function loadAllPreviewData() {
      setIsLoading(true);
      const clearPreviousMessages = useChatMessagesStore.getState().clearMessages;
      clearPreviousMessages();
      try {
        // 1. Fetch template and config in parallel
        const [template, config] = await Promise.all([
          TemplateService.getTemplate(templateId),
          TemplateService.getTemplateConfig(templateId)
        ]);
        logDebug('PreviewDataLoader', 'Fetched template data:', template);

        // 2. Set config
        setConfig(config);

        // 3. Fetch messages and agents in parallel
        const [rawMessages, agents] = await Promise.all([
          MessageService.getTemplateMessagesViaApi(templateId),
          AgentService.getTemplateAgentsViaApi(templateId)
        ]);

        // Messages are already in UIMessage format with parts
        // Just filter out system messages
        const filteredMessages = rawMessages.filter((msg: any) => {
          // Extract text content from parts
          const textPart = msg.parts?.find((p: any) => p?.type === 'text');
          const content = textPart?.text || '';

          // Filter out "next agent" continuation messages
          if (content === 'next agent') {
            return false;
          }

          // Filter out tool-only messages
          if (msg.role === 'assistant' && (!content || content.trim() === '')) {
            return false;
          }

          return true;
        });

        setMessages(filteredMessages);
        setAgents(agents);

        // 4. Set chat and rounds
        setChat({
          id: template.previewChatId,
          title: template.title,
          configId: template.configId,
          configTitle: config.title,
        });

        // Transform rounds to include participants
        const transformedRounds: Round[] = config.rounds.map(round => ({
          ...round,
          participants: agents.filter(agent => 
            round.participants?.some(p => p.id === agent.id)
          ),
        }));

        // Update the config with transformed rounds
        updateConfig(config.id, { rounds: transformedRounds });
        initChat(template.previewChatId);
      } catch (error) {
        toast({
          title: 'Error loading preview',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    if (templateId) loadAllPreviewData();
  }, [templateId, setConfig, setChat, initChat, setAgents, setMessages, toast, updateConfig]);

  if (isLoading) {
    return <LoadingSpinner message="Loading preview..." />;
  }
  return <>{children}</>;
} 