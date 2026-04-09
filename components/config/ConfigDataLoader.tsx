'use client'

import { useEffect, useState } from 'react';
import { useConfigsStore } from '@/lib/stores/configsStore';
import { useChatAgentStore } from '@/lib/stores/chatAgentStore';
import { useModelsStore } from '@/lib/stores/modelsStore';
import { LoadingSpinner } from '../LoadingSpinner';
import { useToast } from '../hooks/use-toast';
import { useAppStateStore } from '@/lib/stores/appStateStore';

interface ConfigDataLoaderProps {
  children: React.ReactNode;
  configId: string;
}

export function ConfigDataLoader({ 
  children, 
  configId 
}: ConfigDataLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { config: globalConfig, isLoadingViewData } = useAppStateStore();
  const setConfigInStore = useConfigsStore(state => state.setConfig);
  const setActiveConfigInStore = useConfigsStore(state => state.setActiveConfig);
  const loadAgents = useChatAgentStore(state => state.loadAgents);
  const loadModels = useModelsStore(state => state.loadModels);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      try {
        await Promise.all([loadAgents(), loadModels(globalConfig?.spaceId ?? undefined)]);
        if (globalConfig && globalConfig.id === configId) {
          setConfigInStore(globalConfig);
          setActiveConfigInStore(configId);
        }
      } catch (error) {
        if (isMounted) {
          toast({ title: "Error loading data", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadAll();
    return () => { isMounted = false; setActiveConfigInStore(null); };
  }, [configId, globalConfig, setConfigInStore, setActiveConfigInStore, loadAgents, loadModels, toast]);

  if (isLoading || isLoadingViewData || !globalConfig || globalConfig.id !== configId) {
    return <LoadingSpinner variant="overlay" message="Loading configuration..." />;
  }

  return <div className="relative h-full w-full">{children}</div>;
} 