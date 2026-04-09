'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { type RoundType, type RoundActionType, type Round } from '@/types/config-round'
import { ROUND_TYPES } from '@/lib/constants/rounds'
import { getModality } from '@/lib/chat/modalities/ModalityRegistry'
import { useConfigRounds } from '@/lib/stores/configsStore'
import { useChatAgentStore } from '@/lib/stores/chatAgentStore'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CircleHelp } from 'lucide-react'
import IconPicker from '@/components/IconPicker'
import { RoundIcon } from '@/components/rounds/RoundIcon'
import { WelcomeScreen } from './WelcomeScreen'

interface RoundSelectionStepProps {
  selectedType: RoundType | null
  onSelectType: (type: RoundType) => void
  onNext?: () => void
  configId: string
  draftRound: Round | null
  onUpdateRound: (updates: Partial<Round>) => void
}

export function RoundSelectionStep({ selectedType, onSelectType, onNext, configId, draftRound, onUpdateRound }: RoundSelectionStepProps) {
  const rounds = useConfigRounds(configId)
  const hasExistingRounds = rounds.length > 0
  const allAgents = useChatAgentStore(state => state.agents)
  const hasExistingAgents = allAgents.length > 0
  const isNewUser = !hasExistingRounds && !hasExistingAgents
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [hasCustomName, setHasCustomName] = useState(false)
  const [showWelcome, setShowWelcome] = useState(isNewUser)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Auto-populate name when round type is selected
  useEffect(() => {
    if (selectedType && draftRound && !hasCustomName) {
      if (draftRound.name !== selectedType) {
        onUpdateRound({ name: selectedType })
      }
      // Focus and select the input after name is set
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus()
          nameInputRef.current.select()
        }
      }, 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, draftRound?.id, hasCustomName])

  // Handle name changes to track custom vs default
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    onUpdateRound({ name: newName })
    // Mark as custom if different from round type
    setHasCustomName(newName !== selectedType && newName !== '')
  }

  // Filter out round types that require existing rounds
  const availableRoundTypes = Object.entries(ROUND_TYPES).filter(([_type, config]) => {
    if (!hasExistingRounds && config.requiresExistingRounds) {
      return false
    }
    return true
  })


  // Memoize the preview prompt to avoid creating new objects on every render
  const previewPrompt = useMemo(() => {
    if (!selectedType || selectedType === 'custom') return null

    const modality = getModality(selectedType)
    const agentsArray = allAgents || []

    // Create preview round object with first 3 agents as participants
    const previewRound = {
      id: 'preview-round',
      type: selectedType,
      outputNumber: 3,
      depth: 'medium' as const,
      participants: agentsArray.slice(0, 3),
      stances: [],
      action: selectedType === 'review' ? (draftRound?.action || 'summarize') : 'summarize'
    }

    // For review/critique, we need at least one previous round
    let roundsArray
    if (rounds.length > 0) {
      roundsArray = [...rounds, previewRound]
    } else {
      roundsArray = [
        {
          id: 'previous-round',
          type: 'explore',
          participants: agentsArray.slice(0, 3)
        },
        previewRound
      ]
    }

    const minimalChatState = {
      activeRound: previewRound,
      activeAgent: agentsArray[0] || { id: 'preview', name: 'Preview' },
      agents: agentsArray,
      rounds: roundsArray,
      progress: {
        messageAuthors: [],
        active: {
          round: {},
          senders: {}
        }
      }
    } as any

    const prompt = modality.getSystemPrompt(minimalChatState)
    return prompt.replace(/^\s*\n+/, '')
  }, [selectedType, draftRound?.action, allAgents, rounds])

  return (
    <div className="flex gap-8">
      {/* Left side - Round type icons in 2-column grid */}
      <div className="w-44">
        <div className="grid grid-cols-2 gap-2.5 sticky top-1">
          {availableRoundTypes.map(([type, config]) => {
            const Icon = config.icon
            const isSelected = selectedType === type

            return (
              <div
                key={type}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg transition-all duration-300 aspect-square overflow-hidden relative cursor-pointer ${
                  isSelected
                    ? 'bg-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
                onClick={() => isSelected ? onNext?.() : onSelectType(type as RoundType)}
              >
                <div className={`flex flex-col items-center transition-all duration-300 ${
                  isSelected ? 'gap-0.5 -translate-y-3' : 'gap-1'
                }`}>
                  <Icon className={`transition-all duration-300 ${
                    isSelected ? 'w-3.5 h-3.5' : 'w-4 h-4'
                  }`} />
                  <span className="text-xs font-medium capitalize">{type}</span>
                </div>
                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                    <div
                      className="w-full text-xs font-semibold py-1.5 bg-black text-white text-center rounded-b-lg transition-colors"
                    >
                      Next
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right side - Description */}
      <div className="flex-1">
        {selectedType ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              {(() => {
                const Icon = ROUND_TYPES[selectedType].icon
                return <Icon className="w-5 h-5" />
              })()}
              <h3 className="text-lg font-semibold capitalize">{selectedType}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">{ROUND_TYPES[selectedType].longDescription}</p>

            {/* Name input */}
            <div className="mb-6">
              <label htmlFor="round-name" className="text-sm font-semibold mb-1.5 block">Name</label>
              <Input
                ref={nameInputRef}
                id="round-name"
                value={draftRound?.name || ''}
                onChange={handleNameChange}
                placeholder={selectedType}
                className="font-medium"
              />
            </div>

            {/* Icon input */}
            <div className="mb-6">
              <label className="text-sm font-semibold mb-1.5 block">Icon</label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowIconPicker(true)}
                  className="flex items-center gap-2"
                >
                  <RoundIcon
                    iconName={(draftRound as any)?.icon || ''}
                    roundType={selectedType}
                    className="h-4 w-4"
                  />
                  {(draftRound as any)?.icon ? 'Change Icon' : 'Choose Icon'}
                </Button>
                {(draftRound as any)?.icon && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateRound({ icon: '' } as any)}
                    className="text-xs"
                  >
                    Reset to default
                  </Button>
                )}
              </div>
            </div>

            {selectedType === 'review' && (
              <div className="mt-4 mb-6">
                <h4 className="text-sm font-semibold mb-3">Review Action</h4>
                <RadioGroup
                  value={draftRound?.action || 'summarize'}
                  onValueChange={(value) => onUpdateRound({ action: value as RoundActionType })}
                  className="flex items-center gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="summarize" id="preview-summarize" />
                    <label htmlFor="preview-summarize" className="text-sm font-medium leading-none cursor-pointer">
                      Summarize
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="winner" id="preview-winner" />
                    <label htmlFor="preview-winner" className="text-sm font-medium leading-none cursor-pointer">
                      Winner
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rank" id="preview-rank" />
                    <label htmlFor="preview-rank" className="text-sm font-medium leading-none cursor-pointer">
                      Rank
                    </label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {selectedType === 'custom' ? (
              <div className="mt-6">
                <label htmlFor="custom-instructions" className="text-sm font-semibold mb-2 block">
                  Custom Prompt
                </label>
                <Textarea
                  id="custom-instructions"
                  value={draftRound?.instructions || ''}
                  onChange={(e) => {
                    onUpdateRound({ instructions: e.target.value })
                    // Auto-expand based on content
                    const target = e.target
                    target.style.height = 'auto'
                    target.style.height = `${target.scrollHeight}px`
                  }}
                  placeholder="Add custom instructions for this round..."
                  rows={4}
                  className="font-mono text-xs resize-none overflow-hidden"
                  style={{ minHeight: '80px' }}
                />
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex items-center gap-1.5 mb-2">
                  <h4 className="text-sm font-semibold">Round Prompt</h4>
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <CircleHelp className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This will be included in the prompts of all agents chatting in this round.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {previewPrompt}
                </div>
            </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>{hasExistingRounds ? 'Select a round type to see details' : 'Select a round type to begin designing your chat'}</p>
          </div>
        )}
      </div>

      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={(icon) => onUpdateRound({ icon } as any)}
        currentIcon={(draftRound as any)?.icon || ''}
      />

      {showWelcome && <WelcomeScreen onDismiss={() => setShowWelcome(false)} />}
    </div>
  )
}
