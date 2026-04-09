import { useState, useEffect, ReactNode } from 'react'
import { Button } from "@/components/ui/button"
import { ChevronLeft } from 'lucide-react'
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTopLayer } from '@/lib/hooks/useTopLayer'

interface RoundPanelProps {
  title: string
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  children: ReactNode
  description?: string
}

export function RoundPanel({
  title,
  isOpen,
  onClose,
  onSave,
  children,
  description
}: RoundPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const zIndex = useTopLayer(isOpen)

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger the animation
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ zIndex: zIndex ? zIndex - 1 : undefined }}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-[320px] bg-background border-r transform transition-transform duration-300 ease-out",
          isVisible ? "translate-x-0" : "-translate-x-full"
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
        <h3 className="font-semibold">{title}</h3>
      </div>

      <div className="flex flex-col h-[calc(100%-53px)]">
        <ScrollArea className="flex-1">
          <div className="px-4 py-8">
            {description && (
              <p className="text-sm mb-4">{description}</p>
            )}
            {children}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSave}>
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}