import * as React from "react"
import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    const adjustHeight = () => {
      const textarea = textareaRef.current
      if (textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = '36px' // Slightly smaller initial height
        // Set the height to either the scrollHeight or max height (whichever is smaller)
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 36), 120) // Between 36px and 120px
        textarea.style.height = `${newHeight}px`
      }
    }

    // Adjust height whenever value changes
    useEffect(() => {
      adjustHeight()
    }, [value])

    // Initial setup and resize handling
    useEffect(() => {
      if (textareaRef.current) {
        adjustHeight()
        // Add resize observer to handle window/parent resizing
        const resizeObserver = new ResizeObserver(adjustHeight)
        resizeObserver.observe(textareaRef.current)
        return () => resizeObserver.disconnect()
      }
    }, [])

    return (
      <textarea
        className={cn(
          "flex h-9 min-h-[36px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={(element) => {
          // Handle both refs
          textareaRef.current = element
          if (typeof ref === 'function') {
            ref(element)
          } else if (ref) {
            ref.current = element
          }
        }}
        value={value}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea } 