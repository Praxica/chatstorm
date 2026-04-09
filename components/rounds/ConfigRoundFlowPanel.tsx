import { type Round } from '../../types/config-round'
import { useState } from "react"
import { type ChatAgent } from '../../lib/stores/chatAgentStore'
import { RoundPanel } from './RoundPanel'
import { RoundFlowEdit } from './edit/RoundFlowEdit'
import { createRoundFlowDraft } from '../../types/config-round'

interface ConfigRoundFlowPanelProps {
  round: Round
  isOpen: boolean
  onUpdate: (updates: Partial<Round>) => void
  onClose: () => void
  agents?: ChatAgent[]
  rounds?: Round[]
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function ConfigRoundFlowPanel({ round, isOpen, onUpdate, onClose, agents = [], rounds = [], encodeAvatarSvg }: ConfigRoundFlowPanelProps) {
  const [draft, setDraft] = useState(createRoundFlowDraft(round))

  const handleSave = () => {
    onUpdate(draft)
    onClose()
  }

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  return (
    <RoundPanel
      title="Edit Flow"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <RoundFlowEdit
        round={round}
        draft={draft}
        onUpdateDraft={updateDraft}
        agents={agents}
        rounds={rounds}
        encodeAvatarSvg={encodeAvatarSvg}
      />
    </RoundPanel>
  )
}
