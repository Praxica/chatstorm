import { useState, useCallback, useEffect } from 'react'
import { type Round } from '../../types/config-round'
import { useChatAgentStore, type ChatAgent } from '@/lib/stores/chatAgentStore'
import { RoundPanel } from './RoundPanel'
import { RoundDialogueReceiversEdit } from './edit/RoundDialogueReceiversEdit'
import { createRoundDialogueReceiversDraft } from '@/types/config-round'

interface DialogueReceiversPanelProps {
  round: Round
  isOpen: boolean
  onUpdate: (config: Partial<Round>) => void
  onClose: () => void
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function DialogueReceiversPanel({ 
  round, 
  isOpen, 
  onUpdate, 
  onClose,
  encodeAvatarSvg
}: DialogueReceiversPanelProps) {
  const agents = useChatAgentStore(state => state.agents)
  const [draft, setDraft] = useState(createRoundDialogueReceiversDraft(round))

  // Helper function to resolve participant IDs to full agent objects
  const resolveParticipants = useCallback((): ChatAgent[] => {
    if (!round.participants) return []
    
    return round.participants
      .map(participant => {
        if (participant.name) return participant as ChatAgent
        const agent = agents.find(a => a.id === participant.id)
        return agent
      })
      .filter((agent): agent is ChatAgent => agent !== undefined && agent !== null)
  }, [round.participants, agents])
  
  const resolvedParticipants = resolveParticipants()
  const participantIds = JSON.stringify(resolvedParticipants.map(p => p.id))

  // Sync selected receivers when participants change
  useEffect(() => {
    const currentParticipantIds = resolvedParticipants.map(p => p.id)
    setDraft(prev => ({
      ...prev,
      selectedReceivers: prev.selectedReceivers.filter(id => currentParticipantIds.includes(id))
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantIds])

  const handleSave = () => {
    const participantIds = resolvedParticipants.map(p => p.id)
    const cleanedSelectedReceivers = draft.selectedReceivers.filter(id => participantIds.includes(id))
    
    onUpdate({
      dialogueReceiverMode: draft.receiverMode,
      dialogueSelectedReceivers: draft.receiverMode === 'select' ? cleanedSelectedReceivers : undefined,
      dialogueReceiverInstructions: draft.receiverMode !== 'all_participants' && draft.receiverMode !== 'select' ? draft.receiverInstructions : undefined,
      dialogueReceiverModerator: draft.receiverMode === 'moderator_decides' ? draft.receiverModeratorAgentId : undefined,
    })
    onClose()
  }

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  return (
    <RoundPanel
      title="Receivers Configuration"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      description="Configure who will receive messages from each sender in this dialogue."
    >
      <RoundDialogueReceiversEdit
        draft={draft}
        onUpdateDraft={updateDraft}
        participants={resolvedParticipants}
        allAgents={agents}
        encodeAvatarSvg={encodeAvatarSvg}
      />
    </RoundPanel>
  )
}
