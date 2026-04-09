import { type RoundOptionsDraft } from '@/types/config-round'
import { Checkbox } from "../../ui/checkbox"
import { Textarea } from "../../ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ModelSelectionRadioGroup } from '../../ui/model-selection-radio-group'
import { useEffect } from 'react'

interface RoundOptionsEditProps {
  draft: RoundOptionsDraft
  onUpdateDraft: (updates: Partial<RoundOptionsDraft>) => void
  availableModels: Record<string, any>
}

export function RoundOptionsEdit({ draft, onUpdateDraft, availableModels }: RoundOptionsEditProps) {
  // Handler to ensure we have initial model selection when switching to specific mode
  useEffect(() => {
    if (draft.modelSelectionMode === 'specific' && !draft.selectedModel) {
      // Initialize with first available model if none selected
      const modelIds = Object.keys(availableModels)
      if (modelIds.length > 0) {
        onUpdateDraft({ selectedModel: modelIds[0] })
      }
    }
  }, [draft.modelSelectionMode, draft.selectedModel, availableModels, onUpdateDraft])

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="space-y-2">
        <label htmlFor="instructions" className="text-sm font-semibold">
          Custom Instructions
        </label>
        <Textarea
          id="instructions"
          value={draft.instructions}
          onChange={(e) => onUpdateDraft({ instructions: e.target.value })}
          placeholder="Add custom instructions for this round..."
          rows={4}
        />
      </div>

      {/* Agent Settings */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Agent Settings</label>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agentQuestions"
              checked={draft.agentQuestions}
              onCheckedChange={(checked) => onUpdateDraft({ agentQuestions: checked as boolean })}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label htmlFor="agentQuestions" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-help">
                    Ask Questions
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Agents will ask questions directly to other agents</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="agentSelfReflection"
              checked={draft.agentSelfReflection}
              onCheckedChange={(checked) => onUpdateDraft({ agentSelfReflection: checked as boolean })}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label htmlFor="agentSelfReflection" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-help">
                    Self-reflection
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Agents will maintain a private self-reflection before speaking publicly</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="agentIsolation"
              checked={draft.agentIsolation}
              onCheckedChange={(checked) => onUpdateDraft({ agentIsolation: checked as boolean })}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label htmlFor="agentIsolation" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-help">
                    Isolated Messages
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Agents can&apos;t see messages from other agents in this round</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Round Settings */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Round Settings</label>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showPrompts"
              checked={draft.showPrompts}
              onCheckedChange={(checked) => onUpdateDraft({ showPrompts: checked as boolean })}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label htmlFor="showPrompts" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-help">
                    Show prompts after the round ends
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Generate prompts the user can click to continue the chat</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPrivate"
              checked={draft.isPrivate}
              onCheckedChange={(checked) => onUpdateDraft({ isPrivate: checked as boolean })}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label htmlFor="isPrivate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-help">
                    Private Round
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Only agents participating in this round will see these messages in subsequent rounds</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Model Selection</label>

        <RadioGroup
          value={draft.modelSelectionMode}
          onValueChange={(value) => onUpdateDraft({ modelSelectionMode: value as any })}
          className="space-y-0"
        >
          <div className="flex items-center space-x-2 py-1 hover:bg-muted/50 rounded-md transition-colors">
            <RadioGroupItem value="agent" id="model-agent" />
            <label htmlFor="model-agent" className="text-sm font-medium leading-none cursor-pointer">Use agent defaults</label>
          </div>
          <div className="flex items-center space-x-2 py-1 hover:bg-muted/50 rounded-md transition-colors">
            <RadioGroupItem value="random" id="model-random" />
            <label htmlFor="model-random" className="text-sm font-medium leading-none cursor-pointer">Random selection</label>
          </div>
          <div className="flex items-center space-x-2 py-1 hover:bg-muted/50 rounded-md transition-colors">
            <RadioGroupItem value="specific" id="model-specific" />
            <label htmlFor="model-specific" className="text-sm font-medium leading-none cursor-pointer">Specific model</label>
          </div>
        </RadioGroup>

        {draft.modelSelectionMode === 'specific' && (
          <div className="pl-6">
            <ModelSelectionRadioGroup
              availableModels={availableModels}
              selectedModel={draft.selectedModel}
              onModelChange={(model) => onUpdateDraft({ selectedModel: model })}
              className="space-y-1"
              itemClassName="space-x-2"
            />
          </div>
        )}
      </div>
    </div>
  )
}
