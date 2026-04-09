"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Download, ExternalLink, FileText, Code2, Table, RotateCcw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface PreviewBannerProps {
  configId: string;
  chatId: string;
  onCopyFromLive?: (sourceChatId: string) => Promise<void>;
  show?: boolean;
}

interface ChatListItem {
  id: string;
  title: string;
  originType: string;
  createdAt: string;
  messageCount?: number;
}

export function PreviewBanner({ configId, chatId, onCopyFromLive, show = true }: PreviewBannerProps) {
  const router = useRouter();
  const [showCopyModal, setShowCopyModal] = useState(false);
  // configTitle was removed as unused
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [chats] = useState<ChatListItem[]>([]);
  const [isLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleTranscriptDownload = (format: 'text' | 'json' | 'csv') => {
    const url = `/api/chats/${configId}/chat/${chatId}/transcript?format=${format}`;
    window.open(url, '_blank');
  };

  const handleTranscriptDirectDownload = (format: 'text' | 'json' | 'csv') => {
    const url = `/api/chats/${configId}/chat/${chatId}/transcript?format=${format}&download=true`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `preview-transcript-${chatId}.${format === 'text' ? 'txt' : format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyChat = async (sourceChatId: string) => {
    setIsCopying(true);
    try {
      if (onCopyFromLive) {
        await onCopyFromLive(sourceChatId);
        setShowCopyModal(false);
      }
    } catch (error) {
      console.error('[PreviewBanner] Failed to copy chat:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const handleNewChat = async () => {
    setIsResetting(true);
    try {
      const response = await fetch(`/api/configs/${configId}/preview-chat/reset`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to reset preview chat');
      }

      // Refresh the current page to reload with the new preview chat
      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error('[PreviewBanner] Failed to reset preview chat:', error);
      setIsResetting(false);
      // Modal will stay open on error so user can try again
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <div
        className={`bg-gray-200 border-b border-gray-300 px-6 flex items-center justify-between transition-all duration-300 ease-in-out overflow-hidden ${
          show ? 'h-14 opacity-100' : 'h-0 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-gray-600" />
          <span className="text-base font-semibold text-gray-800">
            Preview Mode
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-gray-600 hover:text-gray-800 transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-xs">
                <p className="text-sm">
                  Use preview chats to test your design. Click on the <RotateCcw className="h-3 w-3 inline mx-1" /> button to replay any message.
                </p>
                <p className="text-sm mt-2">
                  Note: token usage applies to preview chats.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          {/* Reset button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowNewChatModal(true)}
                  className="h-7 w-7 bg-gray-500 hover:bg-gray-600 text-white focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">Reset preview chat</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Transcript download */}
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-7 w-7 bg-gray-500 hover:bg-gray-600 text-white focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Download transcript</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileText className="h-4 w-4 mr-2" />
                  TXT
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleTranscriptDownload('text')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in tab
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTranscriptDirectDownload('text')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Code2 className="h-4 w-4 mr-2" />
                  JSON
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleTranscriptDownload('json')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in tab
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTranscriptDirectDownload('json')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Table className="h-4 w-4 mr-2" />
                  CSV
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleTranscriptDownload('csv')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in tab
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTranscriptDirectDownload('csv')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy from live chat - hidden for now */}
          {/* <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              loadChats();
              setShowCopyModal(true);
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Load Chat
          </Button> */}
        </div>
      </div>

      {/* Copy from live modal */}
      <Dialog open={showCopyModal} onOpenChange={setShowCopyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Chat into Preview</DialogTitle>
            <DialogDescription>
              Select a chat to load into your preview workspace. Current preview messages will be replaced.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">Loading chats...</div>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">No chats found. Create a live chat first.</div>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {chats.map((chat) => (
                  <Button
                    key={chat.id}
                    variant="outline"
                    className="w-full justify-between h-auto py-3 px-4"
                    onClick={() => handleCopyChat(chat.id)}
                    disabled={isCopying}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-medium text-left">{chat.title}</span>
                      <span className="text-xs text-gray-500">
                        {chat.messageCount ? `${chat.messageCount} messages` : 'No messages'} • {formatDate(chat.createdAt)}
                      </span>
                    </div>
                    <Badge variant={chat.originType === 'batch' ? 'secondary' : 'default'}>
                      {chat.originType}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset chat confirmation modal */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Preview Chat?</DialogTitle>
            <DialogDescription>
              All current messages in the preview workspace will be permanently deleted.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowNewChatModal(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleNewChat}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset Chat'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
