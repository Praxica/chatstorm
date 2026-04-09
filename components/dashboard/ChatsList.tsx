'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Building2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { getTimeAgo } from '@/lib/utils/time';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSpace } from '@/lib/contexts/SpaceContext';

interface ChatConfig {
  configId: string;
  configTitle: string;
  chatCount: number;
  lastChatId: string;
  lastChatAt: string | Date;
  roundType: string | null;
}

type SortOption = 'lastChat_desc' | 'lastChat_asc' | 'name_asc' | 'name_desc' | 'chatCount_desc' | 'chatCount_asc';

interface ChatsListProps {
  spaceId?: string;
}

export function ChatsList({ spaceId }: ChatsListProps) {
  const [chatConfigs, setChatConfigs] = useState<ChatConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatsListSortBy');
      return (saved as SortOption) || 'lastChat_desc';
    }
    return 'lastChat_desc';
  });

  useEffect(() => {
    localStorage.setItem('chatsListSortBy', sortBy);
  }, [sortBy]);

  // Helper function to render space badge icon
  const renderSpaceIcon = (iconName: string | null | undefined) => {
    if (!iconName) return <Building2 className="h-4 w-4 mr-2" />;
    
    const IconComponent = (LucideIcons as any)[iconName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('').replace(/[^a-zA-Z0-9]/g, '')];
    
    return IconComponent ? <IconComponent className="h-4 w-4 mr-2" /> : <Building2 className="h-4 w-4 mr-2" />;
  };

  useEffect(() => {
    async function fetchChats() {
      try {
        setLoading(true);
        // Add spaceId to the API call if provided
        const url = spaceId ? `/api/chats?spaceId=${spaceId}` : '/api/chats';
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch chats');
        }
        
        const data = await response.json();
        setChatConfigs(data);
      } catch (err) {
        console.error('Error fetching chats:', err);
        setError('Failed to load chat history');
      } finally {
        setLoading(false);
      }
    }

    fetchChats();
  }, [spaceId]);

  // Get space context if available (must be called before early returns)
  let space = null;
  try {
    const spaceContext = useSpace();
    space = spaceContext.space;
  } catch {
    // Not in space context
  }

  const sortedChatConfigs = [...chatConfigs].sort((a, b) => {
    switch (sortBy) {
      case 'lastChat_desc':
        return new Date(b.lastChatAt).getTime() - new Date(a.lastChatAt).getTime();
      case 'lastChat_asc':
        return new Date(a.lastChatAt).getTime() - new Date(b.lastChatAt).getTime();
      case 'name_asc':
        return a.configTitle.localeCompare(b.configTitle);
      case 'name_desc':
        return b.configTitle.localeCompare(a.configTitle);
      case 'chatCount_desc':
        return b.chatCount - a.chatCount;
      case 'chatCount_asc':
        return a.chatCount - b.chatCount;
      default:
        return 0;
    }
  });

  if (loading) {
    return <div className="text-center py-8">Loading your chat history...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  if (chatConfigs.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium mb-2">No chat history yet</h3>
        <p className="text-muted-foreground">
          Start a chat with one of your designs to see it here.
        </p>
      </div>
    );
  }

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
          <h2 className="text-2xl font-semibold">Chats</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select sort option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastChat_desc">Recently active</SelectItem>
              <SelectItem value="lastChat_asc">Least recently active</SelectItem>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="chatCount_desc">Most chats</SelectItem>
              <SelectItem value="chatCount_asc">Least chats</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedChatConfigs.map((chatConfig) => (
          <div key={chatConfig.configId} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
            <Link
              href={`/chats/${chatConfig.configId}/chat/${chatConfig.lastChatId}`}
              className="block p-4 flex-grow"
            >
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg mb-1 pr-2 line-clamp-1">{chatConfig.configTitle}</h3>
                  <p className="text-sm text-muted-foreground font-normal">
                    {chatConfig.chatCount} chat{chatConfig.chatCount !== 1 ? 's' : ''} • Last chat {getTimeAgo(new Date(chatConfig.lastChatAt))}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
} 