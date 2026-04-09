import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar"
import { type Round } from '../../types/config-round'
import { useChatAgentStore, type ChatAgent } from '../../lib/stores/chatAgentStore'
import ProjectFilter from "../ProjectFilter"
import { useState } from "react"
import { useConfigsStore } from "../../lib/stores/configsStore"
import { AgentSortControl } from "../ui/agent-sort-control"
import { RoundPanel } from './RoundPanel'

interface ParticipantPanelProps {
  round: Round
  isOpen: boolean
  draftParticipant: ChatAgent | undefined
  onUpdateDraft: (participant: ChatAgent) => void
  onSave: () => void
  onClose: () => void
  encodeAvatarSvg: (svg: string | undefined) => string
}

export function ParticipantPanel({
  round: _round,
  isOpen,
  draftParticipant,
  onUpdateDraft,
  onSave,
  onClose,
  encodeAvatarSvg
}: ParticipantPanelProps) {
  const activeConfig = useConfigsStore(state => state.activeConfig)
  const getSortedAgents = useChatAgentStore(state => state.getSortedAgents)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    activeConfig?.projects?.map(p => p.id) || []
  );

  // Get sorted agents from store, then filter by selected projects
  const filteredAgents = getSortedAgents().filter((agent: ChatAgent) => {
    if (selectedProjectIds.length === 0) return true;
    return agent.projectIds?.some((id: string) => selectedProjectIds.includes(id)) ?? false;
  });

  const handleSave = () => {
    onSave()
  }

  return (
    <RoundPanel
      title="Select Participant"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
    >
      <div className="space-y-6">
        <div className="flex gap-2">
          <ProjectFilter
            selectedProjectIds={selectedProjectIds}
            onChange={setSelectedProjectIds}
          />
          <AgentSortControl />
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          <RadioGroup
            value={draftParticipant?.id}
            onValueChange={(value) => {
              const selectedAgent = filteredAgents.find((a: ChatAgent) => a.id === value)
              if (selectedAgent) {
                onUpdateDraft(selectedAgent)
              }
            }}
            className="space-y-1"
          >
            {filteredAgents.map((agent: ChatAgent) => (
              <div
                key={agent.id}
                className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded-md cursor-pointer"
                onClick={() => onUpdateDraft(agent)}
              >
                <RadioGroupItem value={agent.id} id={agent.id} />
                <Avatar className="h-6 w-6">
                  <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                  <AvatarFallback>{agent.name[0]}</AvatarFallback>
                </Avatar>
                <label htmlFor={agent.id} className="text-sm cursor-pointer flex-1">
                  {agent.name}
                </label>
              </div>
            ))}
            {filteredAgents.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                No agents found for the selected projects
              </div>
            )}
          </RadioGroup>
        </div>
      </div>
    </RoundPanel>
  )
}