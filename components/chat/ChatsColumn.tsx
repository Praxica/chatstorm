'use client'

import { useRouter } from "next/navigation"
import { useChatsStore } from "@/lib/stores/chatsStore"
import { useChatProgressStore } from "@/lib/stores/chatProgressStore"
import { cn } from "@/lib/utils"

interface ChatsColumnProps {
  configId: string;
  variant?: 'config' | 'chat';
}

export function ChatsColumn({ configId, variant: _variant = 'chat' }: ChatsColumnProps) {
  const chats = useChatsStore((state) => state.chats);
  const router = useRouter();
  const { currentChatId } = useChatProgressStore();

  return (
    <div className="border-l bg-white border-gray-200 overflow-y-auto h-full">
      <div className="p-4">
        <button
          onClick={() => router.push(`/chats/${configId}/chat/new`)}
          className="w-full px-4 py-2 text-sm text-white bg-black rounded-lg hover:bg-gray-800"
        >
          New Chat
        </button>
      </div>
      <div className="px-8 pb-2 pt-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">RECENT CHATS</h3>
      </div>
      <div className="space-y-2 p-4 pt-1">
        {chats.length === 0 ? (
          <div className="text-sm text-gray-500">No chats yet</div>
        ) : (
          chats.map((chat) => (
            <div 
              key={chat.id}
              className={cn(
                "group relative rounded-lg",
                chat.id === currentChatId ? 'bg-gray-100' : 'hover:bg-gray-50'
              )}
            >
              <button
                onClick={() => router.push(`/chats/${configId}/chat/${chat.id}`)}
                className={cn(
                  "w-full px-4 py-2 text-sm text-left text-gray-700 rounded-lg truncate whitespace-nowrap overflow-hidden",
                  chat.id === currentChatId ? 'font-semibold' : ''
                )}
                title={chat.title}
              >
                {chat.title}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 