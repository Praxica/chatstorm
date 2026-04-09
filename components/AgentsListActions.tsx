"use client"

import { Button } from "@/components/ui/button"
import { Plus, Wand2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatAgentStore } from "@/lib/stores/chatAgentStore"

export function Actions({ onAdd, onGenerate }: { onAdd: () => void, onGenerate: () => void }) {
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
          <p>Add a new agent</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            onClick={onGenerate}
            className="h-8 w-8 bg-black hover:bg-black/90 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
          >
            <Wand2 className="h-4 w-4 text-white" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Generate agents with AI</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function AgentsListActions() {
  const _addAgent = useChatAgentStore(state => state.addAgent)

  const handleAddNew = () => {
    // Instead of directly adding the agent, dispatch an event to show the create agent panel
    const event = new CustomEvent('agentsList:createAgent')
    window.dispatchEvent(event)
  }

  return (
    <Actions 
      onAdd={handleAddNew}
      onGenerate={() => {
        const event = new CustomEvent('agentsList:showGeneratePanel')
        window.dispatchEvent(event)
      }}
    />
  )
} 