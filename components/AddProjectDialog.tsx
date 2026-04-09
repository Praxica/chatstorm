"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { useProjectStore } from "@/lib/stores/projectStore"

interface AddProjectDialogProps {
  open: boolean
  onClose: () => void
  projectId?: string
}

export default function AddProjectDialog({ open, onClose, projectId }: AddProjectDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addProject, updateProject, projects } = useProjectStore()

  useEffect(() => {
    if (projectId) {
      const project = projects.find(p => p.id === projectId)
      if (project) {
        setName(project.name)
        setDescription(project.description || "")
      }
    }
  }, [projectId, projects])

  const handleSubmit = async () => {
    if (!name.trim()) return
    
    try {
      setIsSubmitting(true)

      if (projectId) {
        // Update existing project
        await updateProject(projectId, {
          name: name.trim(),
          description: description.trim() || undefined
        })
      } else {
        // Create new project
        await addProject({
          name: name.trim(),
          description: description.trim() || undefined
        })
      }

      onClose()
      setName("")
      setDescription("")
    } catch (error) {
      console.error('Failed to save project:', error)
      // TODO: Add error handling
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{projectId ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogDescription>
            {projectId ? 'Update project details.' : 'Create a new project to organize your chats and agents.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Name</label>
            <Input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Description</label>
            <Textarea
              placeholder="Project description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "Saving..." : projectId ? "Save Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 