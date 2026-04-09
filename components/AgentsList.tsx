"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserCircle, Plus, LayoutList, LayoutGrid, CheckSquare, Check, Trash2, Tag, ChevronDown, AlertTriangle, Wand2 } from 'lucide-react'
import { useChatAgentStore, type ChatAgent } from "@/lib/stores/chatAgentStore"
import { useProjectStore } from "@/lib/stores/projectStore"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ChatAgentEdit from "./ChatAgentEdit"
import { createAvatar } from '@dicebear/core'
import * as miniavs from '@dicebear/miniavs'
import * as bottts from '@dicebear/bottts'
import * as funEmoji from '@dicebear/fun-emoji'
import * as pixelArt from '@dicebear/pixel-art'
import { ConfirmModal } from "@/components/ui/confirm-modal"
import GenerateAgentsModal from "./GenerateAgentsModal"
import { type DepthLevel } from "@/types/config-round"
import AddProjectDialog from "./AddProjectDialog"
import EditProjectAssignments from "./EditProjectAssignments"
import { AgentAvatarList } from "./ui/agent-avatar-list"
import { AgentSortControl } from "./ui/agent-sort-control"

export default function AgentsList() {
  const { agents, updateAgent, addAgent, removeAgent, removeAgentsFromStore, updateAgentProjects, loadAgents, getSortedAgents } = useChatAgentStore()
  const projects = useProjectStore(state => state.projects)
  const [isGridView, setIsGridView] = useState(false)
  const [editingAgent, setEditingAgent] = useState<ChatAgent | null>(null)
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<ChatAgent | null>(null)
  const [showGeneratePanel, setShowGeneratePanel] = useState(false)
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [showAddProject, setShowAddProject] = useState(false)
  const [showEditProjects, setShowEditProjects] = useState(false)
  const [deletingAgents, setDeletingAgents] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  
  const handleAddNewAgent = () => {
    // Pick a random avatar style
    const avatarStyles = [
      (seed: string) => createAvatar(miniavs, { seed }),
      (seed: string) => createAvatar(bottts, { seed, backgroundColor: ['b6e3f4'] }),
      (seed: string) => createAvatar(funEmoji, { seed }),
      (seed: string) => createAvatar(pixelArt, { seed, backgroundColor: ['d1d4f9'] })
    ]
    const randomStyle = avatarStyles[Math.floor(Math.random() * avatarStyles.length)]
    const avatar = randomStyle(Date.now().toString()).toString()

    // Create an empty/default agent template
    const emptyAgent: ChatAgent = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      systemPrompt: '',
      priority: '',
      avatar,
      temperature: 0.7,
      isActive: true,
      projectIds: Array.from(selectedProjects)
    }
    setEditingAgent(emptyAgent)
    setIsCreatingAgent(true)
  }
  
  useEffect(() => {
    const handleShowGeneratePanel = () => setShowGeneratePanel(true)
    const handleCreateAgent = () => handleAddNewAgent()

    window.addEventListener('agentsList:showGeneratePanel', handleShowGeneratePanel)
    window.addEventListener('agentsList:createAgent', handleCreateAgent)

    return () => {
      window.removeEventListener('agentsList:showGeneratePanel', handleShowGeneratePanel)
      window.removeEventListener('agentsList:createAgent', handleCreateAgent)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjects]) // Add selectedProjects as a dependency since it's used in handleAddNewAgent

  // Get sorted agents from store, then filter by selected projects and exclude dynamic agents
  const sortedAgents = getSortedAgents().filter(agent => {
    // Filter out dynamic agents - they shouldn't appear in the reusable agent list
    if (agent.isDynamic) return false;

    // If no projects are selected, show all agents
    if (selectedProjects.size === 0) return true;

    // Handle case where agent doesn't have projectIds property or it's empty
    if (!agent.projectIds || agent.projectIds.length === 0) {
      // If the agent has no projects, it should still be visible when no specific project is selected
      return selectedProjects.size === 0;
    }
    
    // Check if any of the agent's projects match the selected projects
    return agent.projectIds.some(id => selectedProjects.has(id));
  });

  // Get names of selected projects for the message
  const selectedProjectNames = Array.from(selectedProjects)
    .map(id => projects.find(p => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const handleAgentClick = (agent: ChatAgent) => {
    setEditingAgent(agent)
    setIsCreatingAgent(false)
  }

  const handleSaveAgent = async (updatedAgent: ChatAgent) => {
    setIsSaving(true)
    try {
      if (isCreatingAgent) {
        await addAgent(updatedAgent)
      } else {
        await updateAgent(updatedAgent.id, updatedAgent)
      }
      setEditingAgent(null)
      setIsCreatingAgent(false)
    } catch (error) {
      console.error('Failed to save agent:', error)
      // You could add an error toast notification here
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (agent: ChatAgent) => {
    setDeletingAgent(agent)
  }

  const confirmDelete = () => {
    if (deletingAgent) {
      removeAgent(deletingAgent.id)
      setDeletingAgent(null)
    }
  }

  const handleGenerateAgents = async (_count: number, _prompt: string, _creativity: number, _depth: DepthLevel, _projectIds: string[]) => {
    // This function is now just a placeholder since the modal handles the generation internally
    // We just need to refresh the agents list when generation is complete
    await loadAgents()
  }

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

  const renderAvatar = (agent: ChatAgent, size: "sm" | "lg") => {
    if (agent.avatar) {
      return (
        <img 
          src={`data:image/svg+xml;utf8,${encodeURIComponent(agent.avatar)}`} 
          alt={`${agent.name} avatar`}
          className={cn(
            "rounded-full",
            size === "lg" ? "w-14 h-14 mb-2" : "w-6 h-6"
          )}
        />
      )
    }
    return (
      <UserCircle className={cn(
        size === "lg" ? "h-14 w-14 mb-2" : "h-6 w-6 mr-2"
      )} />
    )
  }

  // ADD back the empty state logic
  if (agents.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="bg-yellow-50 w-14 h-14 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-yellow-500" />
          </div>
          <p className="text-center mb-6 text-gray-600">
            Create agents to participate in your chats
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button 
              variant="outline" 
              onClick={handleAddNewAgent}
              className="bg-black hover:bg-black/90 text-white hover:text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add a new agent
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowGeneratePanel(true)}
              className="bg-black hover:bg-black/90 text-white hover:text-white"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Generate agents with AI
            </Button>
          </div>
        </div>

        {/* Overlays still need to be available even in empty state */}
        {editingAgent && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <ChatAgentEdit 
              agent={editingAgent}
              onClose={() => {
                if (!isSaving) {
                  setEditingAgent(null)
                  setIsCreatingAgent(false)
                }
              }}
              onSave={handleSaveAgent}
              initialProjectIds={Array.from(selectedProjects)}
              isCreating={isCreatingAgent}
              isSaving={isSaving}
            />
          </div>
        )}

        <GenerateAgentsModal
          isOpen={showGeneratePanel}
          onClose={() => setShowGeneratePanel(false)}
          onGenerate={handleGenerateAgents}
          initialProjectIds={Array.from(selectedProjects)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none px-4 pt-2">
        <div className="flex items-center gap-2 mb-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="secondary"
                  size="icon" 
                  onClick={() => {
                    setIsMultiSelect(!isMultiSelect)
                    setSelectedAgents(new Set())
                  }}
                  className={cn(
                    "bg-gray-50 hover:bg-gray-100 h-8 w-8",
                    isMultiSelect && "bg-gray-200"
                  )}
                >
                  <CheckSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isMultiSelect ? 'Exit selection mode' : 'Select multiple agents'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 min-w-8 bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-1 px-2"
              >
                <Tag className="h-4 w-4" />
                {selectedProjects.size > 0 && (
                  <span className="text-sm">
                    ({selectedProjects.size})
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuItem 
                className="text-sm flex items-center" 
                onSelect={(e) => {
                  e.preventDefault()
                  setShowAddProject(true)
                }}
              >
                <Plus className="h-3 w-3 mr-2" />
                Add project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-sm flex items-center justify-between"
                onSelect={(e) => {
                  e.preventDefault()
                  setSelectedProjects(new Set())
                }}
              >
                <span>All Projects</span>
                {selectedProjects.size === 0 && <Check className="h-3 w-3 ml-2" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {projects.map(project => (
                <DropdownMenuItem
                  key={project.id}
                  className="text-sm flex items-center justify-between"
                  onSelect={(e) => {
                    e.preventDefault()
                    const newSelected = new Set(selectedProjects)
                    if (newSelected.has(project.id)) {
                      newSelected.delete(project.id)
                    } else {
                      newSelected.add(project.id)
                    }
                    setSelectedProjects(newSelected)
                  }}
                >
                  <span>{project.name}</span>
                  {selectedProjects.has(project.id) && <Check className="h-3 w-3 ml-2" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <AgentSortControl />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="secondary"
                  size="icon" 
                  onClick={() => setIsGridView(!isGridView)}
                  className="bg-gray-50 hover:bg-gray-100 h-8 w-8"
                >
                  {isGridView ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Switch to {isGridView ? 'list' : 'grid'} view</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {isMultiSelect && (
          <div className="flex items-center gap-4 mt-3 mb-2">
            <div className="flex items-center gap-3">
              <button
                className="text-sm text-gray-600 hover:text-gray-900 underline"
                onClick={() => setSelectedAgents(new Set(sortedAgents.map(a => a.id)))}
              >
                all
              </button>
              <button
                className="text-sm text-gray-600 hover:text-gray-900 underline"
                onClick={() => setSelectedAgents(new Set())}
              >
                clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 bg-white text-xs"
                      disabled={selectedAgents.size === 0}
                      onClick={() => setDeletingAgents(Array.from(selectedAgents))}
                    >
                      <Trash2 className="h-3 w-3" />Delete
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 bg-white text-xs"
                      disabled={selectedAgents.size === 0}
                      onClick={() => setShowEditProjects(true)}
                    >
                      <Tag className="h-3 w-3" />Edit
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit project assignments</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 pb-4">
          <div className={cn(
            isGridView ? "grid grid-cols-2 gap-2" : "space-y-2"
          )}>
            {sortedAgents.length === 0 && selectedProjects.size > 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500 mb-4">
                  No agents are assigned to {selectedProjectNames}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProjects(new Set())}
                >
                  Show all agents
                </Button>
              </div>
            ) : sortedAgents.length === 0 && agents.length > 0 ? (
              <div className="py-8 flex flex-col items-center">
                <div className="flex items-center mb-3">
                  <div className="bg-yellow-50 w-8 h-8 rounded-full flex items-center justify-center mr-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                  <Button
                    variant="link"
                    className="text-sm p-0 h-auto text-gray-600 hover:text-black"
                    onClick={handleAddNewAgent}
                  >
                    Create agents to add to this chat
                  </Button>
                </div>
              </div>
            ) : (
              sortedAgents.map((agent) => (
                <div 
                  key={agent.id}
                  className="group relative"
                  style={{
                    maxWidth: !isGridView ? "280px" : undefined
                  }}
                >
                  {!isGridView ? (
                    <div
                      className={cn(
                        "flex items-center border rounded-md py-2 px-3 cursor-pointer",
                        "bg-white hover:bg-gray-50 text-sm",
                        isMultiSelect && selectedAgents.has(agent.id) && "bg-blue-50",
                        isMultiSelect && "pl-8"
                      )}
                      style={{
                        width: "100%",
                        maxWidth: "280px"
                      }}
                      onClick={() => {
                        if (isMultiSelect) {
                          const newSelected = new Set(selectedAgents)
                          if (newSelected.has(agent.id)) {
                            newSelected.delete(agent.id)
                          } else {
                            newSelected.add(agent.id)
                          }
                          setSelectedAgents(newSelected)
                        } else {
                          handleAgentClick(agent)
                        }
                      }}
                    >
                      {isMultiSelect && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2">
                          <div className={cn(
                            "w-4 h-4 border rounded",
                            selectedAgents.has(agent.id) ? "bg-blue-500 border-blue-500" : "border-gray-300",
                            "flex items-center justify-center"
                          )}>
                            {selectedAgents.has(agent.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex-shrink-0 mr-2">
                        {renderAvatar(agent, "sm")}
                      </div>
                      <div className="flex-1 overflow-hidden max-w-[200px]">
                        <span className="truncate block text-sm">
                          {agent.name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className={cn(
                        "bg-white hover:bg-gray-50 w-full",
                        "flex-col h-28 p-2",
                        isMultiSelect && selectedAgents.has(agent.id) && "bg-blue-50"
                      )}
                      onClick={() => {
                        if (isMultiSelect) {
                          const newSelected = new Set(selectedAgents)
                          if (newSelected.has(agent.id)) {
                            newSelected.delete(agent.id)
                          } else {
                            newSelected.add(agent.id)
                          }
                          setSelectedAgents(newSelected)
                        } else {
                          handleAgentClick(agent)
                        }
                      }}
                    >
                      {isMultiSelect && (
                        <div className="absolute left-1/2 top-2 -translate-x-1/2 translate-y-0">
                          <div className={cn(
                            "w-4 h-4 border rounded",
                            selectedAgents.has(agent.id) ? "bg-blue-500 border-blue-500" : "border-gray-300",
                            "flex items-center justify-center"
                          )}>
                            {selectedAgents.has(agent.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                      )}
                      {renderAvatar(agent, "lg")}
                      <span className="truncate text-sm w-full text-center">
                        {agent.name}
                      </span>
                    </Button>
                  )}
                  <div className={cn(
                    "absolute opacity-0 group-hover:opacity-100 transition-opacity",
                    "flex items-center gap-2",
                    isGridView 
                      ? "inset-0 bg-black/5 justify-center" 
                      : "right-2 top-1/2 -translate-y-1/2",
                    isMultiSelect && "hidden"
                  )}>
                    <Button
                      size="sm"
                      className="bg-black text-white hover:bg-black/90 h-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAgentClick(agent)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(agent)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>

      {editingAgent && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <ChatAgentEdit
            agent={editingAgent}
            onClose={() => {
              if (!isSaving) {
                setEditingAgent(null)
                setIsCreatingAgent(false)
              }
            }}
            onSave={handleSaveAgent}
            initialProjectIds={Array.from(selectedProjects)}
            isCreating={isCreatingAgent}
            isSaving={isSaving}
          />
        </div>
      )}

      <GenerateAgentsModal
        isOpen={showGeneratePanel}
        onClose={() => setShowGeneratePanel(false)}
        onGenerate={handleGenerateAgents}
        initialProjectIds={Array.from(selectedProjects)}
      />

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