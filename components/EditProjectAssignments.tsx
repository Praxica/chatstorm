"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useChatAgentStore } from "@/lib/stores/chatAgentStore"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import ProjectSelector from "./ProjectSelector"

interface EditProjectAssignmentsProps {
  open: boolean
  onClose: () => void
  selectedAgents: string[]
  onSave: (updates: { projectIdsToAdd: string[], projectIdsToRemove: string[] }) => void
}

export default function EditProjectAssignments({ 
  open, 
  onClose, 
  selectedAgents,
  onSave 
}: EditProjectAssignmentsProps) {
  const { agents } = useChatAgentStore()
  const [projectsToAdd, setProjectsToAdd] = useState<string[]>([])
  const [projectsToRemove, setProjectsToRemove] = useState<string[]>([])

  // Get the selected agent objects
  const selectedAgentObjects = agents.filter(agent => selectedAgents.includes(agent.id))

  // Get all unique project IDs currently assigned to any selected agent
  const currentProjectIds = new Set<string>()
  selectedAgentObjects.forEach(agent => {
    agent.projectIds?.forEach(id => currentProjectIds.add(id))
  })

  const handleSave = () => {
    onSave({
      projectIdsToAdd: projectsToAdd,
      projectIdsToRemove: projectsToRemove
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project Assignments</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Selected Agents Section */}
          <div>
            <div className="text-sm font-semibold mb-2">
              Edit projects for the following agents:
            </div>
            <div className="flex -space-x-2 overflow-hidden">
              {selectedAgentObjects.slice(0, 6).map(agent => (
                <Avatar key={agent.id} className="inline-block border-2 border-background">
                  <AvatarImage src={`data:image/svg+xml;utf8,${encodeURIComponent(agent.avatar || '')}`} />
                  <AvatarFallback>{agent.name[0]}</AvatarFallback>
                </Avatar>
              ))}
              {selectedAgentObjects.length > 6 && (
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border-2 border-background">
                  <span className="text-xs text-gray-600">+{selectedAgentObjects.length - 6}</span>
                </div>
              )}
            </div>
          </div>

          {/* Add Projects Section */}
          <div>
            <ProjectSelector
              selectedProjectIds={projectsToAdd}
              onChange={setProjectsToAdd}
              label="Add these projects"
              excludeProjectIds={projectsToRemove}
            />
          </div>

          {/* Remove Projects Section */}
          <div>
            <ProjectSelector
              selectedProjectIds={projectsToRemove}
              onChange={setProjectsToRemove}
              label="Remove these projects"
              excludeProjectIds={projectsToAdd}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={projectsToAdd.length === 0 && projectsToRemove.length === 0}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 