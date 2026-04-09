import { type Round } from "../../types/config-round"
import { useState } from "react"
import { useActiveConfigModels } from "@/lib/hooks/useConfigModels"
import { RoundPanel } from './RoundPanel'
import { RoundOptionsEdit } from './edit/RoundOptionsEdit'
import { createRoundOptionsDraft } from '../../types/config-round'

interface ConfigRoundOptionsPanelProps {
  round: Round
  isOpen?: boolean
  onUpdate: (id: string, config: Partial<Round>) => void
  onClose: () => void
}

export function ConfigRoundOptionsPanel({
  round,
  isOpen = true,
  onUpdate,
  onClose,
}: ConfigRoundOptionsPanelProps) {
  const [draft, setDraft] = useState(createRoundOptionsDraft(round))
  const { availableModels } = useActiveConfigModels()

  const handleSave = () => {
    onUpdate(round.id, {
      instructions: draft.instructions,
      showPrompts: draft.showPrompts,
      agentQuestions: draft.agentQuestions,
      agentSelfReflection: draft.agentSelfReflection,
      agentIsolation: draft.agentIsolation,
      isPrivate: draft.isPrivate,
      modelSelectionMode: draft.modelSelectionMode,
      selectedModel: draft.modelSelectionMode === 'specific' ? draft.selectedModel : '',
    })
    onClose()
  }

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  return (
    <RoundPanel
      title="Edit Options"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <RoundOptionsEdit
        draft={draft}
        onUpdateDraft={updateDraft}
        availableModels={availableModels}
      />
    </RoundPanel>
  )
}
