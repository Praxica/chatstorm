'use client'

import { useState, useEffect } from 'react';
import { useConfigsStore } from '@/lib/stores/configsStore';
import Link from 'next/link';
import { getTimeAgo } from '@/lib/utils/time';
import { useToast } from "@/components/hooks/use-toast";
import { useCreateConfig } from '@/lib/hooks/useCreateConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfigMenu } from '@/components/config/ConfigMenu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NewConfigModal } from './NewConfigModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpAZ, ArrowDownAZ, Plus, ChevronRight, Building2, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useSpaceSafe } from '@/lib/contexts/SpaceContext';
import { useRouter } from 'next/navigation';
import * as LucideIcons from 'lucide-react';

type SortOption = 'created_asc' | 'created_desc' | 'name_asc' | 'name_desc' | 'updated_asc' | 'updated_desc';

interface ConfigsListProps {
  spaceId?: string;
}

export function ConfigsList({ spaceId }: ConfigsListProps) {
  const configs = useConfigsStore((state) => state.configs);
  const hasStartedLoading = useConfigsStore((state) => state.hasStartedLoading);
  const deleteConfig = useConfigsStore((state) => state.deleteConfig);
  const addConfig = useConfigsStore((state) => state.addConfig);
  const loadConfigs = useConfigsStore((state) => state.loadConfigs);

  const { toast } = useToast();
  const { createConfig } = useCreateConfig();
  const router = useRouter();

  // Use space context if available
  const spaceContext = useSpaceSafe();
  const space = spaceContext?.space || null;
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatDesignsSortBy');
      return (saved as SortOption) || 'created_desc';
    }
    return 'created_desc';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    localStorage.setItem('chatDesignsSortBy', sortBy);
  }, [sortBy]);

  // Helper function to render space badge icon
  const renderSpaceIcon = (iconName: string | null | undefined) => {
    if (!iconName) return <Building2 className="h-4 w-4 mr-2" />;
    
    const IconComponent = (LucideIcons as any)[iconName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('').replace(/[^a-zA-Z0-9]/g, '')];
    
    return IconComponent ? <IconComponent className="h-4 w-4 mr-2" /> : <Building2 className="h-4 w-4 mr-2" />;
  };

  // Load configs when component mounts or spaceId changes
  useEffect(() => {
    loadConfigs(spaceId);
  }, [loadConfigs, spaceId]);

  const handleCreateConfig = async (title: string, projectIds: string[]) => {
    try {
      await createConfig(title, projectIds);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create chat design",
        variant: "destructive"
      });
    }
  };

  const sortedConfigs = [...configs].sort((a, b) => {
    switch (sortBy) {
      case 'created_asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'created_desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'name_asc':
        return a.title.localeCompare(b.title);
      case 'name_desc':
        return b.title.localeCompare(a.title);
      case 'updated_asc':
        return new Date(a.lastUpdatedAt).getTime() - new Date(b.lastUpdatedAt).getTime();
      case 'updated_desc':
        return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime();
      default:
        return 0;
    }
  });

  // Show loading state until data has started loading
  if (!hasStartedLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // Show empty state if no configs after loading
  if (configs.length === 0) {
    return (
      <>
        <div className="py-12">
          <h3 className="text-lg font-medium mb-2">Let&apos;s add your first chat design</h3>
          <p className="text-muted-foreground mb-8">
            Get started by creating a new chat design
          </p>
          <Button onClick={() => setShowConfigModal(true)}>
            Design a new Chat
          </Button>
        </div>

        <NewConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSave={handleCreateConfig}
          type={null}
          defaultTitle="New Chat Design"
        />
      </>
    );
  }

  const handleDeleteConfig = async () => {
    if (!selectedConfig) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/configs/${selectedConfig}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete design');
      }

      deleteConfig(selectedConfig);
      setShowDeleteDialog(false);
      toast({
        title: "Design deleted",
        description: "The design has been successfully deleted."
      });
    } catch (error) {
      console.error('Error deleting design:', error instanceof Error ? error.message : error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete design",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setSelectedConfig(null);
    }
  };

  const handleCopyConfig = async () => {
    if (!selectedConfig || !newTitle.trim()) return;
    
    setIsCopying(true);
    try {
      const response = await fetch(`/api/configs/${selectedConfig}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: newTitle.trim() 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to copy design');
      }

      const data = await response.json();
      
      // Add the new config to the store
      addConfig(data);
      
      setShowCopyDialog(false);
      
      // Redirect to the new config edit page
      router.push(`/config/${data.id}/edit`);
      
      toast({
        title: "Design copied",
        description: "The design has been successfully copied."
      });
    } catch (error) {
      console.error('Error copying design:', error instanceof Error ? error.message : error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to copy design",
        variant: "destructive"
      });
    } finally {
      setIsCopying(false);
      setSelectedConfig(null);
    }
  };

  return (
    <section className="space-y-6 pb-12">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          {space && (
            <>
              <Badge variant="secondary" className="text-xl px-3 py-1 flex items-center">
                {renderSpaceIcon(space.badgeIcon)}
                {space.name}
              </Badge>
              <ChevronRight className="w-5 h-5 text-gray-400 mx-1" />
            </>
          )}
          <h2 className="text-2xl font-semibold">Designs</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="h-6 w-6 bg-black hover:bg-black/90 p-0"
                  onClick={() => setShowConfigModal(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add a new Chat Design</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">Last Updated</SelectItem>
              <SelectItem value="created_desc">Date Created</SelectItem>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                  {sortOrder === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedConfigs.map((config) => (
          <Link 
            key={config.id} 
            href={`/config/${config.id}/edit`}
            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col cursor-pointer group"
          >
            <div className="p-4 flex-grow">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-lg mb-1 pr-2 group-hover:underline">
                  {config.title}
                </h3>
                <div onClick={(e) => e.preventDefault()}>
                  <ConfigMenu
                    configId={config.id}
                    configTitle={config.title}
                    onConfigUpdate={() => {
                      // Refresh the configs list
                    }}
                    onConfigDelete={() => {
                      // Config is deleted from the store, so the list will re-render
                    }}
                  />
                </div>
              </div>
              <div className="text-sm text-gray-500 mb-3">
                {config.rounds[0]?.type && (
                  <span className="capitalize">{config.rounds[0].type}</span>
                )} • {getTimeAgo(new Date(config.lastUpdatedAt))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <AlertDialog 
        open={showDeleteDialog} 
        onOpenChange={(open) => {
          if (!isDeleting) {
            setShowDeleteDialog(open);
          }
        }}
      >
        <AlertDialogContent className="bg-white border border-gray-400">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Design</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this design? This action cannot be undone.
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
              onClick={handleDeleteConfig}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog 
        open={showCopyDialog} 
        onOpenChange={(open) => {
          if (!isCopying) {
            setShowCopyDialog(open);
          }
        }}
      >
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Copy Design</DialogTitle>
            <DialogDescription>
              Create a copy of this design with a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Name</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter design name"
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCopyDialog(false)}
              disabled={isCopying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCopyConfig}
              disabled={isCopying || !newTitle.trim()}
            >
              {isCopying ? "Copying..." : "Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSave={handleCreateConfig}
        type={null}
        defaultTitle="New Chat Design"
      />
    </section>
  );
} 