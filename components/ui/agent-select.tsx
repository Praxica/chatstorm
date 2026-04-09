'use client'

import { useState } from "react"
import { Button } from "./button"
import { Avatar, AvatarImage, AvatarFallback } from "./avatar"
import { ChevronDown, Users, CheckSquare, Wand2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { AgentSelectionModal } from "./agent-selection-modal"
import { useChatAgentStore, type ChatAgent } from '@/lib/stores/chatAgentStore'
import { Checkbox } from './checkbox'
import { Tabs, TabsList, TabsTrigger } from './tabs'
import { ParticipantMode } from '@prisma/client'
import ProjectFilter from '../ProjectFilter'
import { AgentSortControl } from './agent-sort-control'
import { useConfigsStore } from '@/lib/stores/configsStore'
import { cn } from '@/lib/utils'

// Single select props
interface AgentSelectSingleProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  encodeAvatarSvg: (svg: string | undefined) => string
  agents?: ChatAgent[]
  modalThreshold?: number
  multiple?: false
  embedded?: never
}

// Multi select props
interface AgentSelectMultipleProps {
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  encodeAvatarSvg: (svg: string | undefined) => string
  agents?: ChatAgent[]
  modalThreshold?: number
  multiple: true
  embedded?: boolean
}

type AgentSelectProps = AgentSelectSingleProps | AgentSelectMultipleProps

export function AgentSelect(props: AgentSelectProps) {
  const {
    placeholder = props.multiple ? "Select agents" : "Select agent",
    encodeAvatarSvg,
    agents: providedAgents,
    modalThreshold = 10,
  } = props

  const storeAgents = useChatAgentStore(state => state.agents)
  const agents = providedAgents || storeAgents

  const [isModalOpen, setIsModalOpen] = useState(false)

  const shouldUseModal = agents.length > modalThreshold

  // Single select logic
  if (!props.multiple) {
    const { value, onValueChange } = props

    const selectedAgent = agents.find(agent => agent.id === value)

    const handleModalSelection = (agentIds: string[]) => {
      if (agentIds.length > 0) {
        onValueChange(agentIds[0])
      } else {
        onValueChange('')
      }
    }

    if (shouldUseModal) {
      return (
        <>
          <Button
            variant="outline"
            className="w-full justify-between h-10"
            onClick={() => setIsModalOpen(true)}
          >
            <div className="flex items-center gap-2">
              {selectedAgent ? (
                <>
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={encodeAvatarSvg(selectedAgent.avatar)} />
                    <AvatarFallback className="text-xs">{selectedAgent.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{selectedAgent.name}</span>
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{placeholder}</span>
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>

          <AgentSelectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            selectedAgents={value ? [value] : []}
            onSelectionChange={handleModalSelection}
            title="Select Agent"
            description="Choose an agent from the list below"
            encodeAvatarSvg={encodeAvatarSvg}
            allowMultiple={false}
          />
        </>
      )
    }

    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                  <AvatarFallback className="text-xs">{agent.name[0]}</AvatarFallback>
                </Avatar>
                {agent.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Multi select logic - props.multiple is true here, so TypeScript narrows to AgentSelectMultipleProps
  const { value, onValueChange, embedded = false } = props

  const selectedAgents = agents.filter(agent => value.includes(agent.id))

  if (embedded) {
    // Embedded mode - render selection UI inline without modal
    return (
      <AgentSelectionEmbedded
        selectedAgents={value}
        onSelectionChange={onValueChange}
        encodeAvatarSvg={encodeAvatarSvg}
        agents={agents}
      />
    )
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-between h-10"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex items-center gap-2">
          {selectedAgents.length > 0 ? (
            <>
              <Users className="h-4 w-4" />
              <span className="text-sm">
                {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} selected
              </span>
            </>
          ) : (
            <>
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{placeholder}</span>
            </>
          )}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      <AgentSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedAgents={value}
        onSelectionChange={onValueChange}
        title="Select Agents"
        description="Choose agents from the list below"
        encodeAvatarSvg={encodeAvatarSvg}
        allowMultiple={true}
      />
    </>
  )
}

// Embedded selection component for inline use
interface AgentSelectionEmbeddedProps {
  selectedAgents: string[]
  onSelectionChange: (agentIds: string[]) => void
  encodeAvatarSvg: (svg: string | undefined) => string
  agents: ChatAgent[]
}

function AgentSelectionEmbedded({
  selectedAgents,
  onSelectionChange,
  encodeAvatarSvg,
  agents: _agents
}: AgentSelectionEmbeddedProps) {
  const activeConfig = useConfigsStore(state => state.activeConfig)
  const getSortedAgents = useChatAgentStore(state => state.getSortedAgents)

  const [mode, setMode] = useState<ParticipantMode>(ParticipantMode.SELECT)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    activeConfig?.projects?.map((p: any) => p.id) || []
  )

  const filteredAgents = getSortedAgents().filter((agent: ChatAgent) => {
    if (selectedProjectIds.length === 0) return true
    return agent.projectIds?.some((id: string) => selectedProjectIds.includes(id)) ?? false
  })

  const handleToggleAgent = (agentId: string) => {
    if (selectedAgents.includes(agentId)) {
      onSelectionChange(selectedAgents.filter(id => id !== agentId))
    } else {
      onSelectionChange([...selectedAgents, agentId])
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs value={mode} onValueChange={(value) => setMode(value as ParticipantMode)} className="w-full">
        <TabsList className="grid gap-0 w-full grid-cols-2 h-11 bg-transparent p-0">
          <TabsTrigger
            value="SELECT"
            className="pl-4 pt-2 pb-2 text-sm text-gray-600 rounded-tl-md rounded-tr-none rounded-b-none border-b border-black bg-gray-50 hover:bg-gray-100 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black data-[state=active]:shadow-none flex items-center gap-2"
          >
            <CheckSquare className="h-4 w-4" />
            Select
          </TabsTrigger>
          <TabsTrigger
            value="GENERATE"
            className="pl-4 pt-2 pb-2 text-sm text-gray-600 rounded-tr-md rounded-tl-none rounded-b-none border-b border-black bg-gray-50 hover:bg-gray-100 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black data-[state=active]:shadow-none flex items-center gap-2"
          >
            <Wand2 className="h-4 w-4" />
            Generate
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* SELECT Mode */}
      <div className={cn(mode === ParticipantMode.SELECT ? 'block' : 'hidden', 'space-y-4')}>
        <div className="flex gap-2">
          <ProjectFilter
            selectedProjectIds={selectedProjectIds}
            onChange={setSelectedProjectIds}
          />
          <AgentSortControl />
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs rounded-full px-3"
            onClick={() => onSelectionChange(filteredAgents.map((a: ChatAgent) => a.id))}
          >
            Select All
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs rounded-full px-3"
            onClick={() => onSelectionChange([])}
          >
            Clear
          </Button>
        </div>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filteredAgents.map((agent: ChatAgent) => {
            const isSelected = selectedAgents.includes(agent.id)

            return (
              <div
                key={agent.id}
                className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded-md cursor-pointer"
                onClick={() => handleToggleAgent(agent.id)}
              >
                <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                <Avatar className="h-6 w-6">
                  <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                  <AvatarFallback>{agent.name[0]}</AvatarFallback>
                </Avatar>
                <div className="text-sm flex-1">{agent.name}</div>
              </div>
            )
          })}
          {filteredAgents.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">
              No agents found for the selected projects
            </div>
          )}
        </div>
      </div>

      {/* GENERATE Mode */}
      <div className={cn(mode === ParticipantMode.GENERATE ? 'block' : 'hidden')}>
        <div className="text-center text-gray-500 py-8">
          Generate mode coming soon
        </div>
      </div>
    </div>
  )
}