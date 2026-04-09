import { type Round, type StanceType } from '../../types/config-round'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState } from 'react'
import { RoundPanel } from './RoundPanel'

interface StancePanelProps {
  round: Round
  isOpen: boolean
  onUpdate: (config: Partial<Round>) => void
  onClose: () => void
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function StancePanel({
  round,
  isOpen,
  onUpdate,
  onClose,
  encodeAvatarSvg
}: StancePanelProps) {
  const [draft, setDraft] = useState({
    stanceType: round.stanceType || 'ai',
    stances: round.stances || []
  })

  const handleStanceTypeChange = (value: StanceType) => {
    setDraft({ 
      stanceType: value,
      // Clear stances when switching to AI
      stances: value === 'ai' ? [] : draft.stances 
    })
  }

  const handleStanceChange = (agentId: string, stance: string) => {
    const currentStances = draft.stances
    const existingIndex = currentStances.findIndex(s => s.agentId === agentId)
    
    let newStances
    if (existingIndex >= 0) {
      // Update existing stance
      newStances = [...currentStances]
      newStances[existingIndex] = { agentId, stance }
    } else {
      // Add new stance
      newStances = [...currentStances, { agentId, stance }]
    }
    
    setDraft({ ...draft, stances: newStances })
  }

  const handleSave = () => {
    onUpdate({
      stanceType: draft.stanceType,
      stances: draft.stanceType === 'custom' ? draft.stances : []
    })
    onClose()
  }

  return (
    <RoundPanel
      title="Edit Stance"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-semibold">Stance Assignment</label>
          <RadioGroup 
            value={draft.stanceType} 
            onValueChange={handleStanceTypeChange}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ai" id="ai" />
              <label htmlFor="ai" className="text-sm font-medium leading-none">AI decides</label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <label htmlFor="custom" className="text-sm font-medium leading-none">Custom</label>
            </div>
          </RadioGroup>
        </div>

        {draft.stanceType === 'custom' && (
          <div className="space-y-2 ml-6 mt-2">
            {round.participants.map(agent => (
              <div key={agent.id} className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                        <AvatarFallback>{agent.name[0] || '?'}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{agent.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Input 
                  placeholder={`${agent.name}'s stance`}
                  value={draft.stances.find(s => s.agentId === agent.id)?.stance || ''}
                  onChange={(e) => handleStanceChange(agent.id, e.target.value)}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </RoundPanel>
  )
}