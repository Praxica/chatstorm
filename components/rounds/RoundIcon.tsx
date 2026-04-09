'use client'

import { LucideIcon } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { ROUND_TYPES } from '@/lib/constants/rounds'
import type { RoundType } from '@/types/config-round'

interface RoundIconProps {
  iconName?: string | null  // Custom icon name (e.g., "star", "heart")
  roundType?: RoundType     // Round type for default icon fallback
  className?: string        // Additional CSS classes
  fallback?: LucideIcon    // Custom fallback component
}

/**
 * Converts a kebab-case icon name to PascalCase for Lucide icon lookup
 * e.g., "message-circle" -> "MessageCircle"
 */
function formatIconName(iconName: string): string {
  return iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * RoundIcon component that handles rendering icons for rounds
 * Priority: custom icon -> round type default -> fallback
 */
export function RoundIcon({ 
  iconName, 
  roundType, 
  className = "h-4 w-4",
  fallback
}: RoundIconProps) {
  // First try custom icon if provided
  if (iconName && typeof iconName === 'string') {
    const formattedName = formatIconName(iconName)
    const CustomIcon = (LucideIcons as any)[formattedName] as LucideIcon | undefined
    
    if (CustomIcon) {
      return <CustomIcon className={className} />
    }
  }
  
  // Fall back to round type default icon
  if (roundType) {
    const roundTypeKey = roundType.toLowerCase() as keyof typeof ROUND_TYPES
    const typeConfig = ROUND_TYPES[roundTypeKey]
    
    if (typeConfig?.icon) {
      const TypeIcon = typeConfig.icon
      return <TypeIcon className={className} />
    }
  }
  
  // Use provided fallback or default MessageCircle
  if (fallback) {
    const FallbackIcon = fallback
    return <FallbackIcon className={className} />
  }
  
  // Final fallback to MessageCircle
  return <LucideIcons.MessageCircle className={className} />
}

/**
 * Helper function to check if an icon name is valid
 */
export function isValidIconName(iconName: string): boolean {
  const formattedName = formatIconName(iconName)
  return !!(LucideIcons as any)[formattedName]
}

/**
 * Get the icon component for a given name
 * Useful for cases where you need the component itself, not JSX
 */
export function getIconComponent(iconName: string): LucideIcon | null {
  const formattedName = formatIconName(iconName)
  return (LucideIcons as any)[formattedName] || null
}