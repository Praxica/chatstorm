import { type Round } from '../../types/config-round'
import { useState } from "react"
import { RoundPanel } from './RoundPanel'
import { RoundStyleEdit } from './edit/RoundStyleEdit'
import { createRoundStyleDraft } from '../../types/config-round'
import { CREATIVITY_LABELS } from "../ui/creativity-slider"

interface ConfigRoundStylePanelProps {
  round: Round
  isOpen?: boolean
  onUpdate: (id: string, config: Partial<Round>) => void
  onClose: () => void
}

export function ConfigRoundStylePanel({
  round,
  isOpen = true,
  onUpdate,
  onClose,
}: ConfigRoundStylePanelProps) {
  const [draft, setDraft] = useState(createRoundStyleDraft(round))

  const handleSave = () => {
    onUpdate(round.id, {
      depth: draft.depth,
      creativityType: draft.creativityType,
      creativityNumber: draft.creativityType === "custom" ? CREATIVITY_LABELS[draft.creativityIndex as keyof typeof CREATIVITY_LABELS].value : undefined,
    })
    onClose()
  }

  const updateDraft = (updates: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  return (
    <RoundPanel
      title="Edit Style"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <RoundStyleEdit
        draft={draft}
        onUpdateDraft={updateDraft}
      />
    </RoundPanel>
  )
}
