import { useState } from 'react'
import { type Round } from '@/types/config-round'
import { type ChatAgent } from '@/lib/stores/chatAgentStore'
import { cn } from '@/lib/utils'
import { Route, Sliders, Settings, MessageSquare, UserPlus, Users } from 'lucide-react'
import { RoundFlowEdit } from '../edit/RoundFlowEdit'
import { RoundStyleEdit } from '../edit/RoundStyleEdit'
import { RoundOptionsEdit } from '../edit/RoundOptionsEdit'
import { RoundDialogueEdit } from '../edit/RoundDialogueEdit'
import { RoundDialogueSendersEdit } from '../edit/RoundDialogueSendersEdit'
import { RoundDialogueReceiversEdit } from '../edit/RoundDialogueReceiversEdit'
import { createRoundFlowDraft, createRoundStyleDraft, createRoundOptionsDraft, createRoundDialogueDraft, createRoundDialogueSendersDraft, createRoundDialogueReceiversDraft } from '@/types/config-round'
import { CREATIVITY_LABELS } from '@/components/ui/creativity-slider'
import { useActiveConfigModels } from '@/lib/hooks/useConfigModels'
import { useChatAgentStore } from '@/lib/stores/chatAgentStore'

interface ConfigureStepProps {
  round: Round
  onUpdate: (updates: Partial<Round>) => void
  agents: ChatAgent[]
  encodeAvatarSvg: (svg: string | undefined) => string
}

type ConfigOption = 'flow' | 'style' | 'options' | 'dialogue' | 'senders' | 'receivers'

const CONFIG_OPTIONS = {
  flow: {
    icon: Route,
    title: 'Flow',
  },
  style: {
    icon: Sliders,
    title: 'Style',
  },
  options: {
    icon: Settings,
    title: 'Options',
  },
  dialogue: {
    icon: MessageSquare,
    title: 'Dialogue',
  },
  senders: {
    icon: UserPlus,
    title: 'Senders',
  },
  receivers: {
    icon: Users,
    title: 'Receivers',
  },
}

export function ConfigureStep({
  round,
  onUpdate,
  agents,
  encodeAvatarSvg,
}: ConfigureStepProps) {
  const isDialogue = round.type === 'dialogue'

  // Determine available options based on round type
  const availableOptions: ConfigOption[] = isDialogue
    ? ['dialogue', 'senders', 'receivers', 'flow', 'style', 'options']
    : ['flow', 'style', 'options']

  const [selectedOption, setSelectedOption] = useState<ConfigOption>(availableOptions[0])
  const { availableModels } = useActiveConfigModels()
  const allAgents = useChatAgentStore(state => state.agents)

  // Maintain draft state for all panels to handle state updates
  const [flowDraft, setFlowDraft] = useState(() => createRoundFlowDraft(round))
  const [styleDraft, setStyleDraft] = useState(() => createRoundStyleDraft(round))
  const [optionsDraft, setOptionsDraft] = useState(() => createRoundOptionsDraft(round))
  const [dialogueDraft, setDialogueDraft] = useState(() => createRoundDialogueDraft(round))
  const [sendersDraft, setSendersDraft] = useState(() => createRoundDialogueSendersDraft(round))
  const [receiversDraft, setReceiversDraft] = useState(() => createRoundDialogueReceiversDraft(round))

  const currentOption = CONFIG_OPTIONS[selectedOption]
  const Icon = currentOption.icon

  return (
    <div className="flex gap-8">
      {/* Left column: Menu options */}
      <div className="w-44 flex-shrink-0">
        <div className="space-y-2 sticky top-1">
          {availableOptions.map((optionKey) => {
            const option = CONFIG_OPTIONS[optionKey]
            const OptionIcon = option.icon
            const isSelected = selectedOption === optionKey
            return (
              <button
                key={optionKey}
                onClick={() => setSelectedOption(optionKey)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                  isSelected
                    ? "bg-black text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                )}
              >
                <OptionIcon className="w-4 h-4" />
                {option.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right column: Content */}
      <div className="flex-1 min-w-0">
        {/* Header with icon and title */}
        <div className="mb-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-lg font-semibold">{currentOption.title}</h3>
          </div>
        </div>

        {/* Flow Panel */}
        <div className={cn(selectedOption === 'flow' ? 'block' : 'hidden')}>
          <RoundFlowEdit
            round={round}
            draft={flowDraft}
            onUpdateDraft={(updates) => {
              setFlowDraft(prev => ({ ...prev, ...updates }))
              onUpdate(updates)
            }}
            agents={agents}
            rounds={[]}
            encodeAvatarSvg={encodeAvatarSvg}
          />
        </div>

        {/* Style Panel */}
        <div className={cn(selectedOption === 'style' ? 'block' : 'hidden')}>
          <RoundStyleEdit
            draft={styleDraft}
            onUpdateDraft={(updates) => {
              setStyleDraft(prev => ({ ...prev, ...updates }))
              const updatesToApply: Partial<Round> = {}
              if (updates.depth !== undefined) {
                updatesToApply.depth = updates.depth
              }
              const nextCreativityType = updates.creativityType ?? styleDraft.creativityType
              if (nextCreativityType !== undefined) {
                updatesToApply.creativityType = nextCreativityType
              }
              if (updates.creativityIndex !== undefined && nextCreativityType === 'custom') {
                updatesToApply.creativityNumber = CREATIVITY_LABELS[updates.creativityIndex as keyof typeof CREATIVITY_LABELS].value
              }
              onUpdate(updatesToApply)
            }}
          />
        </div>

        {/* Options Panel */}
        <div className={cn(selectedOption === 'options' ? 'block' : 'hidden')}>
          <RoundOptionsEdit
            draft={optionsDraft}
            onUpdateDraft={(updates) => {
              // Update local draft state
              setOptionsDraft(prev => ({ ...prev, ...updates }))

              // Also update the round
              const updatesToApply: Partial<Round> = {}
              if (updates.instructions !== undefined) updatesToApply.instructions = updates.instructions
              if (updates.showPrompts !== undefined) updatesToApply.showPrompts = updates.showPrompts
              if (updates.agentQuestions !== undefined) updatesToApply.agentQuestions = updates.agentQuestions
              if (updates.agentSelfReflection !== undefined) updatesToApply.agentSelfReflection = updates.agentSelfReflection
              if (updates.agentIsolation !== undefined) updatesToApply.agentIsolation = updates.agentIsolation
              if (updates.isPrivate !== undefined) updatesToApply.isPrivate = updates.isPrivate
              if (updates.modelSelectionMode !== undefined) {
                updatesToApply.modelSelectionMode = updates.modelSelectionMode
                updatesToApply.selectedModel = updates.modelSelectionMode === 'specific' ? (updates.selectedModel || optionsDraft.selectedModel || '') : ''
              }
              if (updates.selectedModel !== undefined) {
                updatesToApply.selectedModel = updates.selectedModel
              }
              onUpdate(updatesToApply)
            }}
            availableModels={availableModels}
          />
        </div>

        {/* Dialogue Panel */}
        <div className={cn(selectedOption === 'dialogue' ? 'block' : 'hidden')}>
          <RoundDialogueEdit
            draft={dialogueDraft}
            onUpdateDraft={(updates) => {
              setDialogueDraft(prev => ({ ...prev, ...updates }))
              const updatesToApply: Partial<Round> = {}
              if (updates.initialMessageMode !== undefined) updatesToApply.dialogueInitialMessageMode = updates.initialMessageMode as any
              if (updates.initialMessage !== undefined) updatesToApply.dialogueInitialMessage = updates.initialMessage
              if (updates.initialMessageInstructions !== undefined) updatesToApply.dialogueInitialMessageInstructions = updates.initialMessageInstructions
              if (updates.dialogueInstructionsMode !== undefined) updatesToApply.dialogueInstructionsMode = updates.dialogueInstructionsMode as any
              if (updates.dialogueInstructions !== undefined) updatesToApply.dialogueInstructions = updates.dialogueInstructions
              if (updates.dialogueInstructionsPrompt !== undefined) updatesToApply.dialogueInstructionsPrompt = updates.dialogueInstructionsPrompt
              if (updates.dialogueLengthMode !== undefined) updatesToApply.dialogueLengthMode = updates.dialogueLengthMode as any
              if (updates.dialogueLength !== undefined) updatesToApply.dialogueLength = updates.dialogueLength
              if (updates.dialogueLengthInstructions !== undefined) updatesToApply.dialogueLengthInstructions = updates.dialogueLengthInstructions
              if (updates.dialogueLengthModeratorAgentId !== undefined) updatesToApply.dialogueLengthModerator = updates.dialogueLengthModeratorAgentId
              onUpdate(updatesToApply)
            }}
            agents={allAgents}
            encodeAvatarSvg={encodeAvatarSvg}
          />
        </div>

        {/* Senders Panel */}
        <div className={cn(selectedOption === 'senders' ? 'block' : 'hidden')}>
          <RoundDialogueSendersEdit
            draft={sendersDraft}
            onUpdateDraft={(updates) => {
              setSendersDraft(prev => ({ ...prev, ...updates }))
              const effectiveMode = (updates as any).senderMode ?? sendersDraft.senderMode
              const updatesToApply: Partial<Round> = {}
              if (effectiveMode !== undefined) updatesToApply.dialogueSenderMode = effectiveMode as any
              if ((updates as any).selectedSenders !== undefined) {
                updatesToApply.dialogueSelectedSenders = effectiveMode === 'select' ? (updates as any).selectedSenders : undefined
              }
              if ((updates as any).senderInstructions !== undefined) {
                updatesToApply.dialogueSenderInstructions =
                  effectiveMode !== 'all_participants' && effectiveMode !== 'select'
                    ? (updates as any).senderInstructions
                    : undefined
              }
              if ((updates as any).senderModeratorAgentId !== undefined) {
                updatesToApply.dialogueSenderModerator =
                  effectiveMode === 'moderator_decides' ? (updates as any).senderModeratorAgentId : undefined
              }
              onUpdate(updatesToApply)
            }}
            participants={round.participants}
            allAgents={allAgents}
            encodeAvatarSvg={encodeAvatarSvg}
          />
        </div>

        {/* Receivers Panel */}
        <div className={cn(selectedOption === 'receivers' ? 'block' : 'hidden')}>
          <RoundDialogueReceiversEdit
            draft={receiversDraft}
            onUpdateDraft={(updates) => {
              setReceiversDraft(prev => ({ ...prev, ...updates }))
              const effectiveMode = (updates as any).receiverMode ?? receiversDraft.receiverMode
              const updatesToApply: Partial<Round> = {}
              if (effectiveMode !== undefined) updatesToApply.dialogueReceiverMode = effectiveMode as any
              if ((updates as any).selectedReceivers !== undefined) {
                updatesToApply.dialogueSelectedReceivers = effectiveMode === 'select' ? (updates as any).selectedReceivers : undefined
              }
              if ((updates as any).receiverInstructions !== undefined) {
                updatesToApply.dialogueReceiverInstructions =
                  effectiveMode !== 'all_participants' && effectiveMode !== 'select'
                    ? (updates as any).receiverInstructions
                    : undefined
              }
              if ((updates as any).receiverModeratorAgentId !== undefined) {
                updatesToApply.dialogueReceiverModerator =
                  effectiveMode === 'moderator_decides' ? (updates as any).receiverModeratorAgentId : undefined
              }
              onUpdate(updatesToApply)
            }}
            participants={round.participants}
            allAgents={allAgents}
            encodeAvatarSvg={encodeAvatarSvg}
          />
        </div>
      </div>
    </div>
  )
}
