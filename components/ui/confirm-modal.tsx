"use client"

import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface ConfirmModalProps {
  title: string
  message: ReactNode
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  cancelDisabled?: boolean
  confirmText?: string
}

export function ConfirmModal({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  isLoading = false,
  cancelDisabled = false,
  confirmText = "Delete"
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4 border border-gray-400">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <div className="text-gray-600 mb-6">{message}</div>
        <div className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={cancelDisabled}
            className="bg-gray-200 hover:bg-gray-100 border-gray-300"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm} 
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-500 disabled:bg-red-400"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {confirmText === "Delete" ? "Deleting..." : "Processing..."}
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 