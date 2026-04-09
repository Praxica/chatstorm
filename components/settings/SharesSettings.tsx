"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/hooks/use-toast"
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Trash2, ExternalLink } from "lucide-react"
import Link from 'next/link'

interface Share {
  id: string
  createdAt: string
  lastAccessedAt: string
  accessCount: number
  isActive: boolean
  chat: {
    title: string
    id: string
  }
}

export default function SharesSettings() {
  const [shares, setShares] = useState<Share[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchShares()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchShares = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/user/shares')
      if (response.ok) {
        const data = await response.json()
        setShares(data.shares || [])
      } else {
        console.error('Error response from shares API:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to load shares'
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching shares:', error)
      toast({
        title: 'Error',
        description: 'Failed to load shares',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deleteShare = async (shareId: string) => {
    try {
      const response = await fetch(`/api/shares/${shareId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setShares(shares.filter(share => share.id !== shareId))
        toast({
          title: 'Share deleted',
          description: 'The shared link has been removed',
        })
      } else {
        console.error('Error response from delete API:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to delete share'
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting share:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete share',
        variant: 'destructive',
      })
    }
  }

  const deleteAllShares = async () => {
    setIsDeletingAll(true)
    try {
      const response = await fetch('/api/user/shares', {
        method: 'DELETE',
      })
      
      if (response.ok) {
        await fetchShares()
        toast({
          title: 'All shares deleted',
          description: 'All shared links have been removed',
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete all shares',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting all shares:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete all shares',
        variant: 'destructive',
      })
    } finally {
      setIsDeletingAll(false)
    }
  }

  const activeShares = shares.filter(share => share.isActive)

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Shared Chats</h3>
        {activeShares.length > 0 && (
          <Button 
            variant="destructive" 
            size="sm"
            disabled={isDeletingAll}
            onClick={deleteAllShares}
          >
            {isDeletingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete All Shares
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : activeShares.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>You don&apos;t have any active shared chats.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4 px-4 py-2 font-semibold text-sm">
            <div className="col-span-5">Chat Name</div>
            <div className="col-span-3">Date Shared</div>
            <div className="col-span-2">Views</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          
          {activeShares.map((share) => (
            <div 
              key={share.id}
              className="grid grid-cols-12 gap-4 px-4 py-3 rounded-md border items-center"
            >
              <div className="col-span-5 font-medium truncate">
                {share.chat.title}
              </div>
              <div className="col-span-3 text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(share.createdAt))} ago
              </div>
              <div className="col-span-2 text-sm">
                {share.accessCount}
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <Link href={`/share/${share.id}`} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">View chat</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteShare(share.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Delete share</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 