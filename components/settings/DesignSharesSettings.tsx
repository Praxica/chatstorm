'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow, isAfter } from 'date-fns'
import { Loader2, Mail } from 'lucide-react'
import { useToast } from "@/components/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Invitation {
  id: string
  configId: string
  configTitle: string
  recipientEmail: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: string
  expiresAt: string
}

// Helper function to determine if invitation is expired
function isInvitationExpired(invitation: Invitation): boolean {
  return invitation.status === 'expired' || isAfter(new Date(), new Date(invitation.expiresAt));
}

// Helper function to get effective status
function getEffectiveStatus(invitation: Invitation): 'pending' | 'accepted' | 'declined' | 'expired' {
  if (isInvitationExpired(invitation) && invitation.status === 'pending') {
    return 'expired';
  }
  return invitation.status as 'pending' | 'accepted' | 'declined' | 'expired';
}

export default function DesignSharesSettings() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  
  // Fetch all invitations
  useEffect(() => {
    async function fetchInvitations() {
      try {
        const response = await fetch('/api/configs/invitations')
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch invitations')
        }
        
        const data = await response.json()
        setInvitations(data)
      } catch (error) {
        console.error('Error fetching invitations:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch invitations')
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch invitations",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchInvitations()
  }, [toast])
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Shared Designs</h3>
        <p className="text-sm text-muted-foreground">
          Manage designs you&apos;ve shared with others
        </p>
      </div>
      
      {error ? (
        <div className="bg-red-50 p-4 rounded-md text-red-700 mb-6">
          {error}
        </div>
      ) : null}
      
      {invitations.length === 0 ? (
        <Card className="bg-muted/40">
          <CardContent className="p-6 text-center">
            <Mail className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">You haven&apos;t shared any designs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {invitations.map((invitation) => {
            const effectiveStatus = getEffectiveStatus(invitation);
            
            return (
              <Card key={invitation.id} className="bg-card/60">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{invitation.configTitle}</CardTitle>
                        <Badge
                          className={cn(
                            "text-xs py-0.5 px-2 h-5",
                            effectiveStatus === 'pending' && "bg-blue-500",
                            effectiveStatus === 'accepted' && "bg-green-500",
                            effectiveStatus === 'declined' && "bg-red-500",
                            effectiveStatus === 'expired' && "bg-gray-500"
                          )}
                        >
                          {effectiveStatus === 'pending' && "Pending"}
                          {effectiveStatus === 'accepted' && "Accepted"}
                          {effectiveStatus === 'declined' && "Declined"}
                          {effectiveStatus === 'expired' && "Expired"}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">
                        Sent {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push(`/config/${invitation.configId}/edit`)}
                      className="h-7 px-2"
                    >
                      View Design
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="text-sm">
                    <span className="font-medium">Recipient:</span> {invitation.recipientEmail}
                  </div>
                  {effectiveStatus === 'pending' && (
                    <div className="text-sm mt-1 text-muted-foreground">
                      <span className="font-medium">Expires:</span> {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  )
} 