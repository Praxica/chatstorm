'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type RoundType, type Round, createInitialRound } from '@/types/config-round'
import { WizardProgress } from './WizardProgress'
import { RoundSelectionStep } from './RoundSelectionStep'
import { AgentSelectionStep, type AgentMenuOption } from './AgentSelectionStep'
import { ConfigureStep } from './ConfigureStep'
import { type GenerationConfig } from '@/components/ConfigRoundGenerateAgents'
import { useChatAgentStore } from '@/lib/stores/chatAgentStore'
import { useConfigsStore, useConfigRounds } from '@/lib/stores/configsStore'
import { encodeAvatarSvg } from '@/lib/utils/avatar'

interface RoundAddWizardProps {
  isOpen: boolean
  onClose: () => void
  configId: string
  onRoundAdded?: (roundId: string) => void
}

const WIZARD_STEPS = [
  { label: 'Round', subtitle: 'Select Round Type' },
  { label: 'Agents', subtitle: 'Configure Agents' },
  { label: 'Configure', subtitle: 'Configure Round' },
]

export function RoundAddWizard({ isOpen, onClose, configId, onRoundAdded }: RoundAddWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedRoundType, setSelectedRoundType] = useState<RoundType | null>(null)
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [generationConfig, setGenerationConfig] = useState<Partial<GenerationConfig>>({})
  const [draftRound, setDraftRound] = useState<Round | null>(null)

  // Handler to merge generation config updates
  const handleUpdateGenerationConfig = useCallback((updates: Partial<GenerationConfig>) => {
    setGenerationConfig(prev => ({ ...prev, ...updates }))
  }, [])
  const [agentMenuOption, setAgentMenuOption] = useState<AgentMenuOption>('select')
  const [isSaving, setIsSaving] = useState(false)
  const agents = useChatAgentStore(state => state.agents)
  const getSortedAgents = useChatAgentStore(state => state.getSortedAgents)
  const projectFilter = useChatAgentStore(state => state.projectFilter)
  const addRound = useConfigsStore(state => state.addRound)
  const rounds = useConfigRounds(configId)
  const configs = useConfigsStore(state => state.configs)
  const config = configs.find(c => c.id === configId)

  // Reset wizard state when dialog closes or opens
  useEffect(() => {
    if (!isOpen) {
      // Reset after a brief delay to allow closing animation to complete
      const timer = setTimeout(() => {
        setCurrentStep(0)
        setSelectedRoundType(null)
        setSelectedAgents([])
        setGenerationConfig({})
        setDraftRound(null)
        setAgentMenuOption('select')
        setIsSaving(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Initialize draft round when round type is selected
  useEffect(() => {
    if (selectedRoundType && !draftRound) {
      const participantAgents = agents.filter(a => selectedAgents.includes(a.id))
      // Ensure new rounds are appended at the end by assigning the next sequence
      const nextSequence =
        rounds.length > 0
          ? Math.max(...rounds.map(r => (typeof r.sequence === 'number' ? r.sequence : 0))) + 1
          : 0

      const newRound: Round = createInitialRound({
        type: selectedRoundType,
        participants: participantAgents,
        sequence: nextSequence,
      })

      console.log('[RoundAddWizard] Creating draftRound with sequence', nextSequence)
      setDraftRound(newRound)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoundType, draftRound, agents, selectedAgents])

  // Keep draftRound.type in sync if the user changes the selected round type after initialization
  useEffect(() => {
    if (draftRound && selectedRoundType && draftRound.type !== selectedRoundType) {
      // minimal stable update to avoid resetting other fields
      setDraftRound(prev => prev ? { ...prev, type: selectedRoundType } : null)
      // Debug to confirm synchronization
      console.log('[RoundAddWizard] Synced draftRound.type to selectedRoundType', {
        previousType: draftRound.type,
        nextType: selectedRoundType,
      })
    }
  }, [selectedRoundType, draftRound])

  // Update participants when selected agents change
  useEffect(() => {
    if (draftRound) {
      const participantAgents = agents.filter(a => selectedAgents.includes(a.id))
      // Only update if the participants actually changed
      const currentParticipantIds = draftRound.participants.map(p => p.id).sort().join(',')
      const newParticipantIds = participantAgents.map(p => p.id).sort().join(',')

      if (currentParticipantIds !== newParticipantIds) {
        setDraftRound(prev => prev ? { ...prev, participants: participantAgents } : null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgents, agents])

  // Update draft round directly with any config changes
  const updateDraftRound = useCallback((updates: Partial<Round>) => {
    setDraftRound(prev => prev ? { ...prev, ...updates } : null)
  }, [])

  const handleNext = async () => {
    if (currentStep === 0 && selectedRoundType) {
      // Set default selected agents when moving to step 1
      if (selectedAgents.length === 0) {
        const defaultAgents = getDefaultAgents()
        setSelectedAgents(defaultAgents)
      }
      setCurrentStep(1)
    } else if (currentStep === 1) {
      setCurrentStep(2)
    } else if (currentStep === 2 && draftRound) {
      // Save the round
      setIsSaving(true)
      try {
        // Map agentMenuOption to participantMode before saving
        const participantMode = agentMenuOption === 'prompt' ? 'GENERATE' : 'SELECT'

        // If GENERATE mode, clear participants array and add generation config
        const roundToSave = {
          ...draftRound,
          participantMode,
          participants: participantMode === 'GENERATE' ? [] : draftRound.participants,
          // Add generation config fields when in GENERATE mode
          ...(participantMode === 'GENERATE' ? {
            participantGenerationPrompt: generationConfig.participantGenerationPrompt,
            participantLength: generationConfig.participantLength || 3,
            participantLengthType: generationConfig.participantLengthType || 'FIXED'
          } : {})
        }

        const createdRound = await addRound(configId, roundToSave as Round) as Round | void
        onClose()
        // Notify parent component to open the new round
        if (onRoundAdded && createdRound) {
          onRoundAdded(createdRound.id)
        }
      } catch (error) {
        console.error('Failed to add round:', error)
        setIsSaving(false)
      }
    }
  }

  const getDefaultAgents = (): string[] => {
    // Get sorted agents from the store (respects current sort order)
    const sortedAgents = getSortedAgents()

    // 1. Use the global project filter (or fall back to config projects if filter is empty)
    const filterProjectIds =
      projectFilter.length > 0
        ? projectFilter
        : (config?.projects?.map(p => p.id) ?? [])
    let availableAgents = sortedAgents

    if (filterProjectIds.length > 0) {
      availableAgents = sortedAgents.filter(agent =>
        agent.projectIds?.some(pid => filterProjectIds.includes(pid))
      )
    }

    // If no agents match project filter, use all sorted agents
    if (availableAgents.length === 0) {
      availableAgents = sortedAgents
    }

    // 2. If previous round is same type, use those agents
    if (rounds.length > 0) {
      const lastRound = rounds[rounds.length - 1]
      if (lastRound.type === selectedRoundType) {
        const lastRoundAgentIds = lastRound.participants.map(p => p.id)
        // Filter to only include agents that still exist and match project filter
        const matchingAgents = lastRoundAgentIds.filter(id =>
          availableAgents.some(a => a.id === id)
        )
        if (matchingAgents.length > 0) {
          return matchingAgents
        }
      }
    }

    // 3. If summary/review/critique round, default to first agent (in sorted order)
    if (selectedRoundType === 'review' || selectedRoundType === 'critique') {
      return availableAgents.length > 0 ? [availableAgents[0].id] : []
    }

    // 4. Otherwise, default to first three agents (in sorted order)
    return availableAgents.slice(0, 3).map(a => a.id)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white sm:max-w-[900px] top-6 max-h-[calc(100vh-3rem)] flex flex-col">
        <DialogHeader className="border-b pb-4 flex-shrink-0">
          <DialogTitle>
            <span className="font-semibold">Add Round</span>
            <span className="mx-2 text-gray-400">›</span>
            <span className="font-normal text-gray-600">{WIZARD_STEPS[currentStep].subtitle}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto -mx-6 flex-1 min-h-0">
          <div className="px-6 py-1">
            {currentStep === 0 && (
              <RoundSelectionStep
                selectedType={selectedRoundType}
                onSelectType={setSelectedRoundType}
                onNext={handleNext}
                configId={configId}
                draftRound={draftRound}
                onUpdateRound={updateDraftRound}
              />
            )}

            {currentStep === 1 && (
              <AgentSelectionStep
                selectedAgents={selectedAgents}
                onSelectAgents={setSelectedAgents}
                encodeAvatarSvg={encodeAvatarSvg}
                generationConfig={generationConfig}
                onUpdateGenerationConfig={handleUpdateGenerationConfig}
                onMenuOptionChange={setAgentMenuOption}
              initialProjectFilter={config?.projects?.map(p => p.id) ?? []}
              />
            )}

            {currentStep === 2 && draftRound && (
              <ConfigureStep
                round={draftRound}
                onUpdate={updateDraftRound}
                agents={agents}
                encodeAvatarSvg={encodeAvatarSvg}
              />
            )}
          </div>
        </div>
        <div className="-mx-6 px-6 flex-shrink-0">
          <WizardProgress
            currentStep={currentStep}
            steps={WIZARD_STEPS}
            onNext={handleNext}
            nextDisabled={
              isSaving ||
              (currentStep === 0 && !selectedRoundType) ||
              (currentStep === 1 && agentMenuOption === 'select' && selectedAgents.length === 0) ||
              (currentStep === 1 && agentMenuOption === 'prompt' && !generationConfig.participantGenerationPrompt?.trim())
            }
            nextDisabledTooltip={
              currentStep === 1 && agentMenuOption === 'select' && selectedAgents.length === 0
                ? 'Please select at least one agent'
                : currentStep === 1 && agentMenuOption === 'prompt' && !generationConfig.participantGenerationPrompt?.trim()
                ? 'Please enter a generation prompt'
                : undefined
            }
            nextLabel={isSaving ? 'Saving...' : currentStep === 2 ? 'Add' : 'Next'}
            onStepClick={setCurrentStep}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
