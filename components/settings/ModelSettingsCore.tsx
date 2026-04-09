"use client"

import { useState, useEffect } from 'react'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ModelConfig } from '@/lib/utils/models'
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, Plus } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ModelSettingsMode = 'all' | 'include' | 'exclude'

export interface ModelSettings {
  mode: ModelSettingsMode
  includedModels: string[]
  excludedModels: string[]
  defaultModel: string | null
}

interface ModelSettingsCoreProps {
  settings: ModelSettings
  onSettingsChange: (settings: ModelSettings) => void
  availableModels: ModelConfig[]
  customModels?: any[]
  onSave?: (settings: ModelSettings) => Promise<void>
  isSaving?: boolean
  error?: string | null
  labels?: {
    title?: string
    description?: string
    modeAll?: string
    modeInclude?: string
    modeExclude?: string
    saveButton?: string
  }
  showCustomModels?: boolean
  onAddCustomModel?: () => void
}

export function ModelSettingsCore({
  settings,
  onSettingsChange,
  availableModels,
  customModels = [],
  onSave,
  isSaving = false,
  error = null,
  labels = {},
  showCustomModels = true,
  onAddCustomModel
}: ModelSettingsCoreProps) {
  const [localSettings, setLocalSettings] = useState<ModelSettings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleModeChange = (mode: ModelSettingsMode) => {
    const newSettings = { ...localSettings, mode }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  const handleModelToggle = (modelId: string, checked: boolean) => {
    const newSettings = { ...localSettings }
    
    if (localSettings.mode === 'include') {
      if (checked) {
        newSettings.includedModels = [...localSettings.includedModels, modelId]
      } else {
        newSettings.includedModels = localSettings.includedModels.filter(id => id !== modelId)
        // If unchecking default model, clear it
        if (localSettings.defaultModel === modelId) {
          newSettings.defaultModel = null
        }
      }
    } else if (localSettings.mode === 'exclude') {
      if (checked) {
        newSettings.excludedModels = [...localSettings.excludedModels, modelId]
        // If excluding default model, clear it
        if (localSettings.defaultModel === modelId) {
          newSettings.defaultModel = null
        }
      } else {
        newSettings.excludedModels = localSettings.excludedModels.filter(id => id !== modelId)
      }
    }
    
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  const handleDefaultModelChange = (modelId: string | null) => {
    const newSettings = { ...localSettings, defaultModel: modelId }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  const isModelEnabled = (modelId: string) => {
    if (localSettings.mode === 'all') return true
    if (localSettings.mode === 'include') return localSettings.includedModels.includes(modelId)
    if (localSettings.mode === 'exclude') return !localSettings.excludedModels.includes(modelId)
    return false
  }

  const enabledModels = [...availableModels, ...customModels].filter(model => 
    isModelEnabled(model.modelId || model.id)
  )

  const allModels = [...availableModels, ...customModels]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{labels.title || "Model Settings"}</h3>
        <p className="text-sm text-muted-foreground">
          {labels.description || "Configure which AI models are available"}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Model Availability</label>
          <RadioGroup value={localSettings.mode} onValueChange={handleModeChange}>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="all" id="all" />
              <label htmlFor="all" className="text-sm cursor-pointer">
                {labels.modeAll || "All models available"}
              </label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="include" id="include" />
              <label htmlFor="include" className="text-sm cursor-pointer">
                {labels.modeInclude || "Only selected models"}
              </label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="exclude" id="exclude" />
              <label htmlFor="exclude" className="text-sm cursor-pointer">
                {labels.modeExclude || "All except selected models"}
              </label>
            </div>
          </RadioGroup>
        </div>

        {localSettings.mode !== 'all' && (
          <div>
            <label className="text-sm font-medium">
              {localSettings.mode === 'include' ? 'Select Models to Include' : 'Select Models to Exclude'}
            </label>
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
              {allModels.map((model) => {
                const modelId = model.modelId || model.id
                const isChecked = localSettings.mode === 'include' 
                  ? localSettings.includedModels.includes(modelId)
                  : localSettings.excludedModels.includes(modelId)
                
                return (
                  <div key={modelId} className="flex items-center space-x-2">
                    <Checkbox
                      id={modelId}
                      checked={isChecked}
                      onCheckedChange={(checked) => 
                        handleModelToggle(modelId, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={modelId}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {model.name}
                      {model.provider && (
                        <span className="text-muted-foreground ml-2">
                          ({model.provider})
                        </span>
                      )}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Default Model</label>
          <Select
            value={localSettings.defaultModel || "none"}
            onValueChange={(value) => 
              handleDefaultModelChange(value === "none" ? null : value)
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select default model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default</SelectItem>
              {enabledModels.map((model) => {
                const modelId = model.modelId || model.id
                return (
                  <SelectItem key={modelId} value={modelId}>
                    {model.name}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {showCustomModels && onAddCustomModel && (
          <Button
            variant="outline"
            onClick={onAddCustomModel}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Model
          </Button>
        )}

        {onSave && (
          <Button
            onClick={() => onSave(localSettings)}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {labels.saveButton || "Save Model Settings"}
          </Button>
        )}
      </div>
    </div>
  )
}