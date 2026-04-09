'use client'

import { useState } from "react"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./dialog"
import { AgentSelectionList } from "./agent-selection-list"

interface AgentSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedAgents: string[]
  onSelectionChange: (agentIds: string[]) => void
  title?: string
  description?: string
  encodeAvatarSvg: (svg: string | undefined) => string
  allowMultiple?: boolean
}

export function AgentSelectionModal({
  isOpen,
  onClose,
  selectedAgents,
  onSelectionChange,
  title = "Select Agents",
  description,
  encodeAvatarSvg,
  allowMultiple = true
}: AgentSelectionModalProps) {
  const [localSelectedAgents, setLocalSelectedAgents] = useState<string[]>(selectedAgents)

  const handleSingleClick = (agentId: string) => {
    // Single selection mode - select and close immediately
    onSelectionChange([agentId])
    onClose()
  }

  const handleSave = () => {
    onSelectionChange(localSelectedAgents)
    onClose()
  }

  const handleCancel = () => {
    setLocalSelectedAgents(selectedAgents) // Reset to original selection
    onClose()
  }

  // Reset local selection when modal opens
  useState(() => {
    if (isOpen) {
      setLocalSelectedAgents(selectedAgents)
    }
  })

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-1">
          <AgentSelectionList
            selectedAgents={localSelectedAgents}
            onSelectionChange={setLocalSelectedAgents}
            encodeAvatarSvg={encodeAvatarSvg}
            allowMultiple={allowMultiple}
            showSearch={true}
            showFilters={true}
            showSelectAllClear={allowMultiple}
            onAgentClick={allowMultiple ? undefined : handleSingleClick}
          />
        </div>

        {/* Selection Summary */}
        {allowMultiple && localSelectedAgents.length > 0 && (
          <div className="text-sm text-muted-foreground px-1">
            {localSelectedAgents.length} agent{localSelectedAgents.length !== 1 ? 's' : ''} selected
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {allowMultiple ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Selection
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}