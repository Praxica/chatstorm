'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type RoundType } from '@/types/config-round'
import { RoundTypeGrid } from './RoundTypeGrid'

interface NewRoundTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectType: (type: RoundType) => void
}

export function NewRoundTypeModal({ isOpen, onClose, onSelectType }: NewRoundTypeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Choose a Round Type</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">You can add more types later</p>
        <RoundTypeGrid onSelectType={onSelectType} className="mt-4" />
      </DialogContent>
    </Dialog>
  )
} 