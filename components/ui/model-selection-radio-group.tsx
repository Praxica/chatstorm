'use client';

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { type ModelConfig } from "@/lib/utils/models";
import { useId } from "react";

interface ModelSelectionRadioGroupProps {
  availableModels: Record<string, ModelConfig>;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  showWarning?: boolean;
  warningMessage?: string;
  className?: string;
  itemClassName?: string;
}

/**
 * Reusable component for selecting a model from available models with provider labels
 */
export function ModelSelectionRadioGroup({
  availableModels,
  selectedModel,
  onModelChange,
  showWarning = false,
  warningMessage = "You must select a model",
  className,
  itemClassName
}: ModelSelectionRadioGroupProps) {
  const instanceId = useId();
  
  const getProviderLabel = (model: ModelConfig) => {
    if (model.isCustom) {
      return "Custom";
    }
    
    // Map provider names to display names
    const providerLabels: Record<string, string> = {
      'openai': 'OpenAI',
      'anthropic': 'Anthropic', 
      'google': 'Google',
      'meta': 'Meta',
      'mistral': 'Mistral',
      'cohere': 'Cohere',
      'xai': 'xAI',
    };
    
    return providerLabels[model.provider] || model.provider;
  };

  const getProviderColor = (model: ModelConfig) => {
    if (model.isCustom) {
      return "bg-purple-100 text-purple-800";
    }
    
    // Color mapping for different providers
    const providerColors: Record<string, string> = {
      'openai': 'bg-green-100 text-green-800',
      'anthropic': 'bg-orange-100 text-orange-800',
      'google': 'bg-blue-100 text-blue-800',
      'meta': 'bg-indigo-100 text-indigo-800',
      'mistral': 'bg-red-100 text-red-800',
      'cohere': 'bg-teal-100 text-teal-800',
      'xai': 'bg-gray-100 text-gray-800',
    };
    
    return providerColors[model.provider] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className={cn("space-y-1", className)}>
      {showWarning && !selectedModel && (
        <div className="py-1.5 px-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 mb-1 text-sm">
          {warningMessage}
        </div>
      )}
      
      <RadioGroup 
        value={selectedModel} 
        onValueChange={onModelChange}
        className="space-y-0"
      >
        {Object.entries(availableModels).map(([modelId, model]) => {
          const elementId = `${instanceId}-${modelId}`;
          return (
            <div
              key={modelId}
              className={cn(
                "flex items-center py-0.5 px-3 hover:bg-muted/50 rounded-md transition-colors",
                itemClassName
              )}
            >
              <RadioGroupItem
                value={modelId}
                id={elementId}
                className="mr-2"
              />
              <label
                htmlFor={elementId}
                className="text-sm font-medium cursor-pointer flex-1 flex items-center gap-2"
              >
                <span>{model.name}</span>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded text-nowrap",
                  getProviderColor(model)
                )}>
                  {getProviderLabel(model)}
                </span>
              </label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}