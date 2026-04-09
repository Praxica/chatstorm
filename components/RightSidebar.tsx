"use client"

import { Check, ChevronDown } from 'lucide-react'
import { useChatAgentStore, type ChatAgent } from "@/lib/stores/chatAgentStore"
import { useState, useEffect } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ChatAgentEdit from "./ChatAgentEdit"
import { ConfirmModal } from "@/components/ui/confirm-modal"

import AddProjectDialog from "./AddProjectDialog"
import EditProjectAssignments from "./EditProjectAssignments"
import { AgentAvatarList } from "./ui/agent-avatar-list"
import ProjectsList from "./ProjectsList"
import AgentsList from "./AgentsList"
import AgentsListActions from "./AgentsListActions"
import ProjectsListActions from "./ProjectsListActions"

type ViewType = "agents" | "projects"

export default function RightSidebar() {
  const [viewType, setViewType] = useState<ViewType>("agents")
  const { agents, updateAgent, addAgent, removeAgent, removeAgentsFromStore, updateAgentProjects } = useChatAgentStore()
  const [editingAgent, setEditingAgent] = useState<ChatAgent | null>(null)
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<ChatAgent | null>(null)

  const [, setIsMultiSelect] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedProjects] = useState<Set<string>>(new Set())
  const [showAddProject, setShowAddProject] = useState(false)
  const [showEditProjects, setShowEditProjects] = useState(false)
  const [deletingAgents, setDeletingAgents] = useState<string[]>([])
  
  useEffect(() => {
    const handleEditAgent = (event: Event) => {
      const { agent, isCreating } = (event as CustomEvent).detail
      setEditingAgent(agent)
      setIsCreatingAgent(isCreating || false)
    }
    window.addEventListener('agent:edit', handleEditAgent)
    return () => window.removeEventListener('agent:edit', handleEditAgent)
  }, [])

  const handleSaveAgent = (updatedAgent: ChatAgent) => {
    if (isCreatingAgent) {
      addAgent(updatedAgent)
    } else {
      updateAgent(updatedAgent.id, updatedAgent)
    }
    setEditingAgent(null)
    setIsCreatingAgent(false)
  }

  const confirmDelete = () => {
    if (deletingAgent) {
      removeAgent(deletingAgent.id)
      setDeletingAgent(null)
    }
  }

  // Add handler for saving project assignments
  const handleSaveProjectAssignments = async (updates: { projectIdsToAdd: string[], projectIdsToRemove: string[] }) => {
    // Update each selected agent with the project changes
    for (const agentId of selectedAgents) {
      const agent = agents.find(a => a.id === agentId)
      if (agent) {
        await updateAgentProjects(agentId, updates)
      }
    }
    // Clear selection after saving
    setSelectedAgents(new Set())
    setIsMultiSelect(false)
    setShowEditProjects(false)
  }

  const handleBulkDelete = async () => {
    try {
      const response = await fetch('/api/agents/delete-many', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentIds: deletingAgents
        })
      })

      if (!response.ok) {
        throw new Error('Failed to delete agents')
      }

      // Remove the agents from the store using the new bulk function
      removeAgentsFromStore(deletingAgents)

      // Clear selection
      setSelectedAgents(new Set())
      setIsMultiSelect(false)
      setDeletingAgents([])
    } catch (error) {
      console.error('Error deleting agents:', error)
      // TODO: Add proper error handling/notification
    }
  }

  return (
    <div className="w-72 bg-white border-l border-gray-200 relative h-full">
      <div className="flex flex-col h-full">
        <div className="flex-none h-14 px-4 border-b border-gray-200">
          <div className="h-full flex items-center justify-between gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 -ml-0.5 hover:opacity-70 transition-opacity">
                  <span className="text-lg font-semibold">{viewType === "agents" ? "Agents" : "Projects"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setViewType("agents")} className="flex items-center justify-between">
                  <span>Agents</span>
                  {viewType === "agents" && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewType("projects")} className="flex items-center justify-between">
                  <span>Projects</span>
                  {viewType === "projects" && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {viewType === "agents" ? (
              <div className="flex items-center gap-2">
                <AgentsListActions />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ProjectsListActions />
              </div>
            )}
          </div>
        </div>

        {viewType === "agents" ? <AgentsList /> : <ProjectsList />}
      </div>
      
      {editingAgent && (
        <ChatAgentEdit 
          key={editingAgent.id}
          agent={editingAgent}
          onClose={() => {
            setEditingAgent(null)
            setIsCreatingAgent(false)
          }}
          onSave={handleSaveAgent}
          initialProjectIds={Array.from(selectedProjects)}
          isCreating={isCreatingAgent}
        />
      )}

      {deletingAgent && (
        <ConfirmModal
          title="Delete Agent"
          message={`Are you sure you want to delete ${deletingAgent.name}?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingAgent(null)}
        />
      )}

      {showAddProject && (
        <AddProjectDialog
          open={showAddProject}
          onClose={() => setShowAddProject(false)}
        />
      )}

      {showEditProjects && (
        <EditProjectAssignments
          open={showEditProjects}
          onClose={() => setShowEditProjects(false)}
          selectedAgents={Array.from(selectedAgents)}
          onSave={handleSaveProjectAssignments}
        />
      )}

      {deletingAgents.length > 0 && (
        <ConfirmModal
          title="Delete Agents"
          message={
            <div className="space-y-4">
              <p>Are you sure you want to delete these agent(s)?</p>
              <AgentAvatarList
                agents={deletingAgents.map(id => agents.find(a => a.id === id) || null)}
                encodeAvatarSvg={(svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg || '')}`}
              />
            </div>
          }
          onConfirm={handleBulkDelete}
          onCancel={() => setDeletingAgents([])}
        />
      )}
    </div>
  )
}