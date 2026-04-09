"use client"

import { useState } from 'react'
import { MoreHorizontal, Pencil, Share2, Trash2, Loader2, FileText, Code2, Table, ExternalLink, Download } from 'lucide-react'
import { useChatsStore } from '@/lib/stores/chatsStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import ShareModal from './ShareModal'
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

interface ChatDropdownMenuProps {
  chatId: string
  chatTitle: string
  configId: string
  onRename: (chatId: string, newName: string) => Promise<void>
  onDelete: () => Promise<void>
}

export function ChatDropdownMenu({ 
  chatId, 
  chatTitle, 
  configId, 
  onRename, 
  onDelete 
}: ChatDropdownMenuProps) {
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const setChats = useChatsStore(state => state.setChats)
  const allChats = useChatsStore(state => state.chats)

  const handleTranscriptDownload = (format: 'text' | 'json' | 'csv') => {
    // Open a new tab with the transcript URL
    const url = `/api/chats/${configId}/chat/${chatId}/transcript?format=${format}`
    window.open(url, '_blank')
  }

  const handleTranscriptDirectDownload = (format: 'text' | 'json' | 'csv') => {
    // Trigger direct download
    const url = `/api/chats/${configId}/chat/${chatId}/transcript?format=${format}&download=true`
    const link = document.createElement('a')
    link.href = url
    link.download = `transcript-${chatId}.${format === 'text' ? 'txt' : format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white hover:text-white hover:bg-transparent"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={() => setShowRenameModal(true)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100"
            onClick={() => setShowShareModal(true)}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-gray-700 hover:text-gray-900 focus:text-gray-900 focus:bg-gray-100">
              <FileText className="h-4 w-4 mr-2" />
              Transcript
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem className="justify-between pr-2" onSelect={(e) => e.preventDefault()}>
                <div className="flex items-center w-20">
                  <FileText className="h-4 w-4 mr-2" />
                  TXT
                </div>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTranscriptDownload('text')
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open a text file of this transcript in a new browser tab</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTranscriptDirectDownload('text')
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download a text version of this transcript</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="justify-between pr-2" onSelect={(e) => e.preventDefault()}>
                <div className="flex items-center w-20">
                  <Code2 className="h-4 w-4 mr-2" />
                  JSON
                </div>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTranscriptDownload('json')
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open a JSON file of this transcript in a new browser tab</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTranscriptDirectDownload('json')
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download a JSON version of this transcript</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="justify-between pr-2" onSelect={(e) => e.preventDefault()}>
                <div className="flex items-center w-20">
                  <Table className="h-4 w-4 mr-2" />
                  CSV
                </div>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTranscriptDownload('csv')
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open a CSV file of this transcript in a new browser tab</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTranscriptDirectDownload('csv')
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download a CSV version of this transcript</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem 
            className="text-red-600 hover:text-red-700 focus:text-red-700 focus:bg-gray-100"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const form = e.target as HTMLFormElement
            const title = (form.elements.namedItem('title') as HTMLInputElement).value
            await onRename(chatId, title)
            // Update the chats store
            setChats(allChats.map(chat => 
              chat.id === chatId 
                ? { ...chat, title }
                : chat
            ))
            setShowRenameModal(false)
          }} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">Chat Name</label>
              <Input
                id="title"
                name="title"
                defaultValue={chatTitle}
                placeholder="Enter chat name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowRenameModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <ShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        chatId={chatId}
        configId={configId}
        chatTitle={chatTitle}
      />

      {/* Delete Confirmation Modal */}
      <AlertDialog 
        open={showDeleteModal} 
        onOpenChange={(open) => {
          if (!isDeleting) {
            setShowDeleteModal(open)
          }
        }}
      >
        <AlertDialogContent className="bg-white border border-gray-400">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{chatTitle}&quot;</strong>? This will permanently remove the chat and all its messages from your account. This action cannot be undone.
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
              onClick={async (e) => {
                e.preventDefault()
                setIsDeleting(true)
                try {
                  await onDelete()
                  setShowDeleteModal(false)
                } finally {
                  setIsDeleting(false)
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Chat"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}