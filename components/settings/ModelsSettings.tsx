"use client"

import { useState, useEffect, useCallback } from 'react'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { useModelsStore } from '@/lib/stores/modelsStore'
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import CustomModelModal from './CustomModelModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmModal } from "@/components/ui/confirm-modal";

// Helper for development-only logging
const logDebug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ModelsSettings: ${message}`, ...args);
  }
};

type ModelSettingsMode = 'all' | 'include' | 'exclude'

interface ModelSettings {
  mode: ModelSettingsMode
  includedModels: string[]
  excludedModels: string[]
  defaultModel: string | null
}

interface CustomModel {
  id: string; // modelId (provider model name)
  uuid?: string; // DB UUID for custom models
  modelId: string; // provider model name (explicit, always string)
  name: string;
  provider: string;
  baseURL?: string;
}

interface ModelsSettingsProps {
  // For space context
  isSpaceContext?: boolean;
  spaceSlug?: string;
  spaceModelSettings?: any;
  // Custom labels
  labels?: {
    title?: string;
    description?: string;
    saveButton?: string;
  };
}

export default function ModelsSettings({ 
  isSpaceContext = false, 
  spaceSlug, 
  spaceModelSettings,
  labels = {} 
}: ModelsSettingsProps = {}) {
  logDebug('Component rendering...', { isSpaceContext, spaceSlug });
  
  // Initialize settings from props for space context or default for user context
  const [settings, setSettings] = useState<ModelSettings>(
    isSpaceContext && spaceModelSettings ? spaceModelSettings : {
      mode: 'all',
      includedModels: [],
      excludedModels: [],
      defaultModel: null
    }
  )
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const { availableModels, loadModels, isLoading: areModelsLoading } = useModelsStore();
  const [isCustomModelModalOpen, setIsCustomModelModalOpen] = useState(false);
  const [editingCustomModel, setEditingCustomModel] = useState<CustomModel | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<CustomModel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  logDebug('Current state', { areModelsLoading, settings });

  const handleAddNewCustomModel = () => {
    setEditingCustomModel(null);
    setIsCustomModelModalOpen(true);
  };

  const handleEditCustomModel = (model: CustomModel) => {
    setEditingCustomModel(model);
    setIsCustomModelModalOpen(true);
  };

  const handleDeleteCustomModel = (model: CustomModel) => {
    setModelToDelete(model);
    setDeleteModalOpen(true);
  };

  const confirmDeleteModel = async () => {
    if (!modelToDelete) return;
    setIsDeleting(true);
    try {
      const deleteUrl = isSpaceContext 
        ? `/api/spaces/${spaceSlug}/custom-models/${modelToDelete.uuid}`
        : `/api/user/custom-models/${modelToDelete.uuid}`;
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast({ title: "Model deleted", description: `"${modelToDelete.name}" has been removed.` });
        // Refresh models based on context
        if (isSpaceContext && spaceSlug) {
          const response = await fetch(`/api/spaces/${spaceSlug}/models`);
          if (response.ok) {
            const models = await response.json();
            useModelsStore.setState({ availableModels: models, isLoading: false });
          }
        } else {
          loadModels(); // Refresh the store
        }
      } else {
        throw new Error('Failed to delete model');
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Could not delete the model. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
      setModelToDelete(null);
    }
  };

  const handleSaveCustomModel = async (data: Omit<CustomModel, 'id' | 'uuid' | 'apiKey'> & { apiKey?: string }) => {
    const isEditing = !!editingCustomModel;
    
    // Use different API endpoints based on context
    const baseUrl = isSpaceContext 
      ? `/api/spaces/${spaceSlug}/custom-models`
      : '/api/user/custom-models';
    
    const url = isEditing ? `${baseUrl}/${editingCustomModel?.uuid}` : baseUrl;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: isEditing ? "Model updated" : "Model added",
          description: `"${data.name}" has been saved.`
        });
        setIsCustomModelModalOpen(false);
        // Refresh models based on context
        if (isSpaceContext && spaceSlug) {
          const response = await fetch(`/api/spaces/${spaceSlug}/models`);
          if (response.ok) {
            const models = await response.json();
            useModelsStore.setState({ availableModels: models, isLoading: false });
          }
        } else {
          loadModels(); // Refresh the store
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save model');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not save the model. Please try again.",
        variant: "destructive"
      });
      throw error; // Re-throw so the modal can handle the error state
    }
  };
  
  const totalAvailableModels = Object.keys(availableModels).length;

  // Get available models for default selection based on current filter mode
  const getAvailableModelsForDefault = useCallback(() => {
    if (settings.mode === 'all') {
      return Object.keys(availableModels);
    } else if (settings.mode === 'include') {
      return settings.includedModels;
    } else if (settings.mode === 'exclude') {
      return Object.keys(availableModels).filter(model => 
        !settings.excludedModels.includes(model)
      );
    }
    return Object.keys(availableModels);
  }, [settings.mode, settings.includedModels, settings.excludedModels, availableModels]);

  useEffect(() => {
    // Load models from appropriate endpoint based on context
    if (isSpaceContext && spaceSlug) {
      // For space context, we need to load space-specific models
      const loadSpaceModels = async () => {
        try {
          const response = await fetch(`/api/spaces/${spaceSlug}/models`);
          if (response.ok) {
            const models = await response.json();
            // Update the models store manually since it's designed for user models
            useModelsStore.setState({ availableModels: models, isLoading: false });
          }
        } catch (error) {
          console.error('Error loading space models:', error);
          useModelsStore.setState({ isLoading: false });
        }
      };
      loadSpaceModels();
    } else {
      // For user context, use the standard load function
      loadModels();
    }
    
    // Skip fetching user settings for space context since settings are passed as props
    if (isSpaceContext) return;
    
    // This effect now only runs once to fetch the initial user settings.
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/user/model-settings')
        if (response.ok) {
          const data = await response.json()
          setSettings({
            ...data,
            defaultModel: data.defaultModel || null
          })
        }
      } catch (error) {
        console.error('Error fetching model settings:', error)
      }
    }
    fetchSettings();
  }, [isSpaceContext, spaceSlug, loadModels])

  const handleSave = async () => {
    // Validate that we're not excluding all models
    if (settings.mode === 'exclude' && settings.excludedModels.length >= totalAvailableModels) {
      toast({
        title: "Invalid settings",
        description: "You cannot exclude all available models. At least one model must remain available.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate that at least one model is included in include mode
    if (settings.mode === 'include' && settings.includedModels.length === 0) {
      toast({
        title: "Invalid settings",
        description: "You must select at least one model when using 'include' mode.",
        variant: "destructive"
      });
      return;
    }

    // Create a clean settings object to ensure no model is in both arrays
    const cleanSettings = {
      mode: settings.mode,
      includedModels: settings.mode === 'include' ? [...settings.includedModels] : [],
      excludedModels: settings.mode === 'exclude' ? [...settings.excludedModels] : [],
      defaultModel: settings.defaultModel
    };

    setIsSaving(true)
    try {
      // Use different API endpoint based on context
      const apiUrl = isSpaceContext 
        ? `/api/spaces/${spaceSlug}/model-settings`
        : '/api/user/model-settings';
      
      const method = isSpaceContext ? 'PUT' : 'POST';
      const body = isSpaceContext 
        ? JSON.stringify({ modelSettings: cleanSettings })
        : JSON.stringify(cleanSettings);
      
      const response = await fetch(apiUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      })

      if (response.ok) {
        toast({
          title: "Settings saved",
          description: isSpaceContext 
            ? "Space model settings have been updated."
            : "Your model settings have been updated.",
        })
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleModelInclusion = (modelId: string) => {
    if (settings.mode === 'include') {
      if (settings.includedModels.includes(modelId)) {
        // Don't allow removing the last model
        if (settings.includedModels.length <= 1) {
          toast({
            title: "Cannot remove",
            description: "You must keep at least one model selected.",
            variant: "destructive"
          });
          return;
        }
        
        // If removing the current default model, reset it
        const shouldResetDefault = settings.defaultModel === modelId;
        
        setSettings({
          ...settings,
          includedModels: settings.includedModels.filter(id => id !== modelId),
          // Clear default model if it's being removed from available models
          defaultModel: shouldResetDefault ? null : settings.defaultModel
        });
        
        if (shouldResetDefault) {
          toast({
            title: "Default model reset",
            description: "Your default model was reset because it is no longer available.",
          });
        }
      } else {
        setSettings({
          ...settings,
          includedModels: [...settings.includedModels, modelId]
        })
      }
    } else if (settings.mode === 'exclude') {
      if (settings.excludedModels.includes(modelId)) {
        setSettings({
          ...settings,
          excludedModels: settings.excludedModels.filter(id => id !== modelId)
        })
      } else {
        // Check if this would exclude all models
        if (settings.excludedModels.length >= totalAvailableModels - 1) {
          toast({
            title: "Cannot exclude",
            description: "You must leave at least one model available.",
            variant: "destructive"
          });
          return;
        }
        
        // If excluding the current default model, reset it
        const shouldResetDefault = settings.defaultModel === modelId;
        
        setSettings({
          ...settings,
          excludedModels: [...settings.excludedModels, modelId],
          // Clear default model if it's being excluded
          defaultModel: shouldResetDefault ? null : settings.defaultModel
        });
        
        if (shouldResetDefault) {
          toast({
            title: "Default model reset",
            description: "Your default model was reset because it is no longer available.",
          });
        }
      }
    }
  }

  // Update dependencies array to include all relevant state that should trigger a check
  useEffect(() => {
    logDebug('Settings check effect triggered.', {
      dependencies: {
        mode: settings.mode,
        includedModels: settings.includedModels,
        excludedModels: settings.excludedModels,
        defaultModel: settings.defaultModel,
        areModelsLoading,
      }
    });
    // Only run this when settings change after initial load and models are also loaded
    if (!areModelsLoading) {
      const available = getAvailableModelsForDefault();
      
      // If default model is set but no longer available, reset it
      if (settings.defaultModel && !available.includes(settings.defaultModel)) {
        logDebug('Default model is no longer available, resetting...');
        setSettings(prev => {
          const newSettings = { ...prev, defaultModel: null };
          logDebug('New settings after reset:', newSettings);
          return newSettings;
        });
        
        toast({
          title: "Default model reset",
          description: "Your default model was reset because it is no longer available with your current settings.",
        });
      }
    }
  }, [settings.mode, settings.includedModels, settings.excludedModels, settings.defaultModel, areModelsLoading, getAvailableModelsForDefault, toast]);

  if (areModelsLoading) {
    logDebug('Rendering loading spinner...');
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Helper function to render model items with consistent styling
  const renderModelItems = (modelsList: string[], mode: 'include' | 'exclude') => {
    return Object.entries(availableModels).map(([id, model]) => {
      const isChecked = modelsList.includes(id);
      
      // For include mode, disable unchecking if it's the only selected model
      const isDisabled = mode === 'include' && isChecked && modelsList.length <= 1;
      
      // For exclude mode, disable checking if it would exclude all models
      const wouldExcludeAll = mode === 'exclude' && !isChecked && 
                              settings.excludedModels.length >= totalAvailableModels - 1;
      
      const handleClick = () => {
        if (!isDisabled && !wouldExcludeAll) {
          toggleModelInclusion(id);
        }
      };
      
      // Create content for the disabled model item
      const modelItem = (
        <div 
          key={id} 
          className={cn(
            "py-2 px-3 hover:bg-muted/50 rounded-md transition-colors",
            (isDisabled || wouldExcludeAll) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          )}
          onClick={handleClick}
        >
          <div className="flex items-start">
            <Checkbox 
              id={`${mode}-${id}`}
              checked={isChecked}
              disabled={isDisabled || wouldExcludeAll}
              onCheckedChange={handleClick}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-3">
                <label 
                  htmlFor={`${mode}-${id}`}
                  className="font-medium cursor-pointer"
                  onClick={(e) => {
                    // Prevent default label behavior which can interfere with our custom click handling
                    e.preventDefault();
                    handleClick();
                  }}
                >
                  {model.name}
                </label>
                <span className={cn(
                  "text-xs rounded-md px-2 py-0.5",
                  model.isCustom 
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-secondary text-secondary-foreground"
                )}>
                  {model.isCustom ? `Custom ${model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}` : model.provider}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{model.description}</p>
            </div>
          </div>
        </div>
      );
      
      // If the item is disabled, wrap it in a tooltip to explain why
      if (isDisabled || wouldExcludeAll) {
        const tooltipMessage = isDisabled
          ? "You must keep at least one model selected"
          : "You must leave at least one model available";
          
        return (
          <TooltipProvider key={id}>
            <Tooltip>
              <TooltipTrigger asChild>
                {modelItem}
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltipMessage}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      
      // Return the regular item if not disabled
      return modelItem;
    });
  };

  // Warning notice for include mode with no models selected
  const showIncludeWarning = settings.mode === 'include' && settings.includedModels.length === 0;

  const availableModelsForDefault = getAvailableModelsForDefault();

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area with internal padding */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {labels.title || (isSpaceContext ? "Space Model Configuration" : "LLM Model Settings")}
            </h2>
            <p className="text-muted-foreground mb-6">
              {labels.description || (isSpaceContext 
                ? "Configure which AI models are available to members of this space."
                : "Configure which language models can be used in your conversations."
              )}
            </p>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold mb-3">Custom Models</h3>
              <Button variant="outline" onClick={handleAddNewCustomModel}>
                <Plus className="mr-2 h-4 w-4" /> Add Model
              </Button>
            </div>
          <p className="text-sm text-muted-foreground">
            {isSpaceContext 
              ? "Add custom models with API keys for this space. These models will be available to all space members."
              : "Add your own models using personal API keys. These models will only be available to you."
            }
          </p>
            <div className="space-y-3">
              {Object.entries(availableModels)
                .filter(([_key, m]) => m.isCustom)
                .map(([key, model]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/40"
                    onClick={() => handleEditCustomModel({
                      id: (model as any).id || (model as any).modelId || key,
                      uuid: (model as any).uuid,
                      modelId: (model as any).modelId || (model as any).id || key,
                      name: model.name,
                      provider: (model as any).provider,
                      baseURL: (model as any).baseURL || '',
                    })}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{model.name}</p>
                      <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
                        {`custom ${model.provider}`}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleEditCustomModel({
                          id: (model as any).id || (model as any).modelId || key,
                          uuid: (model as any).uuid,
                          modelId: (model as any).modelId || (model as any).id || key,
                          name: model.name,
                          provider: (model as any).provider,
                          baseURL: (model as any).baseURL || '',
                        })}>
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteCustomModel({
                            id: (model as any).id || (model as any).modelId || key,
                            uuid: (model as any).uuid,
                            modelId: (model as any).modelId || (model as any).id || key,
                            name: model.name,
                            provider: (model as any).provider,
                            baseURL: (model as any).baseURL || '',
                          })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
            </div>
          </div>

          <div className="mb-8 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-3">Default Model</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select your preferred default model. This will be used when round and agent settings defer to the default.
            </p>

            <Select 
              value={settings.defaultModel || "none"}
              onValueChange={(value) => setSettings({
                ...settings,
                defaultModel: value === "none" ? null : value
              })}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a default model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default (random selection)</SelectItem>
                {availableModelsForDefault.map(modelId => {
                  const model = availableModels[modelId];
                  if (!model) return null;
                  return (
                    <SelectItem key={modelId} value={modelId}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        <span className={cn(
                          "text-xs rounded px-1.5 py-0.5",
                          model.isCustom 
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-600"
                        )}>
                          {model.isCustom ? `Custom ${model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}` : model.provider}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 border-t">
          <h3 className="text-lg font-semibold mb-3">Available Models</h3>
          </div>

          <RadioGroup
            value={settings.mode}
            onValueChange={(value: ModelSettingsMode) => {
              setSettings({
                ...settings,
                mode: value
              });
            }}
            className="space-y-4"
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="all" id="all-models" className="mt-1" />
              <div>
                <label htmlFor="all-models" className="font-medium cursor-pointer">
                  Use all available models
                </label>
                <p className="text-sm text-muted-foreground">
                  All models are available, including any added in the future.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="include" id="include-models" className="mt-1" />
              <div className="w-full">
                <label htmlFor="include-models" className="font-medium cursor-pointer">
                  Use only these models...
                </label>
                <p className="text-sm text-muted-foreground mb-4">
                  Only checked models will be used. New models added later would be unchecked by default.
                </p>
                
                {settings.mode === 'include' && (
                  <>
                    {showIncludeWarning && (
                      <div className="flex items-center gap-2 p-3 mb-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">You must select at least one model.</p>
                      </div>
                    )}
                    <div className="space-y-2 mt-2">
                      {renderModelItems(settings.includedModels, 'include')}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="exclude" id="exclude-models" className="mt-1" />
              <div className="w-full">
                <label htmlFor="exclude-models" className="font-medium cursor-pointer">
                  Use all models except...
                </label>
                <p className="text-sm text-muted-foreground mb-4">
                  All checked models will be excluded. New models added later would be automatically included.
                </p>
                
                {settings.mode === 'exclude' && (
                  <div className="space-y-2 mt-2">
                    {renderModelItems(settings.excludedModels, 'exclude')}
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Fixed footer with Save button - add horizontal padding */}
      <div className="flex justify-end py-4 px-6 border-t bg-background">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || (settings.mode === 'include' && settings.includedModels.length === 0)}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {labels.saveButton || (isSpaceContext ? "Save Space Settings" : "Save Changes")}
        </Button>
      </div>
      
      <>
        <CustomModelModal
          isOpen={isCustomModelModalOpen}
          onClose={() => setIsCustomModelModalOpen(false)}
          onSave={handleSaveCustomModel}
          model={editingCustomModel}
        />
        {deleteModalOpen && modelToDelete && (
          <ConfirmModal
            title="Delete Custom Model"
            message={<span>Are you sure you want to delete <b>{modelToDelete.name}</b>? This action cannot be undone.</span>}
            onConfirm={confirmDeleteModel}
            onCancel={() => { setDeleteModalOpen(false); setModelToDelete(null); }}
            isLoading={isDeleting}
            confirmText="Delete"
          />
        )}
      </>
    </div>
  )
} 