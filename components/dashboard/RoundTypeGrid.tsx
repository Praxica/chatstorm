'use client'

import { Button } from "@/components/ui/button"
import { ROUND_TYPES } from '@/lib/constants/rounds'
import { type RoundType } from '@/types/config-round'

interface RoundTypeGridProps {
  onSelectType?: (type: RoundType) => void
  className?: string
}

export function RoundTypeGrid({ onSelectType, className = '' }: RoundTypeGridProps) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className}`}>
      {Object.entries(ROUND_TYPES).map(([type, config]) => {
        const Icon = config.icon;
        return (
          <Button
            key={type}
            variant="outline"
            className="h-auto p-3 flex flex-col items-center justify-center gap-1 hover:bg-accent hover:text-accent-foreground"
            onClick={() => onSelectType?.(type as RoundType)}
          >
            <Icon className="h-6 w-6 mb-1" />
            <div className="text-sm font-semibold capitalize">{type}</div>
            <p className="text-xs text-muted-foreground line-clamp-2">{config.description}</p>
          </Button>
        );
      })}
    </div>
  )
} 