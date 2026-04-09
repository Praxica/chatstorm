import { type DepthLevel, type RoundStyleDraft } from '@/types/config-round'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CreativitySlider } from "../../ui/creativity-slider"

interface RoundStyleEditProps {
  draft: RoundStyleDraft
  onUpdateDraft: (updates: Partial<RoundStyleDraft>) => void
}

export function RoundStyleEdit({ draft, onUpdateDraft }: RoundStyleEditProps) {
  return (
    <div className="space-y-6">
      {/* Depth Section */}
      <div>
        <div className="mb-2">
          <label className="text-sm font-semibold">Response Detail</label>
          <div className="text-sm text-muted-foreground">
            How detailed should responses be?
          </div>
        </div>
        <RadioGroup
          value={draft.depth}
          onValueChange={(value: DepthLevel) => onUpdateDraft({ depth: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="minimal" id="minimal" />
            <label htmlFor="minimal" className="text-sm font-medium leading-none">
              Minimal{draft.depth === 'minimal' && <span className="text-muted-foreground">—one or two sentences</span>}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="brief" id="brief" />
            <label htmlFor="brief" className="text-sm font-medium leading-none">
              Brief{draft.depth === 'brief' && <span className="text-muted-foreground">—one paragraph</span>}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="medium" id="medium" />
            <label htmlFor="medium" className="text-sm font-medium leading-none">
              Medium{draft.depth === 'medium' && <span className="text-muted-foreground">—a few brief paragraphs</span>}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="thorough" id="thorough" />
            <label htmlFor="thorough" className="text-sm font-medium leading-none">
              Thorough{draft.depth === 'thorough' && <span className="text-muted-foreground">—multiple paragraphs</span>}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="exhaustive" id="exhaustive" />
            <label htmlFor="exhaustive" className="text-sm font-medium leading-none">
              Exhaustive{draft.depth === 'exhaustive' && <span className="text-muted-foreground">—complete analysis</span>}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dynamic" id="dynamic" />
            <label htmlFor="dynamic" className="text-sm font-medium leading-none">
              Dynamic{draft.depth === 'dynamic' && <span className="text-muted-foreground">—let the agent decide</span>}
            </label>
          </div>
        </RadioGroup>
      </div>

      {/* Creativity Section */}
      <div className="mt-4">
        <div className="mb-2">
          <label className="text-sm font-semibold">Creativity</label>
          <div className="text-sm text-muted-foreground">
            How creative and varied should responses be?
          </div>
        </div>
        <RadioGroup
          value={draft.creativityType}
          onValueChange={(value: 'agent' | 'custom') => onUpdateDraft({ creativityType: value })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="agent" id="agent" />
            <label htmlFor="agent" className="text-sm font-medium leading-none">Use agent defaults</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="custom" />
            <label htmlFor="custom" className="text-sm font-medium leading-none">Custom</label>
          </div>
        </RadioGroup>

        {draft.creativityType === "custom" && (
          <div className="pl-6 pt-2">
            <CreativitySlider
              value={draft.creativityIndex}
              onChange={(value) => onUpdateDraft({ creativityIndex: value })}
              hideLabel={true}
            />
          </div>
        )}
      </div>
    </div>
  )
}
