import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { Loader2, Copy, Check, Share2, Lock, Globe } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface Share {
  id: string;
  createdAt: string;
  accessCount: number;
  isActive: boolean;
}

export default function ShareModal({ 
  open, 
  onOpenChange, 
  chatId, 
  configId,
  chatTitle
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  configId: string;
  chatTitle: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shares, setShares] = useState<Share[]>([]);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const { toast } = useToast();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

  // Load existing shares when modal opens
  useEffect(() => {
    if (open) {
      fetchShares();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chatId]);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chats/${configId}/chat/${chatId}/shares`);
      if (response.ok) {
        const data = await response.json();
        setShares(data.shares || []);
      } else {
        console.error('Error response from shares API:', response.status, response.statusText);
        toast({
          title: 'Error',
          description: 'Failed to load existing shares',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching shares:', error);
      toast({
        title: 'Error',
        description: 'Failed to load existing shares',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createShare = async () => {
    setIsCreatingShare(true);
    try {
      const response = await fetch(`/api/chats/${configId}/chat/${chatId}/share`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await response.json();
        toast({
          title: 'Chat shared',
          description: 'Anyone with the link can now view this chat',
        });
        await fetchShares();
      } else {
        console.error('Error response from share API:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to share chat';
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sharing chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to share chat',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingShare(false);
    }
  };

  const deactivateShare = async (shareId: string) => {
    try {
      const response = await fetch(`/api/shares/${shareId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast({
          title: 'Share deactivated',
          description: 'The shared link has been deactivated',
        });
        await fetchShares();
      } else {
        console.error('Error response from deactivate API:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to deactivate share';
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deactivating share:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate share',
        variant: 'destructive',
      });
    }
  };

  const copyShareLink = (shareId: string) => {
    const shareUrl = `${baseUrl}/share/${shareId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedShareId(shareId);
      setTimeout(() => setCopiedShareId(null), 2000);
      
      toast({
        title: 'Link copied',
        description: 'Share link copied to clipboard',
      });
    });
  };

  const deactivateAllShares = async () => {
    try {
      await Promise.all(shares.map(share => 
        share.isActive ? deactivateShare(share.id) : Promise.resolve()
      ));
      toast({
        title: 'Chat made private',
        description: 'All shared links have been deactivated',
      });
    } catch (error) {
      console.error('Error deactivating all shares:', error);
    }
  };

  const activeShares = shares.filter(share => share.isActive);
  const isPublic = activeShares.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Share &quot;{chatTitle}&quot;</DialogTitle>
          <DialogDescription>
            {isPublic
              ? "This chat is currently shared. Anyone with the link can view it."
              : "This chat is private. Only you can view it."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {isPublic ? (
                    <Globe className="h-5 w-5 text-green-500" />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    {isPublic ? "Public" : "Private"}
                  </span>
                </div>
                
                {isPublic ? (
                  <Button 
                    variant="outline" 
                    onClick={deactivateAllShares}
                  >
                    Make Private
                  </Button>
                ) : null}
              </div>

              {isPublic && activeShares.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-sm font-medium">Active share links:</h3>
                  <div className="space-y-2">
                    {activeShares.map((share) => (
                      <div 
                        key={share.id} 
                        className="flex items-center justify-between p-3 rounded-md border"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">
                            Created {formatDistanceToNow(new Date(share.createdAt))} ago
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {share.accessCount} {share.accessCount === 1 ? 'view' : 'views'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyShareLink(share.id)}
                          >
                            {copiedShareId === share.id ? (
                              <Check className="h-4 w-4 mr-1" />
                            ) : (
                              <Copy className="h-4 w-4 mr-1" />
                            )}
                            Copy
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => deactivateShare(share.id)}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={createShare}
            disabled={isCreatingShare}
            className="w-full sm:w-auto"
          >
            {isCreatingShare ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            {isPublic ? "Create New Share Link" : "Share Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 