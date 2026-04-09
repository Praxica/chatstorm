import { Slider } from "@/components/ui/slider"

export const CREATIVITY_LABELS = {
  0: { 
    label: 'Precise', 
    value: 0.1,
    description: "stick to established conventions"
  },
  1: { 
    label: 'Standard', 
    value: 0.3,
    description: "mix proven concepts with moderate innovation"
  },
  2: { 
    label: 'Creative', 
    value: 0.5,
    description: "explore novel ideas within established norms"
  },
  3: { 
    label: 'Dynamic', 
    value: 0.75,
    description: "push boundaries with unconventional thinking"
  },
  4: { 
    label: 'Experimental', 
    value: 1.0,
    description: "generate transformative ideas"
  }
} as const

type CreativityIndex = keyof typeof CREATIVITY_LABELS

interface CreativitySliderProps {
  value: number
  onChange: (value: number) => void
  label?: string
  hideLabel?: boolean
}

export function CreativitySlider({ value, onChange, label = "Creativity", hideLabel = false }: CreativitySliderProps) {
  return (
    <div className="space-y-2">
      {!hideLabel && <div className="space-y-1">
        <label className="text-sm font-semibold">{label}</label>
      </div>}
      <Slider
        value={[value]}
        onValueChange={([value]) => onChange(value)}
        min={0}
        max={4}
        step={1}
      />
      <div className="text-sm text-gray-500">
        <span className="font-bold text-black">{CREATIVITY_LABELS[value as CreativityIndex].label}</span>
        <span className="mx-1">—</span>
        <span>
          {CREATIVITY_LABELS[value as CreativityIndex].description}
        </span>
      </div>
    </div>
  )
}