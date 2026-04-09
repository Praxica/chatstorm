"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CreativitySlider, CREATIVITY_LABELS } from "@/components/ui/creativity-slider"
import { ArrowLeft, UserCircle, Loader2 } from "lucide-react"
import { ChatAgent } from "@/lib/stores/chatAgentStore"
import { cn } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
import { useTopLayer } from '@/lib/hooks/useTopLayer'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import AvatarPicker from './AvatarPicker'
import ProjectSelector from './ProjectSelector'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useActiveConfigModels } from '@/lib/hooks/useConfigModels'
import { ModelSelectionRadioGroup } from './ui/model-selection-radio-group'
import { AgentModelWarning } from './ui/agent-model-warning'

interface ChatAgentEditProps {
  agent: ChatAgent
  onClose: () => void
  onSave: (agent: ChatAgent) => void
  initialProjectIds?: string[]
  isCreating?: boolean
  isSaving?: boolean
  asDialog?: boolean // When true, renders without fixed positioning for use in dialogs
}

type ModelSelectionMode = 'default' | 'random' | 'select'

export default function ChatAgentEdit({
  agent,
  onClose,
  onSave,
  initialProjectIds,
  isCreating = false,
  isSaving = false,
  asDialog = false
}: ChatAgentEditProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [temperature, setTemperature] = useState(agent.temperature || 0.7)
  const [name, setName] = useState(agent.name)
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt)
  const [priority, _setPriority] = useState(agent.priority)
  const [avatar, setAvatar] = useState(agent.avatar || '')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [projectIds, setProjectIds] = useState<string[]>(agent.projectIds || initialProjectIds || [])
  const [modelSelectionMode, setModelSelectionMode] = useState<ModelSelectionMode>(
    (agent.modelSelectionMode as ModelSelectionMode) || 'default'
  )
  const [selectedModels, setSelectedModels] = useState<string[]>(agent.selectedModels || [])
  const { availableModels } = useActiveConfigModels()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const zIndex = useTopLayer(!asDialog)

  useEffect(() => {
    // Start the animation immediately after the component mounts
    setIsVisible(true)
    
    // Auto-focus on the name input when component mounts in creation mode
    if (isCreating && nameInputRef.current) {
      // Increase timeout to ensure animation is complete
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 350)
    }
  }, [isCreating])

  const handleSave = () => {
    onSave({
      ...agent,
      name,
      systemPrompt,
      priority,
      temperature,
      avatar,
      projectIds,
      modelSelectionMode,
      selectedModels: modelSelectionMode === 'select' ? selectedModels : [],
    })
  }

  const toggleModel = (modelId: string) => {
    // With radio buttons, we simply set the selection to the chosen model
    setSelectedModels([modelId]);
  }

  // Handler to ensure we have initial model selection when switching to select mode
  useEffect(() => {
    if (modelSelectionMode === 'select' && selectedModels.length === 0) {
      // Initialize with first available model if none selected
      const modelIds = Object.keys(availableModels)
      if (modelIds.length > 0) {
        setSelectedModels([modelIds[0]])
      }
    }
  }, [modelSelectionMode, selectedModels, availableModels])

  // For dialog mode, render without fixed positioning and transitions
  if (asDialog) {
    if (showAvatarPicker) {
      return (
        <AvatarPicker
          onClose={() => setShowAvatarPicker(false)}
          onSelect={(newAvatar) => {
            setAvatar(newAvatar)
            setShowAvatarPicker(false)
          }}
        />
      )
    }

    return (
      <>
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 mb-4 border-b">
          <DialogTitle>{isCreating ? "Add New Agent" : "Edit Chat Agent"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 py-4 px-6">
          {/* Same form content as below */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Name</label>
            <Input
              placeholder="Agent name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Avatar</label>
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 h-20"
              onClick={() => setShowAvatarPicker(true)}
            >
              {avatar ? (
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(avatar)}`} alt="Selected avatar" className="w-12 h-12" />
              ) : (
                <UserCircle className="h-12 w-12" />
              )}
              <span className="text-sm text-gray-500">
                Click to change avatar
              </span>
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">System Prompt</label>
            <Textarea
              placeholder="Enter the system prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[200px]"
            />
          </div>

          <div className="space-y-2">
            <CreativitySlider
              value={Object.entries(CREATIVITY_LABELS).find(
                ([_, config]) => config.value === temperature
              )?.[0] ? Number(Object.entries(CREATIVITY_LABELS).find(
                ([_, config]) => config.value === temperature
              )?.[0]) : 1}
              onChange={(index) => setTemperature(CREATIVITY_LABELS[index as keyof typeof CREATIVITY_LABELS].value)}
              label="Creativity"
            />
          </div>

          <div className="space-y-2 mb-4 pb-3">
            <label className="text-sm font-semibold">Model Selection</label>

            <AgentModelWarning
              agent={{
                ...agent,
                modelSelectionMode,
                selectedModels
              }}
              availableModels={availableModels}
              className="mb-2"
            />
            <RadioGroup
              value={modelSelectionMode}
              onValueChange={(value: ModelSelectionMode) => setModelSelectionMode(value)}
              className="space-y-1 pt-2"
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="default" id="model-default" className="mt-1" />
                <div>
                  <label htmlFor="model-default" className="text-sm cursor-pointer leading-tight">
                    Default
                    <span className="text-muted-foreground"> — Use the default model settings.</span>
                  </label>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <RadioGroupItem value="random" id="model-random" className="mt-1" />
                <div>
                  <label htmlFor="model-random" className="text-sm cursor-pointer leading-tight">
                    Random
                  </label>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <RadioGroupItem value="select" id="model-select" className="mt-1" />
                <div className="w-full">
                  <label htmlFor="model-select" className="text-sm cursor-pointer leading-tight">
                    Select Specific Model
                    <span className="text-muted-foreground"> — Choose which model this agent should use.</span>
                  </label>

                  {modelSelectionMode === 'select' && (
                    <div className="mt-2">
                      <ModelSelectionRadioGroup
                        availableModels={availableModels}
                        selectedModel={selectedModels[0] || ''}
                        onModelChange={toggleModel}
                        showWarning={selectedModels.length === 0}
                        warningMessage="You must select a model"
                      />
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          <ProjectSelector
            selectedProjectIds={projectIds}
            onChange={setProjectIds}
          />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 mt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (modelSelectionMode === 'select' && selectedModels.length === 0)}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isCreating ? "Creating..." : "Saving..."}
              </>
            ) : (
              isCreating ? "Create Agent" : "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </>
    )
  }

  // Original panel mode with fixed positioning
  if (showAvatarPicker) {
    return (
      <AvatarPicker
        onClose={() => setShowAvatarPicker(false)}
        onSelect={(newAvatar) => {
          setAvatar(newAvatar)
          setShowAvatarPicker(false)
        }}
      />
    )
  }

  return (
    <>
    <div
      className={cn(
        "fixed inset-0 bg-black/40 transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{ zIndex: zIndex ? zIndex - 1 : undefined }}
      onClick={onClose}
    />
    <div className={cn(
      "fixed top-11 bottom-0 right-0 bg-white transform transition-transform duration-300 ease-out flex flex-col w-[350px] border-l",
      isVisible ? "translate-x-0" : "translate-x-full"
    )}
    style={{ zIndex: zIndex ?? undefined }}
    >
      <div className="p-4 border-b border-gray-200 flex-none">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onClose} disabled={isSaving}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to chat agents list</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <h2 className="text-lg font-semibold">{isCreating ? "Add New Agent" : "Edit Chat Agent"}</h2>
        </div>
      </div>
      
      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Name</label>
          <Input 
            placeholder="Agent name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            ref={nameInputRef}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Avatar</label>
          <Button 
            variant="outline" 
            className="w-full flex items-center gap-2 h-20"
            onClick={() => setShowAvatarPicker(true)}
          >
            {avatar ? (
              <img src={`data:image/svg+xml;utf8,${encodeURIComponent(avatar)}`} alt="Selected avatar" className="w-12 h-12" />
            ) : (
              <UserCircle className="h-12 w-12" />
            )}
            <span className="text-sm text-gray-500">
              Click to change avatar
            </span>
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">System Prompt</label>
          <Textarea 
            placeholder="Enter the system prompt" 
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[200px]"
          />
        </div>

        <div className="space-y-2">
          <CreativitySlider
            value={Object.entries(CREATIVITY_LABELS).find(
              ([_, config]) => config.value === temperature
            )?.[0] ? Number(Object.entries(CREATIVITY_LABELS).find(
              ([_, config]) => config.value === temperature
            )?.[0]) : 1}
            onChange={(index) => setTemperature(CREATIVITY_LABELS[index as keyof typeof CREATIVITY_LABELS].value)}
            label="Creativity"
          />
        </div>

        <div className="space-y-2 mb-4 pb-3">
          <label className="text-sm font-semibold">Model Selection</label>
          
          {/* Show warning for model availability issues */}
          <AgentModelWarning 
            agent={{
              ...agent,
              modelSelectionMode,
              selectedModels
            }}
            availableModels={availableModels}
            className="mb-2"
          />
          <RadioGroup
            value={modelSelectionMode}
            onValueChange={(value: ModelSelectionMode) => setModelSelectionMode(value)}
            className="space-y-1 pt-2"
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="default" id="model-default" className="mt-1" />
              <div>
                <label htmlFor="model-default" className="text-sm cursor-pointer leading-tight">
                  Default
                  <span className="text-muted-foreground"> — Use the default model settings.</span>
                </label>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="random" id="model-random" className="mt-1" />
              <div>
                <label htmlFor="model-random" className="text-sm cursor-pointer leading-tight">
                  Random
                </label>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="select" id="model-select" className="mt-1" />
              <div className="w-full">
                <label htmlFor="model-select" className="text-sm cursor-pointer leading-tight">
                  Select Specific Model
                  <span className="text-muted-foreground"> — Choose which model this agent should use.</span>
                </label>
                
                {modelSelectionMode === 'select' && (
                  <div className="mt-2">
                    <ModelSelectionRadioGroup
                      availableModels={availableModels}
                      selectedModel={selectedModels[0] || ''}
                      onModelChange={toggleModel}
                      showWarning={selectedModels.length === 0}
                      warningMessage="You must select a model"
                    />
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Priority section commented out
        <div className="space-y-2">
          <label className="text-sm font-semibold">Priority</label>
          <Textarea 
            placeholder="When to use this agent" 
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="min-h-[4rem]"
          />
        </div>
        */}

        <ProjectSelector
          selectedProjectIds={projectIds}
          onChange={setProjectIds}
        />
      </div>

      <div className="p-4 border-t border-gray-200 flex gap-2 flex-none bg-white">
        <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSaving}>Cancel</Button>
        <Button 
          className="flex-1" 
          onClick={handleSave}
          disabled={isSaving || (modelSelectionMode === 'select' && selectedModels.length === 0)}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isCreating ? "Creating..." : "Saving..."}
            </>
          ) : (
            isCreating ? "Create Agent" : "Save Changes"
          )}
        </Button>
      </div>
    </div>
    </>
  )
} 