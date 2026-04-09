import { create } from 'zustand';
import { Message } from '@/types/message';

interface ChatMessagesStoreState {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;
}

export const useChatMessagesStore = create<ChatMessagesStoreState>((set) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
})); 