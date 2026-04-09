import { useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type Round } from '../types/config-round'
import { ROUND_TYPES } from '@/lib/constants/rounds'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function SortableRound({ round }: { round: Round }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: round.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = ROUND_TYPES[round.type].icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 p-2 bg-black text-white rounded-lg cursor-move text-sm"
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{round.name || round.type}</span>
    </div>
  )
}

export function ConfigRoundSort({ 
  rounds, 
  onSave, 
  onCancel 
}: { 
  rounds: Round[], 
  onSave: (newRounds: Round[]) => void, 
  onCancel: () => void 
}) {
  const [sortedRounds, setSortedRounds] = useState(rounds)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (active.id !== over.id) {
      setSortedRounds((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(sortedRounds)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onCancel}
                className="h-8 w-8"
                disabled={isSaving}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Back to Chat Design</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-lg font-semibold truncate max-w-[180px]">
          Reorder Rounds
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 flex flex-col gap-4">
          <div className="text-sm text-gray-500">
            Drag and drop rounds to change their order.
          </div>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedRounds.map(round => round.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sortedRounds.map((round) => (
                  <SortableRound key={round.id} round={round} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </div>
  )
} 