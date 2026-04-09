import { create } from 'zustand';

export interface ChatListItem {
  id: string;
  title: string;
  createdAt: Date;
  configId: string;
  configTitle: string;
}

interface ChatsStore {
  chats: ChatListItem[]
  loadChats: (spaceId?: string) => Promise<void>;
  setChats: (chats: ChatListItem[]) => void;
  addChat: (chat: ChatListItem) => void;
  deleteChat: (chatId: string) => void;
  updateChat: (chatId: string, updates: Partial<ChatListItem>) => void;
}

export const useChatsStore = create<ChatsStore>((set) => ({
  chats: [],
  loadChats: async (spaceId?: string) => {
    try {
      const url = spaceId ? `/api/chats?spaceId=${spaceId}` : '/api/chats';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }
      const chatsData = await response.json();
      const chatsWithDates = chatsData.map((chat: any) => ({
        ...chat,
        createdAt: new Date(chat.createdAt)
      }));
      set({ chats: chatsWithDates });
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  },
  setChats: (chats) => set({ chats }),
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
  deleteChat: (chatId) => set((state) => ({
    chats: state.chats.filter(chat => chat.id !== chatId)
  })),
  updateChat: (chatId, updates) => set((state) => ({
    chats: state.chats.map(chat =>
      chat.id === chatId ? { ...chat, ...updates } : chat
    )
  }))
}));
