'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDistanceToNow, format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/hooks/use-toast'
import { isAfter } from 'date-fns'

interface InvitationDetails {
  id: string
  token: string
  configId: string
  configTitle: string
  senderName?: string
  senderEmail: string
  recipientEmail: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: string
  expiresAt: string
}

// Helper function to determine if invitation is expired
function isInvitationExpired(invitation: InvitationDetails): boolean {
  return invitation.status === 'expired' || isAfter(new Date(), new Date(invitation.expiresAt));
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> | { token: string } }) {
  // Unwrap params if it's a Promise
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const token = resolvedParams.token;
  
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [actionCompleted, setActionCompleted] = useState(false)
  const [actionSuccess, setActionSuccess] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const router = useRouter()
  const { toast } = useToast()
  
  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      try {
        const response = await fetch(`/api/configs/invitations/${token}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch invitation')
        }
        
        const data = await response.json()
        setInvitation(data)
      } catch (error) {
        console.error('Error fetching invitation:', error)
        setError(error instanceof Error ? error.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    
    fetchInvitation()
  }, [token])
  
  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await fetch(`/api/configs/invitations/${token}/accept`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setActionCompleted(true);
      setActionSuccess(true);
      
      if (data.alreadyAccepted) {
        // Handle already accepted case
        setActionMessage(data.message || 'This invitation has already been accepted.');
        
        // Redirect to the config if we have its ID
        if (data.configId) {
          setTimeout(() => {
            router.push(`/config/${data.configId}/edit`);
          }, 2000);
        }
      } else {
        // Handle normal acceptance
        setActionMessage('Invitation accepted successfully! Redirecting to the design...');
        
        // Redirect to the new config after a short delay
        setTimeout(() => {
          router.push(`/config/${data.configId}/edit`);
        }, 2000);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setActionCompleted(true);
      setActionSuccess(false);
      setActionMessage(error instanceof Error ? error.message : 'Failed to accept invitation');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };
  
  const handleDecline = async () => {
    setDeclining(true);
    try {
      const response = await fetch(`/api/configs/invitations/${token}/decline`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to decline invitation');
      }

      setActionCompleted(true);
      setActionSuccess(true);
      setActionMessage('Invitation declined successfully.');
    } catch (error) {
      console.error('Error declining invitation:', error);
      setActionCompleted(true);
      setActionSuccess(false);
      setActionMessage(error instanceof Error ? error.message : 'Failed to decline invitation');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to decline invitation',
        variant: 'destructive',
      });
    } finally {
      setDeclining(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (actionCompleted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {actionSuccess ? 'Success' : 'Error'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={actionSuccess ? 'text-primary' : 'text-destructive'}>
              {actionMessage}
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!invitation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Could not find invitation'}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/')}>
              Return Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }
  
  // Check if invitation is expired
  const isExpired = isInvitationExpired(invitation)
  
  if (isExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This invitation has expired and is no longer valid.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }
  
  if (invitation.status === 'accepted') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Already Accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This invitation has already been accepted. You can view the design by clicking the button below.</p>
          </CardContent>
          <CardFooter>
            <div className="flex gap-2 w-full">
              <Button 
                onClick={() => router.push('/')} 
                variant="outline"
                className="w-full sm:w-auto"
              >
                Go to Homepage
              </Button>
              <Button 
                onClick={() => router.push(`/config/${invitation.configId}/edit`)}
                className="w-full sm:w-auto"
              >
                View Design
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Design Invitation</CardTitle>
          <CardDescription>
            You have been invited to collaborate on a design
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-semibold">Design:</p>
            <p>{invitation.configTitle}</p>
          </div>
          <div>
            <p className="font-semibold">Invited by:</p>
            <p>{invitation.senderName || 'A Chatstorm user'}</p>
          </div>
          <div>
            <p className="font-semibold">Expires:</p>
            <p>
              {format(new Date(invitation.expiresAt), 'PPP')} ({formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })})
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleAccept} 
            disabled={accepting || declining}
            className="w-full sm:w-auto"
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </Button>
          <Button 
            onClick={handleDecline}
            variant="outline"
            disabled={accepting || declining}
            className="w-full sm:w-auto"
          >
            {declining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Declining...
              </>
            ) : (
              'Decline'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 