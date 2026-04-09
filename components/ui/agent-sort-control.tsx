'use client'

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useChatAgentStore, type AgentSortField, type SortDirection } from '@/lib/stores/chatAgentStore'

const SORT_FIELD_LABELS: Record<AgentSortField, string> = {
  name: 'Name',
  createdAt: 'Created'
}

interface AgentSortControlProps {
  className?: string
}

export function AgentSortControl({ className }: AgentSortControlProps) {
  const { sortBy, sortDirection, setSorting } = useChatAgentStore()

  const handleSortFieldChange = (field: AgentSortField) => {
    // If clicking the same field, toggle direction
    if (field === sortBy) {
      const newDirection: SortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSorting(field, newDirection)
    } else {
      // If clicking a different field, use ascending by default
      setSorting(field, 'asc')
    }
  }

  const getSortIcon = () => {
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3" />
    } else {
      return <ArrowDown className="h-3 w-3" />
    }
  }

  const getHoverText = (field: AgentSortField) => {
    const isCurrentField = field === sortBy
    
    if (field === 'name') {
      if (isCurrentField) {
        const newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
        return newDirection === 'asc' 
          ? 'A to Z'
          : 'Z to A'
      } else {
        return 'A to Z'
      }
    } else if (field === 'createdAt') {
      if (isCurrentField) {
        const newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
        return newDirection === 'asc'
          ? 'Oldest first'
          : 'Newest first'
      } else {
        return 'Oldest first'
      }
    }
    return ''
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={`h-8 bg-gray-50 hover:bg-gray-100 flex items-center gap-1 px-2 ${className}`}
        >
          <span className="text-xs">
            {SORT_FIELD_LABELS[sortBy]}
          </span>
          {getSortIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[160px]">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Sort by:
        </div>
        <DropdownMenuSeparator />
        {Object.entries(SORT_FIELD_LABELS).map(([field, label]) => (
          <DropdownMenuItem
            key={field}
            onClick={() => handleSortFieldChange(field as AgentSortField)}
            className="flex items-center gap-2 py-2"
          >
            <span className="text-sm">{label}</span>
            <span className="text-xs text-muted-foreground">
              {getHoverText(field as AgentSortField)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 