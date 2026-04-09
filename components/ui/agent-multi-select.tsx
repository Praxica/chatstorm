'use client'

import { useState } from "react"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { Avatar, AvatarImage, AvatarFallback } from "./avatar"
import { Users, ChevronDown } from 'lucide-react'
import { AgentSelectionModal } from "./agent-selection-modal"
import { type ChatAgent } from '@/lib/stores/chatAgentStore'

export interface AgentMultiSelectProps {
  agents: ChatAgent[]
  selectedAgentIds: string[]
  onSelectionChange: (agentIds: string[]) => void
  encodeAvatarSvg: (svg: string | undefined) => string
  modalThreshold?: number
  title?: string
  description?: string
  placeholder?: string
  showInlineSelection?: boolean
}

export function AgentMultiSelect({
  agents,
  selectedAgentIds,
  onSelectionChange,
  encodeAvatarSvg,
  modalThreshold = 10,
  title = "Select Agents",
  description,
  placeholder,
  showInlineSelection = true
}: AgentMultiSelectProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const shouldUseModal = agents.length > modalThreshold
  const selectedAgents = agents.filter(agent => selectedAgentIds.includes(agent.id))

  const handleAgentToggle = (agentId: string) => {
    const newSelection = selectedAgentIds.includes(agentId)
      ? selectedAgentIds.filter(id => id !== agentId)
      : [...selectedAgentIds, agentId]
    onSelectionChange(newSelection)
  }

  if (shouldUseModal) {
    return (
      <>
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-between h-10"
            onClick={() => setIsModalOpen(true)}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm">
                {selectedAgents.length > 0 
                  ? `${selectedAgents.length} agent${selectedAgents.length !== 1 ? 's' : ''} selected`
                  : (placeholder || "Select agents")
                }
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>

          {/* Show selected agents */}
          {selectedAgents.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
              {selectedAgents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-1.5 bg-muted/50 rounded-sm">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                      <AvatarFallback className="text-xs">{agent.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{agent.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleAgentToggle(agent.id)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <AgentSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedAgents={selectedAgentIds}
          onSelectionChange={onSelectionChange}
          title={title}
          description={description}
          encodeAvatarSvg={encodeAvatarSvg}
          allowMultiple={true}
        />
      </>
    )
  }

  // Use inline checkboxes for smaller lists
  if (!showInlineSelection) {
    return null
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <div key={agent.id} className="flex items-start space-x-3">
          <Checkbox
            id={`agent-${agent.id}`}
            checked={selectedAgentIds.includes(agent.id)}
            onCheckedChange={() => handleAgentToggle(agent.id)}
            className="mt-0.5"
          />
          <label
            htmlFor={`agent-${agent.id}`}
            className="flex items-start gap-2 cursor-pointer flex-1 text-sm"
          >
            <Avatar className="h-4 w-4 mt-0.5">
              <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
              <AvatarFallback className="text-xs">{agent.name[0]}</AvatarFallback>
            </Avatar>
            <span className="leading-normal">{agent.name}</span>
          </label>
        </div>
      ))}
    </div>
  )
}