'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { type ChatAgent } from '@/lib/stores/chatAgentStore';
import { type ModelConfig } from '@/lib/utils/models';
import { checkAgentModelAvailability, getModelFallbackDescription, getModelNames } from '@/lib/utils/agent-model-validation';
import { cn } from '@/lib/utils';

interface AgentModelWarningProps {
  agent: ChatAgent;
  availableModels: Record<string, ModelConfig>;
  className?: string;
  compact?: boolean;
}

/**
 * Shows warnings when an agent's selected models aren't available in current context
 */
export function AgentModelWarning({
  agent,
  availableModels,
  className,
  compact = false
}: AgentModelWarningProps) {
  const info = checkAgentModelAvailability(agent, availableModels);
  
  if (!info.hasUnavailableModels) {
    return null;
  }

  const description = getModelFallbackDescription(info, agent.name);
  const unavailableNames = getModelNames(info.unavailableModels, availableModels);

  const isWarning = info.fallbackStrategy === 'complete';

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-1 text-xs",
        isWarning ? "text-amber-600" : "text-blue-600",
        className
      )}>
        {isWarning ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <Info className="h-3 w-3" />
        )}
        <span>Model unavailable</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-md border p-3 text-sm",
      isWarning 
        ? "bg-amber-50 border-amber-200 text-amber-800" 
        : "bg-blue-50 border-blue-200 text-blue-800",
      className
    )}>
      <div className="flex items-start gap-2">
        {isWarning ? (
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        ) : (
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1">
          <p className="font-medium mb-1">
            {isWarning ? "Model Configuration Issue" : "Partial Model Availability"}
          </p>
          <p className="text-sm opacity-90">
            {description}
          </p>
          {unavailableNames.length > 0 && (
            <p className="text-xs mt-2 opacity-80">
              Unavailable: {unavailableNames.join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}