'use client'

import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/lib/stores/projectStore"
import { Tag, ChevronDown, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ProjectFilterProps {
  selectedProjectIds: string[]
  onChange: (projectIds: string[]) => void
  label?: string
}

export default function ProjectFilter({ 
  selectedProjectIds, 
  onChange,
  label: _label = "Filter by projects"
}: ProjectFilterProps) {
  const projects = useProjectStore(state => state.projects)
  
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 min-w-8 bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-1 px-2"
          >
            <Tag className="h-4 w-4" />
            {selectedProjectIds.length > 0 && (
              <span className="text-sm">
                ({selectedProjectIds.length})
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem
            className="text-sm justify-between"
            onSelect={(e) => {
              e.preventDefault()
              onChange([])
            }}
          >
            All Projects
            {selectedProjectIds.length === 0 && <Check className="h-3 w-3" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {projects.map(project => (
            <DropdownMenuItem
              key={project.id}
              className="text-sm justify-between"
              onSelect={(e) => {
                e.preventDefault()
                const newSelected = [...selectedProjectIds]
                if (newSelected.includes(project.id)) {
                  onChange(newSelected.filter(id => id !== project.id))
                } else {
                  onChange([...newSelected, project.id])
                }
              }}
            >
              {project.name}
              {selectedProjectIds.includes(project.id) && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 