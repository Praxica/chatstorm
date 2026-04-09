import { useState } from 'react'
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
import { ConfigService } from '@/lib/services/ConfigService'
import { useToast } from "@/components/hooks/use-toast"

interface ConfigCopyModalProps {
  configId: string
  configTitle: string
  isOpen: boolean
  onClose: () => void
  onCopy: (newConfig: any) => void
}

export function ConfigCopyModal({ 
  configId, 
  configTitle, 
  isOpen, 
  onClose, 
  onCopy 
}: ConfigCopyModalProps) {
  const [newTitle, setNewTitle] = useState(`${configTitle} Copy`)
  const [isCopying, setIsCopying] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    if (!newTitle.trim()) return

    setIsCopying(true)
    try {
      const config = await ConfigService.getConfigWithRelations(configId)
      if (!config) {
        throw new Error('Chat design not found')
      }

      const newConfig = await ConfigService.copyConfigViaApi(config, config.userId, {
        title: newTitle // Use the user's custom title directly
      })

      onCopy(newConfig)
      onClose()
      // Don't redirect - let the parent component handle updating the list

      toast({
        title: "Chat design copied",
        description: `"${newTitle}" has been created successfully.`
      })
    } catch (error) {
      console.error('Error copying chat design:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to copy chat design",
        variant: "destructive"
      })
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isCopying) {
        onClose()
        if (open) {
          setNewTitle(`${configTitle} Copy`)
        }
      }
    }}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Copy Chat Design</DialogTitle>
          <DialogDescription>
            Create a copy of this chat design with a new name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Name</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter chat design name"
              className="w-full"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isCopying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={isCopying || !newTitle.trim()}
          >
            {isCopying ? "Copying..." : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 