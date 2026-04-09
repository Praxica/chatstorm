'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { type RoundType } from '@/types/config-round'
import ProjectSelector from '@/components/ProjectSelector'

interface NewConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (title: string, projectIds: string[]) => void
  type: RoundType | null
  defaultTitle: string
}

export function NewConfigModal({ isOpen, onClose, onSave, type, defaultTitle }: NewConfigModalProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [projectIds, setProjectIds] = useState<string[]>([])

  useEffect(() => {
    setTitle(defaultTitle)
  }, [defaultTitle])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Create New {type?.charAt(0).toUpperCase()}{type?.slice(1)} Chat Design</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pb-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-semibold">Name</label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter chat design name"
              className="w-full"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <ProjectSelector
              selectedProjectIds={projectIds}
              onChange={setProjectIds}
              label="Projects"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave(title, projectIds)}
            disabled={!title.trim()}
          >
            Create Chat Design
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 