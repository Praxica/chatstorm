import { useState } from 'react'
import { type Round } from '../../types/config-round'
import { useChatAgentStore } from '@/lib/stores/chatAgentStore'
import { RoundPanel } from './RoundPanel'
import { RoundDialogueEdit } from './edit/RoundDialogueEdit'
import { createRoundDialogueDraft } from '@/types/config-round'

interface DialoguePanelProps {
  round: Round
  isOpen: boolean
  onUpdate: (config: Partial<Round>) => void
  onClose: () => void
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function DialoguePanel({ 
  round, 
  isOpen, 
  onUpdate, 
  onClose,
  encodeAvatarSvg
}: DialoguePanelProps) {
  const agents = useChatAgentStore(state => state.agents)
  const [draft, setDraft] = useState(createRoundDialogueDraft(round))

  const handleSave = () => {
    onUpdate({
      dialogueInitialMessageMode: draft.initialMessageMode,
      dialogueInitialMessage: draft.initialMessageMode === 'manual' ? draft.initialMessage : undefined,
      dialogueInitialMessageInstructions: draft.initialMessageMode === 'generate' ? draft.initialMessageInstructions : undefined,
      dialogueInstructionsMode: draft.dialogueInstructionsMode,
      dialogueInstructions: draft.dialogueInstructionsMode === 'manual' ? draft.dialogueInstructions : undefined,
      dialogueInstructionsPrompt: draft.dialogueInstructionsMode === 'generate' ? draft.dialogueInstructionsPrompt : undefined,
      dialogueLengthMode: draft.dialogueLengthMode,
      dialogueLength: draft.dialogueLength,
      dialogueLengthInstructions: draft.dialogueLengthMode !== 'fixed' ? draft.dialogueLengthInstructions : undefined,
      dialogueLengthModerator: draft.dialogueLengthMode === 'moderator_decides' ? draft.dialogueLengthModeratorAgentId : undefined,
    })
    onClose()
  }

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  return (
    <RoundPanel
      title="Dialogue Configuration"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      description="Configure the initial message, instructions, and length for this dialogue."
    >
      <RoundDialogueEdit
        draft={draft}
        onUpdateDraft={updateDraft}
        agents={agents}
        encodeAvatarSvg={encodeAvatarSvg}
      />
    </RoundPanel>
  )
}
