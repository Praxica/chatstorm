"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoundIcon, isValidIconName } from "@/components/rounds/RoundIcon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Common icon names that are likely to be useful for rounds and spaces
// Organized by category for better UX
const ICON_CATEGORIES = {
  "Round Types": [
    "compass", "clipboard-list", "message-circle", "lightbulb", "users",
    "file-search", "file-text", "book-open", "settings"
  ],
  "People & Avatars": [
    "user", "users", "user-plus", "user-minus", "user-check", "user-x",
    "user-cog", "contact", "smile", "frown", "meh", 
    "baby", "person-standing", "accessibility", "users-round",
    "circle-user", "circle-user-round", "square-user", "square-user-round"
  ],
  "Healthcare & Medical": [
    "stethoscope", "pill", "syringe", "thermometer", "heart-pulse",
    "activity", "cross", "hospital", "ambulance", "heart-handshake",
    "heart", "heartbeat", "band-aid", "test-tubes", "dna",
    "brain", "scan", "scan-eye", "scan-face", "scan-line",
    "wheelchair", "bed", "bed-double", "clipboard-plus"
  ],
  "Business & Work": [
    "building-2", "briefcase", "building", "factory",
    "store", "shopping-bag", "warehouse", "construction", "hammer", "wrench",
    "presentation", "chart-bar", "trending-up", "dollar-sign", "coins",
    "banknote", "credit-card", "receipt", "calculator", "landmark"
  ],
  "Education": [
    "graduation-cap", "book-open", "book", "library", "school",
    "pencil", "pen-tool", "ruler", "calculator", "microscope", "flask",
    "notebook", "clipboard", "award", "medal", "trophy"
  ],
  "Technology": [
    "code", "terminal", "laptop", "monitor", "server",
    "database", "cpu", "hard-drive", "wifi", "bluetooth", "usb",
    "globe", "cloud", "bot", "zap", "shield", "binary",
    "git-branch", "git-merge", "github", "gitlab", "smartphone"
  ],
  "Creative": [
    "palette", "brush", "camera", "music", "video", "image",
    "film", "radio", "mic", "headphones", "gamepad-2", "scissors",
    "sparkles", "wand-2", "paintbrush", "pen", "highlighter",
    "eraser", "crop", "aperture", "feather"
  ],
  "Science & Research": [
    "microscope", "flask", "atom", "dna", "telescope", "beaker",
    "test-tube", "gauge", "activity", "bar-chart", "pie-chart",
    "brain", "search", "eye", "zoom-in", "petri-dish", "radiation",
    "biohazard", "lab", "magnet", "orbit"
  ],
  "Communication": [
    "message-circle", "mail", "phone", "message-square", "messages-square",
    "megaphone", "radio", "satellite", "send", "inbox", 
    "share-2", "at-sign", "voicemail", "phone-call", "phone-incoming",
    "phone-outgoing", "video", "mic", "mic-off", "volume-2"
  ],
  "Actions & Tools": [
    "play", "pause", "stop-circle", "refresh-cw", "rotate-cw",
    "download", "upload", "save", "trash-2", "edit",
    "copy", "cut", "filter", "search", "zoom-in", "settings-2",
    "tool", "hammer", "wrench", "screwdriver", "paintbrush-2"
  ],
  "Nature & Environment": [
    "tree-pine", "flower", "leaf", "sun", "moon", "cloud",
    "mountain", "waves", "flame", "zap", "droplet", "wind",
    "snowflake", "sunrise", "sunset", "rainbow", "cloud-rain",
    "cloud-snow", "trees", "sprout", "flower-2"
  ],
  "Transportation": [
    "car", "truck", "plane", "train", "ship", "bike",
    "bus", "taxi", "rocket", "anchor", "navigation",
    "map", "map-pin", "compass", "globe-2", "route"
  ],
  "Food & Beverage": [
    "utensils", "coffee", "beer", "wine", "milk",
    "apple", "banana", "cherry", "citrus", "grape",
    "pizza", "cake", "cookie", "soup", "sandwich"
  ],
  "Alerts & Status": [
    "alert-circle", "alert-triangle", "info", "help-circle",
    "check-circle", "x-circle", "flag", "bell", "bell-ring",
    "badge", "verified", "shield-check", "lock", "unlock",
    "eye", "eye-off", "ban", "badge-check", "badge-x"
  ],
  "Shapes & Symbols": [
    "circle", "square", "triangle", "diamond", "heart", "star",
    "plus", "minus", "x", "check", "arrow-right", "arrow-up",
    "chevron-right", "more-horizontal", "grid-3x3", "layers",
    "hexagon", "octagon", "pentagon"
  ]
}

interface IconPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (iconName: string) => void
  currentIcon?: string
}

export default function IconPicker({ isOpen, onClose, onSelect, currentIcon }: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Clear search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
    }
  }, [isOpen])

  // Get categories that have matching icons
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return ICON_CATEGORIES
    
    const query = searchQuery.toLowerCase()
    const result: Record<string, string[]> = {}
    
    Object.entries(ICON_CATEGORIES).forEach(([category, icons]) => {
      const matchingIcons = icons.filter(iconName => 
        iconName.toLowerCase().includes(query) ||
        iconName.replace(/-/g, ' ').toLowerCase().includes(query)
      )
      if (matchingIcons.length > 0) {
        result[category] = matchingIcons
      }
    })
    
    return result
  }, [searchQuery])

  const handleSelect = (iconName: string) => {
    onSelect(iconName)
    onClose()
  }

  const renderIcon = (iconName: string) => {
    if (!isValidIconName(iconName)) return null
    
    const isSelected = currentIcon === iconName
    const displayName = iconName.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    
    return (
      <div key={iconName} className="flex flex-col items-center gap-1">
        <Button
          variant={isSelected ? "default" : "ghost"}
          size="icon"
          className={cn(
            "w-12 h-12 flex items-center justify-center transition-all duration-200",
            isSelected && "ring-2 ring-black ring-offset-2 bg-black hover:bg-gray-800",
            !isSelected && "hover:bg-muted hover:scale-105"
          )}
          onClick={() => handleSelect(iconName)}
          title={displayName}
        >
          <RoundIcon 
            iconName={iconName}
            className={cn(
              "h-5 w-5 transition-colors",
              isSelected ? "text-white" : ""
            )} 
          />
        </Button>
        <span className="text-xs text-gray-600 text-center max-w-16 truncate leading-tight">
          {displayName}
        </span>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose Icon</DialogTitle>
          <DialogDescription>
            Select an icon from the categories below or use search to find a specific icon.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-none mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim() ? (
            // Show search results
            <div className="space-y-6">
              {Object.keys(filteredCategories).length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No icons found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                Object.entries(filteredCategories).map(([category, icons]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{category}</h3>
                    <div className="grid grid-cols-6 gap-3">
                      {icons.map(renderIcon)}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            // Show all categories
            <div className="space-y-6">
              {Object.entries(ICON_CATEGORIES).map(([category, icons]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">{category}</h3>
                  <div className="grid grid-cols-6 gap-3">
                    {icons.map(renderIcon)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-none">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {currentIcon && (
            <Button variant="ghost" onClick={() => handleSelect("")}>
              Remove Icon
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}