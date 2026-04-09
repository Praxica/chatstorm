import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useProjectStore } from "@/lib/stores/projectStore"
import { useState, useEffect } from "react"
import AddProjectDialog from "./AddProjectDialog"
import { ConfirmModal } from "@/components/ui/confirm-modal"

export default function ProjectsList() {
  const { projects } = useProjectStore()
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [deletingProject, setDeletingProject] = useState<string | null>(null)
  const [showAddProject, setShowAddProject] = useState(false)

  useEffect(() => {
    const handleShowAddProject = () => setShowAddProject(true)
    window.addEventListener('projectsList:showAddProject', handleShowAddProject)
    return () => window.removeEventListener('projectsList:showAddProject', handleShowAddProject)
  }, [])

  const handleDelete = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete project')
      }

      // Update local store
      useProjectStore.getState().setProjects(
        projects.filter(p => p.id !== projectId)
      )
      setDeletingProject(null)
    } catch (error) {
      console.error('Error deleting project:', error)
      // TODO: Add error handling
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="px-4 py-2">
          <div className="space-y-2">
            {projects.map((project) => (
              <div 
                key={project.id}
                className="group relative"
              >
                <Button 
                  variant="outline" 
                  className="bg-white hover:bg-gray-50 w-full justify-start"
                  onClick={() => setEditingProject(project.id)}
                >
                  <span className="truncate">{project.name}</span>
                </Button>
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-black text-white hover:bg-black/90 h-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingProject(project.id)
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
                      setDeletingProject(project.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {showAddProject && (
        <AddProjectDialog
          open={showAddProject}
          onClose={() => setShowAddProject(false)}
        />
      )}

      {editingProject && (
        <AddProjectDialog
          open={true}
          onClose={() => setEditingProject(null)}
          projectId={editingProject}
        />
      )}

      {deletingProject && (
        <ConfirmModal
          title="Delete Project"
          message="Are you sure you want to delete this project?"
          onConfirm={() => handleDelete(deletingProject)}
          onCancel={() => setDeletingProject(null)}
        />
      )}
    </div>
  )
} 