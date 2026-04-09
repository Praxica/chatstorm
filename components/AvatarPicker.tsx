"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { createAvatar } from '@dicebear/core'
import * as miniavs from '@dicebear/miniavs'
import * as bottts from '@dicebear/bottts'
import * as funEmoji from '@dicebear/fun-emoji'
import * as pixelArt from '@dicebear/pixel-art'
import { Avatar } from "@/components/ui/avatar"

interface AvatarPickerProps {
  onClose: () => void
  onSelect: (avatar: string) => void
}

export default function AvatarPicker({ onClose, onSelect }: AvatarPickerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [seed, setSeed] = useState(Math.random().toString(36).substring(7))

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const regenerate = () => {
    setSeed(Math.random().toString(36).substring(7))
  }

  const miniavsAvatar = createAvatar(miniavs, {
    seed,
    backgroundColor: ['b6e3f4','c0aede','d1d4f9']
  }).toString()
  
  const botAvatar = createAvatar(bottts, {
    seed,
    backgroundColor: ['b6e3f4','c0aede','d1d4f9']
  }).toString()
  
  const emojiAvatar = createAvatar(funEmoji, {
    seed
  }).toString()
  
  const pixelAvatar = createAvatar(pixelArt, {
    seed,
    backgroundColor: ['b6e3f4','c0aede','d1d4f9']
  }).toString()

  const handleSelect = (avatar: string) => {
    onSelect(avatar)
  }

  return (
    <div className={cn(
      "absolute inset-0 bg-white transform transition-transform duration-300 flex flex-col",
      isVisible ? "translate-x-0" : "translate-x-full"
    )}>
      <div className="p-4 border-b border-gray-200 flex-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">Choose Avatar</h2>
        </div>
      </div>
      
      <div className="p-4 flex-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="ghost" 
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => handleSelect(miniavsAvatar)}
            >
              <Avatar className="w-24 h-24">
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(miniavsAvatar)}`} alt="Miniavs avatar" />
              </Avatar>
            </Button>
            <span className="text-sm text-gray-500">Miniavs</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="ghost" 
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => handleSelect(botAvatar)}
            >
              <Avatar className="w-24 h-24">
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(botAvatar)}`} alt="Bot avatar" />
              </Avatar>
            </Button>
            <span className="text-sm text-gray-500">Bot</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="ghost" 
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => handleSelect(emojiAvatar)}
            >
              <Avatar className="w-24 h-24">
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(emojiAvatar)}`} alt="Emoji avatar" />
              </Avatar>
            </Button>
            <span className="text-sm text-gray-500">Fun Emoji</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="ghost" 
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => handleSelect(pixelAvatar)}
            >
              <Avatar className="w-24 h-24">
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(pixelAvatar)}`} alt="Pixel Art" />
              </Avatar>
            </Button>
            <span className="text-sm text-gray-500">Pixel Art</span>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <Button onClick={regenerate} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate New
          </Button>
        </div>
      </div>
    </div>
  )
} 