"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { type ChatAgent } from "@/lib/stores/chatAgentStore"

interface AgentAvatarListProps {
  agents: (ChatAgent | null)[]
  maxDisplay?: number
  encodeAvatarSvg: (svg: string | undefined) => string
  className?: string
  avatarClassName?: string
  onAgentClick?: (agent: ChatAgent) => void
  showOverflowCount?: boolean
}

export function AgentAvatarList({
  agents,
  maxDisplay = 6,
  encodeAvatarSvg,
  className = "",
  avatarClassName = "",
  onAgentClick,
  showOverflowCount = true
}: AgentAvatarListProps) {
  return (
    <div className={`flex -space-x-2 ${className}`}>
      <TooltipProvider>
        {agents.slice(0, maxDisplay).map(agent => (
          <Tooltip key={agent?.id || 'unknown'}>
            <TooltipTrigger asChild>
              <Avatar
                className={`border-2 border-background bg-white ${avatarClassName}`}
                onClick={() => agent && onAgentClick?.(agent)}
                style={{ cursor: onAgentClick ? 'pointer' : 'default' }}
              >
                <AvatarImage src={encodeAvatarSvg(agent?.avatar)} />
                <AvatarFallback>
                  {agent?.name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{agent?.name || 'Unknown Agent'}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {showOverflowCount && agents.length > maxDisplay && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-8 h-8 flex items-end pt-1">
                <span className="text-gray-500 font-sm">&nbsp;&nbsp;+{agents.length - maxDisplay} </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{agents.length} total agents</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  )
} 