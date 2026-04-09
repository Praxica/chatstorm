'use client'

import { useEffect, useState } from 'react';
import { useConfigsStore } from '@/lib/stores/configsStore';
import { useChatAgentStore } from '@/lib/stores/chatAgentStore';
import { useProjectStore } from '@/lib/stores/projectStore';
import { useChatsStore } from '@/lib/stores/chatsStore';
import { useModelsStore } from '@/lib/stores/modelsStore';
import { useSpacesStore } from '@/lib/stores/spacesStore';
import { useTemplatesStore } from '@/lib/stores/templatesStore';
import { LoadingSpinner } from './LoadingSpinner';
import { useToast } from './hooks/use-toast';
import { useSpaceSafe } from '@/lib/contexts/SpaceContext';

interface InitialDataLoaderProps {
  children: React.ReactNode;
}

export function InitialDataLoader({ children }: InitialDataLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const loadConfigs = useConfigsStore((state) => state.loadConfigs);
  const loadAgents = useChatAgentStore((state) => state.loadAgents);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const loadChats = useChatsStore((state) => state.loadChats);
  const loadModels = useModelsStore((state) => state.loadModels);
  const loadSpaces = useSpacesStore((state) => state.loadSpaces);
  const { actions: { fetchTemplates, fetchCategories } } = useTemplatesStore();
  const { toast } = useToast();
  
  // Check if we're in a space context
  const spaceContext = useSpaceSafe();
  const spaceId = spaceContext?.space?.id;

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const loadTasks = [
          loadConfigs(spaceId),
          loadAgents(),
          loadProjects(),
          loadChats(spaceId),
          loadModels(spaceId),
          fetchTemplates({ spaceId }),
          fetchCategories(),
        ];

        // Only load spaces if not in a space context (personal dashboard)
        if (!spaceId) {
          loadTasks.push(loadSpaces());
        }
        
        await Promise.all(loadTasks);
      } catch (error) {
        console.error('Error loading initial data:', error instanceof Error ? error.message : 'Unknown error');
        toast({
          title: "Error loading data",
          description: error instanceof Error ? error.message : "Please try refreshing the page",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [loadConfigs, loadAgents, loadProjects, loadChats, loadModels, loadSpaces, fetchTemplates, fetchCategories, toast, spaceId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return children;
} 