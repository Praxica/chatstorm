"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "./ui/badge"
import { useProjectStore } from "@/lib/stores/projectStore"
import { type Project } from "@/lib/stores/projectStore"

interface ProjectSelectorProps {
  selectedProjectIds: string[]
  onChange: (projectIds: string[]) => void
  label?: string
  excludeProjectIds?: string[]
}

export default function ProjectSelector({ 
  selectedProjectIds, 
  onChange, 
  label = "Projects",
  excludeProjectIds = []
}: ProjectSelectorProps) {
  const allProjects = useProjectStore(state => state.projects)
  
  // Filter projects into selected and available
  const selectedProjects = allProjects.filter(p => selectedProjectIds.includes(p.id))
  const availableProjects = allProjects.filter(p => 
    !selectedProjectIds.includes(p.id) && 
    !excludeProjectIds.includes(p.id)
  )

  const handleSelectProject = (project: Project) => {
    onChange([...selectedProjectIds, project.id])
  }

  const handleRemoveProject = (project: Project) => {
    onChange(selectedProjectIds.filter(id => id !== project.id))
  }

  const handleSelectAll = () => {
    // Only select projects that aren't excluded
    onChange(allProjects
      .filter(p => !excludeProjectIds.includes(p.id))
      .map(p => p.id)
    )
  }

  const handleSelectNone = () => {
    onChange([])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <label className="text-sm font-semibold">{label}</label>
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={handleSelectAll}
            disabled={availableProjects.length === 0}
          >
            all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={handleSelectNone}
            disabled={selectedProjects.length === 0}
          >
            clear
          </Button>
        </div>
      </div>

      {/* Selected Projects */}
      <div className="min-h-[28px] flex items-center gap-2">
        {selectedProjects.length === 0 ? (
          <span className="text-sm text-gray-500">None</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedProjects.map((project) => (
              <Badge
                key={project.id}
                variant="outline"
                className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 bg-gray-100"
              >
                {project.name}
                <X 
                  className="h-3 w-3 hover:text-gray-600" 
                  onClick={() => handleRemoveProject(project)} 
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {availableProjects.length > 0 && (
        <>
          <div className="border-t my-2" />

          {/* Available Projects */}
          <div className="flex flex-wrap gap-2">
            {availableProjects.map((project) => (
              <Badge
                key={project.id}
                variant="outline"
                className="cursor-pointer hover:bg-gray-100 font-normal"
                onClick={() => handleSelectProject(project)}
              >
                {project.name}
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  )
} 
