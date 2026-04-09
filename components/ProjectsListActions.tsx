"use client"

import { Button } from "@/components/ui/button"
import { Plus } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function Actions({ onAdd }: { onAdd: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            onClick={onAdd}
            className="h-8 w-8 bg-black hover:bg-black/90 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
          >
            <Plus className="h-4 w-4 text-white" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add a new project</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function ProjectsListActions() {
  return (
    <Actions 
      onAdd={() => {
        const event = new CustomEvent('projectsList:showAddProject')
        window.dispatchEvent(event)
      }}
    />
  )
} 