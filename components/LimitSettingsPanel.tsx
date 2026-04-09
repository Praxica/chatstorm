import { type Round, type LengthType, shouldShowInput } from '@/types/config-round'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"
import { useTopLayer } from '@/lib/hooks/useTopLayer'

interface LimitSettingsPanelProps {
  round: Round
  isOpen: boolean
  onUpdate: (updates: Partial<Round>) => void
  onClose: () => void
}

export function LimitSettingsPanel({ round, isOpen, onUpdate, onClose }: LimitSettingsPanelProps) {
  const [draft, setDraft] = useState({
    lengthType: round.lengthType,
    lengthNumber: round.lengthNumber,
    lengthRounds: round.lengthRounds
  })
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
        <h3 className="font-semibold">Set Message Limit</h3>
      </div>
      <div className="p-4">
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-6">
            <RadioGroup
              value={draft.lengthType}
              onValueChange={(value: LengthType) => {
                setDraft({
                  lengthType: value,
                  lengthNumber: undefined,
                  lengthRounds: undefined
                })
              }}
              className="space-y-6"
            >
              {shouldShowInput(round.type, 'limitByTotal') && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total" id="total" />
                    <label htmlFor="total" className="text-sm font-medium leading-none">
                      By total messages
                    </label>
                  </div>
                  {draft.lengthType === 'total' && (
                    <div className="flex items-center gap-2 ml-6">
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={draft.lengthNumber || 1}
                        onChange={(e) => setDraft({ 
                          ...draft,
                          lengthNumber: Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                        })}
                          className="w-20"
                      />  
                      <span className="text-sm text-muted-foreground">messages</span>
                    </div>
                  )}
                </div>
              )}

              {shouldShowInput(round.type, 'limitByRounds') && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rounds" id="rounds" />
                    <label htmlFor="rounds" className="text-sm font-medium leading-none">
                      By messages per participant
                    </label>
                  </div>
                  {draft.lengthType === 'rounds' && (
                    <div className="flex items-center gap-2 ml-6">
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        value={draft.lengthRounds || 1}
                        onChange={(e) => setDraft({ 
                          ...draft,
                          lengthRounds: Math.max(1, Math.min(3, parseInt(e.target.value) || 1)) as 1 | 2 | 3
                        })}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">messages each</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderator" id="moderator" />
                  <label htmlFor="moderator" className="text-sm font-medium leading-none">
                    Moderator controlled
                  </label>
                </div>
                {draft.lengthType === 'moderator' && (
                  <div className="text-xs text-muted-foreground ml-6">
                    The moderator will pause the debate when it will benefit from user feedback.
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>

          <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                onUpdate(draft)
                onClose()
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
} 