import * as React from "react"
import { Slider } from "./slider"
import { type DepthLevel, DEPTH_DESCRIPTIONS } from '../../types/config-round'

interface DepthSliderProps {
  value: DepthLevel
  onChange: (depth: DepthLevel) => void
  label?: string
}

export function DepthSlider({ value, onChange, label = "Depth" }: DepthSliderProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-semibold">{label}</label>
      </div>
      <Slider
        value={[['minimal', 'brief', 'medium', 'thorough', 'exhaustive'].indexOf(value || 'medium')]}
        onValueChange={([value]) => onChange(
          ['minimal', 'brief', 'medium', 'thorough', 'exhaustive'][value] as DepthLevel
        )}
        min={0}
        max={4}
        step={1}
      />
      <div className="text-sm text-gray-500">
        <span className="font-bold capitalize text-black">{value}</span>
        <span className="mx-1">—</span>
        <span>{value ? DEPTH_DESCRIPTIONS[value] : DEPTH_DESCRIPTIONS.medium}</span>
      </div>
    </div>
  )
} 