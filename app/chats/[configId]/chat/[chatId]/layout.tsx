'use client'

import { use, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChatsColumn } from "@/components/chat/ChatsColumn"
import ChatProgress from "@/components/ChatProgress"
import { ChatDataLoader } from "@/components/chat/ChatDataLoader"
import { Message } from '@/types/message'
import { useUser } from '@clerk/nextjs'
import { ChatMessagesContext } from '@/lib/contexts/ChatMessagesContext'
import { useChatProgressStore } from '@/lib/stores/chatProgressStore'

// Helper for development-only logging
const logDebug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

interface ChatLayoutProps {
  children: React.ReactNode
  params: Promise<{ configId: string; chatId: string }>
}

export default function ChatLayout({ children, params }: ChatLayoutProps) {
  // Unwrap the params using React.use()
  const {configId, chatId} = use(params)
  
  logDebug(`Layout rendered with URL params:`, { 
    configId, 
    chatId, 
    storeId: useChatProgressStore.getState().currentChatId 
  });
  
  // Get user info
  const { user } = useUser()
  const userImageUrl = user?.imageUrl
  
  // State for messages and scroll function to be passed to ChatProgress
  const [messages, setMessages] = useState<Message[]>([])
  const [scrollToMessage, setScrollToMessageFn] = useState<((messageId: string) => void) | undefined>(undefined)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  
  // Maintain a stable reference to the scroll function
  const scrollToMessageRef = useRef<((messageId: string) => void) | undefined>(undefined);

  // Fallback scroll function - memoized to maintain referential equality
  const fallbackScrollToMessage = useCallback((messageId: string) => {
    // Set the selected message ID to trigger highlight
    setSelectedMessageId(messageId);
    
    // Try to find and scroll to the message element
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  // Update ref when scrollToMessage changes, with minimal logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('ChatLayout: Setting scrollToMessage function:', !!scrollToMessage);
    }
    scrollToMessageRef.current = scrollToMessage;
  }, [scrollToMessage]);

  // Custom wrapper for setScrollToMessageFn with stable reference
  const setScrollToMessageFnWithLogging = useCallback((fn: ((messageId: string) => void) | undefined) => {
    scrollToMessageRef.current = fn; // Update ref
    setScrollToMessageFn(fn);
  }, []);

  // Custom wrapper for setSelectedMessageId with stable reference
  const setSelectedMessageIdWithLogging = useCallback((id: string | null) => {
    setSelectedMessageId(id);
  }, []);
  
  // Memoized scroll function to prevent re-creation on every render
  const safeScrollFunction = useCallback((messageId: string) => {
    // Check if messageId is valid
    if (!messageId) {
      return;
    }
    
    // Use the available scroll function
    if (scrollToMessage) {
      scrollToMessage(messageId);
    } else if (scrollToMessageRef.current) {
      scrollToMessageRef.current(messageId);
    } else {
      fallbackScrollToMessage(messageId);
    }
  }, [scrollToMessage, fallbackScrollToMessage]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    messages, 
    setMessages, 
    scrollToMessage: safeScrollFunction, 
    setScrollToMessageFn: setScrollToMessageFnWithLogging,
    userImageUrl,
    selectedMessageId,
    setSelectedMessageId: setSelectedMessageIdWithLogging
  }), [
    messages, 
    safeScrollFunction, 
    setScrollToMessageFnWithLogging, 
    userImageUrl,
    selectedMessageId,
    setSelectedMessageIdWithLogging
  ]);

  // Define column widths - can be adjusted independently
  const leftColumnWidth = "w-72" // Width for the ChatProgress column (increased)
  const rightColumnWidth = "w-72" // Width for the ChatsColumn (swapped)

  // Memoize ChatProgress props to prevent unnecessary re-renders
  const chatProgressProps = useMemo(() => ({
    isActiveChat: true, 
    configId, 
    messages,
    scrollToMessage: safeScrollFunction,
    userImageUrl
  }), [configId, messages, safeScrollFunction, userImageUrl]);

  // Add an effect to check for chat transitions - simplified
  useEffect(() => {
    logDebug(`Layout checking for transitions:`, { 
      urlChatId: chatId, 
      storeId: useChatProgressStore.getState().currentChatId 
    });
    
    // Check if we're at a specific chat ID and need to handle transition
    if (chatId !== 'new') {
      // Check for transition info in sessionStorage as fallback
      try {
        const transitionInfo = window.sessionStorage.getItem('chat_transition_info');
        if (transitionInfo) {
          const { from, to, timestamp } = JSON.parse(transitionInfo);
          
          // Only use recent transition info (within last 5 seconds)
          if (Date.now() - timestamp < 5000) {
            // If this is the destination of the transition, clean up
            if (to === chatId) {
              logDebug(`Completed transition from ${from} to ${chatId}`);
              window.sessionStorage.removeItem('chat_transition_info');
            }
          } else {
            // Clean up old transition info
            window.sessionStorage.removeItem('chat_transition_info');
          }
        }
      } catch (err) {
        console.error('Error handling transition info:', err);
      }
    }
  }, [chatId]);

  return (
    <ChatDataLoader configId={configId} chatId={chatId}>
      <ChatMessagesContext.Provider value={contextValue}>
        <div className="flex h-full w-full overflow-hidden bg-gray-100">
          <div className={`${leftColumnWidth} border-r bg-white border-gray-200 overflow-y-auto`}>
            <ChatProgress {...chatProgressProps} />
          </div>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
          <div className={`${rightColumnWidth} overflow-y-auto`}>
            <ChatsColumn variant="chat" configId={configId} />
          </div>
        </div>
      </ChatMessagesContext.Provider>
    </ChatDataLoader>
  )
}