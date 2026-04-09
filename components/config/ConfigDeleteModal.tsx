import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ConfigService } from '@/lib/services/ConfigService'
import { useToast } from "@/components/hooks/use-toast"
import { useConfigsStore } from '@/lib/stores/configsStore'

interface ConfigDeleteModalProps {
  configId: string
  configTitle: string
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
}

export function ConfigDeleteModal({ 
  configId, 
  configTitle, 
  isOpen, 
  onClose, 
  onDelete 
}: ConfigDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const deleteConfig = useConfigsStore(state => state.deleteConfig)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await ConfigService.deleteConfig(configId)
      deleteConfig(configId)
      onDelete()
      onClose()
      toast({
        title: "Chat design deleted",
        description: "The chat design has been successfully deleted."
      })
    } catch (error) {
      console.error('Error deleting chat design:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete chat design",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog 
      open={isOpen} 
      onOpenChange={(_open) => {
        if (!isDeleting) {
          onClose()
        }
      }}
    >
      <AlertDialogContent className="bg-white border border-gray-400">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Chat Design</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{configTitle}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            className="bg-gray-200 hover:bg-gray-100 border-gray-300"
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            className="bg-red-600 hover:bg-red-500 disabled:bg-red-400" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 