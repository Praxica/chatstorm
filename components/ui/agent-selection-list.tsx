'use client'

import { useState, useMemo, useRef } from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Checkbox } from "./checkbox"
import { Avatar, AvatarImage, AvatarFallback } from "./avatar"
import { Search, X, Check } from 'lucide-react'
import { useChatAgentStore, type ChatAgent } from '@/lib/stores/chatAgentStore'
import ProjectFilter from "../ProjectFilter"
import { AgentSortControl } from "./agent-sort-control"
import { useConfigsStore } from "@/lib/stores/configsStore"
import { AgentAvatarList } from "./agent-avatar-list"

interface AgentSelectionListProps {
  selectedAgents: string[]
  onSelectionChange: (agentIds: string[]) => void
  encodeAvatarSvg: (svg: string | undefined) => string
  allowMultiple?: boolean
  showSearch?: boolean
  showFilters?: boolean
  showSelectAllClear?: boolean
  onAgentClick?: (agentId: string) => void // For single-select mode that closes immediately
  initialProjectFilter?: string[] // Initial project IDs to filter by
}

export function AgentSelectionList({
  selectedAgents,
  onSelectionChange,
  encodeAvatarSvg,
  allowMultiple = true,
  showSearch = true,
  showFilters = true,
  showSelectAllClear = true,
  onAgentClick,
  initialProjectFilter
}: AgentSelectionListProps) {
  const activeConfig = useConfigsStore(state => state.activeConfig)
  const getSortedAgents = useChatAgentStore(state => state.getSortedAgents)
  const allAgents = useChatAgentStore(state => state.agents)
  const sortBy = useChatAgentStore(state => state.sortBy)
  const sortDirection = useChatAgentStore(state => state.sortDirection)
  const projectFilter = useChatAgentStore(state => state.projectFilter)
  const setProjectFilter = useChatAgentStore(state => state.setProjectFilter)

  const shouldShowFiltersAndSearch = allAgents.length > 7

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() => {
    // Priority: saved filter > initial filter > config projects > empty
    if (projectFilter.length > 0) return projectFilter
    if (initialProjectFilter) return initialProjectFilter
    return activeConfig?.projects?.map(p => p.id) || []
  })
  const [searchTerm, setSearchTerm] = useState("")
  const agentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Helper to update both local and global project filter
  const handleProjectFilterChange = (projectIds: string[]) => {
    setSelectedProjectIds(projectIds)
    setProjectFilter(projectIds)
  }

  // Scroll to agent in the list
  const scrollToAgent = (agent: ChatAgent) => {
    const element = agentRefs.current[agent.id]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Get sorted and filtered agents
  const filteredAgents = useMemo(() => {
    let agents = getSortedAgents()

    // Filter by selected projects
    if (selectedProjectIds.length > 0) {
      agents = agents.filter((agent: ChatAgent) =>
        agent.projectIds?.some((id: string) => selectedProjectIds.includes(id)) ?? false
      )
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      agents = agents.filter((agent: ChatAgent) =>
        agent.name.toLowerCase().includes(term) ||
        agent.role?.toLowerCase().includes(term)
      )
    }

    return agents
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSortedAgents, selectedProjectIds, searchTerm, sortBy, sortDirection])

  const handleAgentToggle = (agentId: string) => {
    if (!allowMultiple && onAgentClick) {
      onAgentClick(agentId)
      return
    }

    if (allowMultiple) {
      const newSelection = selectedAgents.includes(agentId)
        ? selectedAgents.filter(id => id !== agentId)
        : [...selectedAgents, agentId]
      onSelectionChange(newSelection)
    }
  }

  const handleSelectAll = () => {
    const allVisibleIds = filteredAgents.map(agent => agent.id)
    onSelectionChange(allVisibleIds)
  }

  const handleClear = () => {
    onSelectionChange([])
  }

  return (
    <div className="flex flex-col space-y-3">
      {/* Top line: Filters and Search */}
      {shouldShowFiltersAndSearch && (
        <div className="flex gap-2 items-center">
          {showFilters && (
            <>
              <ProjectFilter
                selectedProjectIds={selectedProjectIds}
                onChange={handleProjectFilterChange}
              />
              <AgentSortControl />
            </>
          )}

          {showSearch && (
            <div className="relative w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder=""
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Second line: Selected avatars and controls */}
      {allowMultiple && showSelectAllClear && (
        <div className="flex gap-2 items-center">
          {selectedAgents.length > 0 && (
            <>
              <AgentAvatarList
                agents={selectedAgents.map(id => getSortedAgents().find((a: ChatAgent) => a.id === id) || null)}
                maxDisplay={8}
                encodeAvatarSvg={encodeAvatarSvg}
                onAgentClick={scrollToAgent}
                showOverflowCount={false}
                avatarClassName="h-7 w-7"
              />
              <span className="text-sm">
                {selectedAgents.length > 8 && (
                  <span className="text-gray-400">... </span>
                )}
                <span className="text-gray-400">(</span>
                <span className="text-gray-600">{selectedAgents.length}</span>
                <span className="text-gray-400">)</span>
              </span>
            </>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-xs rounded-full px-3 ml-1"
            onClick={handleSelectAll}
            disabled={filteredAgents.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-xs rounded-full px-3"
            onClick={handleClear}
            disabled={selectedAgents.length === 0}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Agent List with scroll */}
      <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
        <div className="space-y-1">
          {filteredAgents.map((agent: ChatAgent) => {
            const isSelected = selectedAgents.includes(agent.id)

            return (
              <div
                key={agent.id}
                ref={(el) => { agentRefs.current[agent.id] = el }}
                className={`flex items-center space-x-3 p-1.5 rounded-md cursor-pointer ${
                  isSelected ? 'bg-muted hover:bg-gray-200' : 'hover:bg-muted'
                }`}
                onClick={() => handleAgentToggle(agent.id)}
              >
                {allowMultiple && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleAgentToggle(agent.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <Avatar className="h-7 w-7">
                <AvatarImage src={encodeAvatarSvg(agent.avatar)} />
                <AvatarFallback>{agent.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{agent.name}</div>
              </div>
              {!allowMultiple && selectedAgents.includes(agent.id) && (
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
            </div>
          )
          })}
          {filteredAgents.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              {searchTerm ? `No agents found matching "${searchTerm}"` : "No agents found for the selected projects"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
