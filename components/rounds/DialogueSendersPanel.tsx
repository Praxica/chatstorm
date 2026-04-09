import { useState, useCallback, useEffect } from 'react'
import { type Round } from '../../types/config-round'
import { useChatAgentStore, type ChatAgent } from '@/lib/stores/chatAgentStore'
import { RoundPanel } from './RoundPanel'
import { RoundDialogueSendersEdit } from './edit/RoundDialogueSendersEdit'
import { createRoundDialogueSendersDraft } from '@/types/config-round'

interface DialogueSendersPanelProps {
  round: Round
  isOpen: boolean
  onUpdate: (config: Partial<Round>) => void
  onClose: () => void
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function DialogueSendersPanel({ 
  round, 
  isOpen, 
  onUpdate, 
  onClose,
  encodeAvatarSvg
}: DialogueSendersPanelProps) {
  const agents = useChatAgentStore(state => state.agents)
  const [draft, setDraft] = useState(createRoundDialogueSendersDraft(round))

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

  // Sync selected senders when participants change
  useEffect(() => {
    const currentParticipantIds = resolvedParticipants.map(p => p.id)
    setDraft(prev => ({
      ...prev,
      selectedSenders: prev.selectedSenders.filter(id => currentParticipantIds.includes(id))
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantIds])

  const handleSave = () => {
    const participantIds = resolvedParticipants.map(p => p.id)
    const cleanedSelectedSenders = draft.selectedSenders.filter(id => participantIds.includes(id))
    
    onUpdate({
      dialogueSenderMode: draft.senderMode,
      dialogueSelectedSenders: draft.senderMode === 'select' ? cleanedSelectedSenders : undefined,
      dialogueSenderInstructions: draft.senderMode !== 'all_participants' && draft.senderMode !== 'select' ? draft.senderInstructions : undefined,
      dialogueSenderModerator: draft.senderMode === 'moderator_decides' ? draft.senderModeratorAgentId : undefined,
    })
    onClose()
  }

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  return (
    <RoundPanel
      title="Senders Configuration"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      description="Configure who will send messages in this dialogue."
    >
      <RoundDialogueSendersEdit
        draft={draft}
        onUpdateDraft={updateDraft}
        participants={resolvedParticipants}
        allAgents={agents}
        encodeAvatarSvg={encodeAvatarSvg}
      />
    </RoundPanel>
  )
}
