import { type Round, type RoundActionType } from '@/types/config-round'
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"
import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTopLayer } from '@/lib/hooks/useTopLayer'

interface ActionPanelProps {
  round: Round
  isOpen: boolean
  onUpdate: (config: Partial<Round>) => void
  onClose: () => void
}

export function ActionPanel({
  round,
  isOpen,
  onUpdate,
  onClose,
}: ActionPanelProps) {
  const [draftAction, setDraftAction] = useState<RoundActionType>(round.action || 'summarize')
  const zIndex = useTopLayer(isOpen)

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ zIndex: zIndex ? zIndex - 1 : undefined }}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-80 bg-background border-r transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ zIndex: zIndex ?? undefined }}
      >
      <div className="h-[53px] border-b flex items-center px-4 gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onClose}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Review Action</h3>
      </div>
      
      <div className="flex flex-col h-[calc(100%-53px)]">
        <ScrollArea className="flex-1">
          <div className="px-4 py-6">
            <RadioGroup
              value={draftAction}
              onValueChange={(value) => {
                setDraftAction(value as RoundActionType)
              }}
              className="space-y-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="summarize" id="summarize" />
                <label htmlFor="summarize" className="text-sm font-medium leading-none">
                  Summarize the discussion
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="winner" id="winner" />
                <label htmlFor="winner" className="text-sm font-medium leading-none">
                  Declare a winner
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rank" id="rank" />
                <label htmlFor="rank" className="text-sm font-medium leading-none">
                  Rank the best responses
                </label>
              </div>
            </RadioGroup>
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex items-center justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onUpdate({ action: draftAction })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}