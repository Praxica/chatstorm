'use client'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WizardProgressProps {
  currentStep: number
  steps: { label: string }[]
  onNext?: () => void
  nextDisabled?: boolean
  nextDisabledTooltip?: string
  nextLabel?: string
  onStepClick?: (step: number) => void
}

export function WizardProgress({ currentStep, steps, onNext, nextDisabled, nextDisabledTooltip, nextLabel = 'Next', onStepClick }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-between border-t pt-4 mt-1">
      <div className="flex items-center flex-1 justify-center">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <button
              onClick={() => onStepClick?.(index)}
              disabled={index > currentStep}
              className="flex flex-col items-center cursor-pointer disabled:cursor-not-allowed"
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  index <= currentStep ? 'bg-black' : 'bg-gray-300'
                }`}
              />
              <span
                className={`text-xs mt-2 ${
                  index === currentStep ? 'font-semibold' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`w-24 h-[2px] mx-2 mb-6 ${
                  index < currentStep ? 'bg-black' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      {onNext && (
        nextDisabled && nextDisabledTooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button onClick={onNext} disabled={nextDisabled}>
                    {nextLabel}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{nextDisabledTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button onClick={onNext} disabled={nextDisabled}>
            {nextLabel}
          </Button>
        )
      )}
    </div>
  )
}
