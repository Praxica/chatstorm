'use client'

import { createContext, useContext } from 'react'
import { Message } from '@/types/message'

// Create a context for sharing message data and scroll function
interface ChatMessagesContextType {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  scrollToMessage: ((messageId: string) => void) | undefined;
  setScrollToMessageFn: (fn: ((messageId: string) => void) | undefined) => void;
  userImageUrl?: string;
  selectedMessageId: string | null;
  setSelectedMessageId: (id: string | null) => void;
}

export const ChatMessagesContext = createContext<ChatMessagesContextType>({
  messages: [],
  setMessages: () => {},
  scrollToMessage: undefined,
  setScrollToMessageFn: () => {},
  userImageUrl: undefined,
  selectedMessageId: null,
  setSelectedMessageId: () => {}
});

export const useChatMessages = () => useContext(ChatMessagesContext); 