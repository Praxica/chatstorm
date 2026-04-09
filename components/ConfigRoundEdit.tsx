'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, ExternalLink, ArrowUpDown } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Accordion } from "@/components/ui/accordion"
import { type Round, shouldShowInput } from '../types/config-round'
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChatAgentStore, type ChatAgent } from '@/lib/stores/chatAgentStore'
import { ActionPanel } from './ActionPanel'
import { useToast } from "@/components/hooks/use-toast"
import { useConfigsStore, useConfigRounds } from '@/lib/stores/configsStore'
import { ChatRoundItem } from './ConfigRoundItem'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StancePanel } from './rounds/StancePanel'
import { ParticipantPanel } from './rounds/ParticipantPanel'
import { ParticipantsPanel } from './rounds/ParticipantsPanel'
import { ConfigRoundOptionsPanel } from './rounds/ConfigRoundOptionsPanel'
import debounce from 'lodash/debounce'
import { ConfigRoundStylePanel } from './rounds/ConfigRoundStylePanel'
import { RoundDataTool } from './rounds/RoundDataTool'
import { ConfigRoundFlowPanel } from './rounds/ConfigRoundFlowPanel'
import { ConfigRoundSort } from './ConfigRoundSort'
import { type GenerationConfig } from './ConfigRoundGenerateAgents'
import { ParticipantMode } from '@prisma/client'
import { DialogueSendersPanel } from './rounds/DialogueSendersPanel'
import { DialogueReceiversPanel } from './rounds/DialogueReceiversPanel'
import { DialoguePanel } from './rounds/DialoguePanel'
import { RoundAddWizard } from './rounds/add/RoundAddWizard'

const encodeAvatarSvg = (svg: string | undefined) => {
  try {
    return svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` : ''
  } catch {
    return ''
  }
}

export default function ChatRoundConfig({ configId, onBack: _onBack }: { configId: string, onBack: () => void }) {
  // Get rounds from configsStore using the new memoized hook
  const rounds = useConfigRounds(configId);
  const updateRound = useConfigsStore(state => state.updateRound)
  const deleteRound = useConfigsStore(state => state.deleteRound)
  const reorderRounds = useConfigsStore(state => state.reorderRounds)

  const agents = useChatAgentStore.getState().agents

  const [activeRound, setActiveRound] = useState<string | undefined>(
    rounds.length > 0 ? rounds[0].id : undefined
  )
  const [showAddWizard, setShowAddWizard] = useState(rounds.length === 0)
  const [editingLimit, setEditingLimit] = useState<string | undefined>(undefined)

  // Update showAddWizard when rounds change
  useEffect(() => {
    if (rounds.length === 0) {
      setShowAddWizard(true)
    }
  }, [rounds.length])
  const [editingParticipants, setEditingParticipants] = useState<string | undefined>(undefined)
  const [editingAction, setEditingAction] = useState<string | undefined>(undefined)
  const [editingStance, setEditingStance] = useState<string | undefined>(undefined)
  const [editingOptions, setEditingOptions] = useState<string | undefined>(undefined)
  const [editingStyle, setEditingStyle] = useState<string | undefined>(undefined)
  const [editingDataTool, setEditingDataTool] = useState<string | undefined>(undefined)
  const [editingDialogueSenders, setEditingDialogueSenders] = useState<string | undefined>(undefined)
  const [editingDialogueReceivers, setEditingDialogueReceivers] = useState<string | undefined>(undefined)
  const [editingDialogue, setEditingDialogue] = useState<string | undefined>(undefined)
  const [draftParticipants, setDraftParticipants] = useState<Record<string, ChatAgent[]>>({})
  const [draftGenerationConfig, setDraftGenerationConfig] = useState<Record<string, Partial<GenerationConfig>>>({})
  const [draftParticipantModes, setDraftParticipantModes] = useState<Record<string, ParticipantMode>>({})
  const { toast } = useToast()
  const [showSortView, setShowSortView] = useState(false)

  const handleAccordionChange = (value: string | undefined) => {
    console.log('Accordion change:', { from: activeRound, to: value })
    if (value === activeRound) {
      setActiveRound(undefined)
    } else {
      setActiveRound(value)
    }
  }

  const handleRemoveRound = async (id: string) => {
    const response = await fetch(`/api/configs/${configId}/rounds/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorData = await response.json()
      const errorMessage = errorData.error || 'Failed to delete round'
      toast({
        title: "Error deleting round",
        description: errorMessage,
        variant: "destructive"
      })
      throw new Error(errorMessage)
    }

    // Update configsStore upon success
    deleteRound(configId, id)
    if (activeRound === id) {
      setActiveRound(undefined)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdateRound = useCallback(
    debounce(async (id: string, config: Partial<Round>) => {
      try {
        const round = rounds.find(r => r.id === id)
        if (!round) return

        const updatedRound = { ...round, ...config }

        // Extract participants to handle them separately
        const { participants, ...restOfRound } = updatedRound;

        // Create the payload with all fields from the round
        const payload = {
          ...restOfRound,
          // Handle participants specially since we need to map them to IDs
          participants: participants.map(p => p.id),
          // Ensure default values for certain fields
          depth: updatedRound.depth || 'medium',
          lengthType: updatedRound.lengthType || 'rounds',
          participantOrder: updatedRound.participantOrder || 'default',
          transition: updatedRound.transition || 'user',
          modelSelectionMode: updatedRound.modelSelectionMode || 'agent',
          selectedModel: updatedRound.selectedModel || '',
          // Include dataTool if it exists
          dataTool: updatedRound.dataTool,
          // Set the sequence based on the position in the rounds array
          sequence: rounds.findIndex(r => r.id === id),
        }

        // Log the payload for debugging
        console.log("Sending API payload:", {
          id,
          participantOrder: updatedRound.participantOrder,
          moderatorAgentId: updatedRound.moderatorAgentId,
          hasDataTool: !!updatedRound.dataTool
        });

        const response = await fetch(`/api/configs/${configId}/rounds/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update round')
        }
      } catch (error) {
        console.error('Error updating round:', error instanceof Error ? error.message : error)
        toast({
          title: "Error updating round",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        })
      }
    }, 500),
    [rounds, configId, toast]
  )

  const handleUpdateRound = async (id: string, config: Partial<Round>) => {
    // For debugging - to see what's being passed
    console.log("Updating round:", id, "with config:", config);
    
    // If participants are being updated, clean up dialogue selections
    if (config.participants) {
      const round = rounds.find(r => r.id === id);
      if (round && round.type === 'dialogue') {
        const participantIds = config.participants.map(p => p.id);
        
        // Clean up selected senders if they're no longer participants
        if (round.dialogueSelectedSenders) {
          const cleanedSenders = round.dialogueSelectedSenders.filter(senderId => 
            participantIds.includes(senderId)
          );
          if (cleanedSenders.length !== round.dialogueSelectedSenders.length) {
            config.dialogueSelectedSenders = cleanedSenders;
            console.log('[DialoguePanel] Cleaned up senders:', {
              was: round.dialogueSelectedSenders,
              now: cleanedSenders
            });
          }
        }
        
        // Clean up selected receivers if they're no longer participants
        if (round.dialogueSelectedReceivers) {
          const cleanedReceivers = round.dialogueSelectedReceivers.filter(receiverId => 
            participantIds.includes(receiverId)
          );
          if (cleanedReceivers.length !== round.dialogueSelectedReceivers.length) {
            config.dialogueSelectedReceivers = cleanedReceivers;
            console.log('[DialoguePanel] Cleaned up receivers:', {
              was: round.dialogueSelectedReceivers,
              now: cleanedReceivers
            });
          }
        }
      }
    }
    
    // Update configsStore immediately
    updateRound(configId, id, config)

    // Debounce the API call
    debouncedUpdateRound(id, config)
  }

  const handleSaveSort = async (newRounds: Round[]) => {
    try {
      // Update configsStore
      reorderRounds(configId, newRounds.map(round => round.id))

      // Update the API with a single request
      const response = await fetch(`/api/configs/${configId}/rounds/sort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundIds: newRounds.map(round => round.id)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to sort rounds')
      }

      setShowSortView(false)
    } catch (error) {
      console.error('Error reordering rounds:', error)
      toast({
        title: "Error",
        description: "Failed to reorder rounds. Please try again.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="w-full flex flex-col h-full">
      {showSortView ? (
        <ConfigRoundSort
          rounds={rounds}
          onSave={handleSaveSort}
          onCancel={() => setShowSortView(false)}
        />
      ) : (
        <>
          <div className="h-14 px-4 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold truncate max-w-[180px]">
                Chat Design
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      onClick={() => setShowSortView(true)}
                      className="h-8 w-8 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reorder Rounds</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary" 
                      onClick={() => window.open(`/chats/${configId}/chat/new`, '_blank')}
                      className="h-8 w-8 focus-visible:ring-0 focus-visible:ring-offset-0"
                      disabled={!configId}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open live chat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 flex flex-col gap-4">
              <Accordion 
                type="single" 
                collapsible
                value={activeRound}
                onValueChange={handleAccordionChange}
                className="space-y-4"
              >
                {Array.isArray(rounds) && rounds.map((round) => (
                  <ChatRoundItem
                    key={round.id}
                    round={round}
                    isActive={activeRound === round.id}
                    onRemove={handleRemoveRound}
                    onUpdate={handleUpdateRound}
                    onEditParticipants={(id) => setEditingParticipants(id)}
                    onEditLimit={(id) => setEditingLimit(id)}
                    onEditAction={(id) => setEditingAction(id)}
                    onEditStance={(id) => setEditingStance(id)}
                    onEditStyle={(id) => setEditingStyle(id)}
                    onEditOptions={(id) => setEditingOptions(id)}
                    onEditDataTool={(id) => setEditingDataTool(id)}
                    onEditDialogueSenders={(id) => setEditingDialogueSenders(id)}
                    onEditDialogueReceivers={(id) => setEditingDialogueReceivers(id)}
                    onEditDialogue={(id) => setEditingDialogue(id)}
                    encodeAvatarSvg={encodeAvatarSvg}
                    configId={configId}
                  />
                ))}
              </Accordion>

              <div className="flex justify-start">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowAddWizard(true)}
                      >
                        Add
                        <Plus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add a new round to this chat</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </ScrollArea>
        </>
      )}

      {editingLimit && (
        <ConfigRoundFlowPanel
          round={rounds.find(r => r.id === editingLimit)!}
          isOpen={true}
          onUpdate={config => handleUpdateRound(editingLimit, config)}
          onClose={() => setEditingLimit(undefined)}
          agents={agents}
          rounds={rounds}
          encodeAvatarSvg={encodeAvatarSvg}
        />
      )}

      {editingOptions && (
        <ConfigRoundOptionsPanel
          round={rounds.find(r => r.id === editingOptions)!}
          isOpen={true}
          onUpdate={(id, config) => handleUpdateRound(id, config)}
          onClose={() => setEditingOptions(undefined)}
        />
      )}

      {editingStyle && (
        <ConfigRoundStylePanel
          round={rounds.find(r => r.id === editingStyle)!}
          isOpen={true}
          onUpdate={handleUpdateRound}
          onClose={() => setEditingStyle(undefined)}
        />
      )}

      {editingDataTool && (
        <RoundDataTool
          round={rounds.find(r => r.id === editingDataTool)!}
          isOpen={true}
          onUpdate={handleUpdateRound}
          onClose={() => setEditingDataTool(undefined)}
        />
      )}

      {editingParticipants && (() => {
        const round = rounds.find(r => r.id === editingParticipants);
        if (!round) return null;

        return shouldShowInput(round.type, 'participant') ? (
          <ParticipantPanel
            round={round}
            isOpen={true}
            draftParticipant={draftParticipants[editingParticipants]?.[0] || round.participants[0]}
            onUpdateDraft={(participant) => setDraftParticipants({
              ...draftParticipants,
              [editingParticipants]: [participant]
            })}
            onSave={() => {
              if (draftParticipants[editingParticipants]) {
                handleUpdateRound(editingParticipants, { participants: draftParticipants[editingParticipants] })
              }
              setDraftParticipants({})
              setEditingParticipants(undefined)
            }}
            onClose={() => {
              setDraftParticipants({})
              setEditingParticipants(undefined)
            }}
            encodeAvatarSvg={encodeAvatarSvg}
          />
        ) : (
          <ParticipantsPanel
            round={round}
            isOpen={true}
            draftParticipants={draftParticipants[editingParticipants] || round.participants || []}
            generationConfig={draftGenerationConfig[editingParticipants] || {
              participantMode: round.participantMode || 'SELECT',
              participantGenerationPrompt: round.participantGenerationPrompt || '',
              participantLengthType: round.participantLengthType || 'FIXED',
              participantLength: round.participantLength || 3,
            }}
            mode={draftParticipantModes[editingParticipants] || round.participantMode || 'SELECT'}
            onUpdateDraft={(participants) => setDraftParticipants({
              ...draftParticipants,
              [editingParticipants]: participants
            })}
            onUpdateGenerationConfig={(config) => {
              const roundId = editingParticipants;
              if (!roundId) return;

              const currentRound = rounds.find(r => r.id === roundId);
              if (!currentRound) return;

              // Get the current draft or initialize it from the round's data
              const currentDraft = draftGenerationConfig[roundId] || {
                participantMode: currentRound.participantMode || 'SELECT',
                participantGenerationPrompt: currentRound.participantGenerationPrompt || '',
                participantLengthType: currentRound.participantLengthType || 'FIXED',
                participantLength: currentRound.participantLength || 3,
              };
        
              setDraftGenerationConfig({
                ...draftGenerationConfig,
                [roundId]: { ...currentDraft, ...config }
              });
            }}
            onModeChange={(mode) => setDraftParticipantModes({
              ...draftParticipantModes,
              [editingParticipants]: mode
            })}
            onSave={() => {
              const roundId = editingParticipants;
              if (!roundId) return;

              const currentRound = rounds.find(r => r.id === roundId);
              if (!currentRound) return;

              const finalMode = draftParticipantModes[roundId] || currentRound.participantMode || 'SELECT';

              const payload: Partial<Round> = {
                participantMode: finalMode,
                // Always include the latest generation config from drafts
                ...draftGenerationConfig[roundId],
              };

              if (finalMode === 'SELECT') {
                if (draftParticipants[roundId]) {
                  payload.participants = draftParticipants[roundId];
                }
              } else {
                // When generating, clear participants
                payload.participants = [];
              }

              // Check for any changes in mode, config, or participants
              const hasChanges = 
                !!draftParticipantModes[roundId] || 
                !!draftGenerationConfig[roundId] || 
                !!draftParticipants[roundId];

              if (hasChanges) {
                handleUpdateRound(roundId, payload);
              }

              // Clear all draft states after saving
              setDraftParticipants({})
              setDraftGenerationConfig({})
              setDraftParticipantModes({})
              setEditingParticipants(undefined)
            }}
            onClose={() => {
              setDraftParticipants({})
              setDraftGenerationConfig({})
              setDraftParticipantModes({})
              setEditingParticipants(undefined)
            }}
            encodeAvatarSvg={encodeAvatarSvg}
          />
        )
      })()}

      {editingAction && (
        <ActionPanel
          round={rounds.find(r => r.id === editingAction)!}
          isOpen={true}
          onUpdate={config => handleUpdateRound(editingAction, config)}
          onClose={() => setEditingAction(undefined)}
        />
      )}

      {editingStance && (
        <StancePanel
          round={rounds.find(r => r.id === editingStance)!}
          isOpen={true}
          onUpdate={config => handleUpdateRound(editingStance, config)}
          onClose={() => setEditingStance(undefined)}
          encodeAvatarSvg={encodeAvatarSvg}
        />
      )}

      {editingDialogueSenders && (
        <DialogueSendersPanel
          round={rounds.find(r => r.id === editingDialogueSenders)!}
          isOpen={true}
          onUpdate={config => handleUpdateRound(editingDialogueSenders, config)}
          onClose={() => setEditingDialogueSenders(undefined)}
          encodeAvatarSvg={encodeAvatarSvg}
        />
      )}

      {editingDialogueReceivers && (
        <DialogueReceiversPanel
          round={rounds.find(r => r.id === editingDialogueReceivers)!}
          isOpen={true}
          onUpdate={config => handleUpdateRound(editingDialogueReceivers, config)}
          onClose={() => setEditingDialogueReceivers(undefined)}
          encodeAvatarSvg={encodeAvatarSvg}
        />
      )}

      {editingDialogue && (
        <DialoguePanel
          round={rounds.find(r => r.id === editingDialogue)!}
          isOpen={true}
          onUpdate={config => handleUpdateRound(editingDialogue, config)}
          onClose={() => setEditingDialogue(undefined)}
          encodeAvatarSvg={encodeAvatarSvg}
        />
      )}

      <RoundAddWizard
        isOpen={showAddWizard}
        onClose={() => setShowAddWizard(false)}
        configId={configId}
        onRoundAdded={(roundId) => setActiveRound(roundId)}
      />

      {(editingLimit || editingParticipants || editingAction || editingStance || editingStyle || editingOptions || editingDataTool || editingDialogueSenders || editingDialogueReceivers || editingDialogue) && (
        <div
          className="fixed inset-0 bg-black/20"
          onClick={() => {
            setEditingLimit(undefined)
            setEditingParticipants(undefined)
            setEditingAction(undefined)
            setEditingStance(undefined)
            setEditingStyle(undefined)
            setEditingOptions(undefined)
            setEditingDataTool(undefined)
            setEditingDialogueSenders(undefined)
            setEditingDialogueReceivers(undefined)
            setEditingDialogue(undefined)
          }}
        />
      )}
    </div>
  )
} 