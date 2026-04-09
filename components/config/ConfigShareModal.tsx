import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/hooks/use-toast"

interface ConfigShareModalProps {
  configId: string
  isOpen: boolean
  onClose: () => void
}

export function ConfigShareModal({ configId, isOpen, onClose }: ConfigShareModalProps) {
  const [email, setEmail] = useState('')
  const [isSharing, setIsSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleShare = async () => {
    if (!email.trim()) return
    
    setIsSharing(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/configs/${configId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipientEmail: email.trim() })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to share design')
      }
      
      setSuccess(true)
      toast({
        title: "Design shared",
        description: `An invitation has been sent to ${email}`
      })
      
      // Reset form after successful sharing
      setTimeout(() => {
        setEmail('')
        setSuccess(false)
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Error sharing design:', error)
      setError(error instanceof Error ? error.message : 'Failed to share design')
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to share design",
        variant: "destructive"
      })
    } finally {
      setIsSharing(false)
    }
  }

  const handleViewInvitations = () => {
    onClose()
    router.push('/settings/designs')
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!isSharing) {
          onClose()
          if (open) {
            setEmail('')
            setError(null)
            setSuccess(false)
          }
        }
      }}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Share Design</DialogTitle>
            <DialogDescription>
              Share this design with another user. An invitation email will be sent with a link to access the design.{' '}
              <Button
                variant="link"
                onClick={handleViewInvitations}
                className="p-0 h-auto text-sm font-medium underline hover:no-underline inline-flex"
              >
                View Sent Invitations
              </Button>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Recipient Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                disabled={isSharing || success}
                className="w-full"
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}
            
            {success && (
              <div className="text-sm text-green-500">
                Invitation sent successfully! An email has been sent to {email} with access instructions.
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSharing}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={isSharing || !email.trim() || success}
            >
              {isSharing ? "Sending..." : "Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 