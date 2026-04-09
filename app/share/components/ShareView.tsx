"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { ChatMessage } from "@/components/ChatMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import ChatProgress from '@/components/ChatProgress';
import { ChatMessagesContext } from '@/lib/contexts/ChatMessagesContext';
import { useAppStateStore } from '@/lib/stores/appStateStore';
import { useChatMessagesStore } from '@/lib/stores/chatMessagesStore';
import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";


export function ShareView() {
  const params = useParams<{ shareId: string }>();
  const shareId = params?.shareId as string;
  const router = useRouter();
  const { toast } = useToast();
  const { isSignedIn } = useAuth();
  const [isCopying, setIsCopying] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Read from stores
  const chat = useAppStateStore(state => state.chat);
  const messages = useChatMessagesStore(state => state.messages || []);

  const scrollToMessage = useCallback((messageId: string) => {
    setSelectedMessageId(messageId);
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  // Scroll-to-highlight logic
  const updateSelectedMessageOnScroll = useMemo(() => {
    return (containerElement: HTMLDivElement | null) => {
      if (!containerElement) return;
      
      const viewport = containerElement.closest('[data-radix-scroll-area-viewport]');
      if (!viewport) return;

      const viewportRect = viewport.getBoundingClientRect();
      const viewportTop = viewportRect.top;
      const viewportHeight = viewportRect.height;
      const viewportBottom = viewportTop + viewportHeight;

      const messageElements = containerElement.querySelectorAll('[data-message-id]');
      if (messageElements.length === 0) return;

      let bestMessageId = null;
      interface PositionedMessage {
        id: string;
        top: number;
      }

      const upperHalfTopMessages: PositionedMessage[] = [];
      const upperHalfVisibleMessages: PositionedMessage[] = [];
      const visibleMessages: PositionedMessage[] = [];
      const upperHalfBottom = viewportTop + viewportHeight / 2;

      messageElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const messageId = element.getAttribute('data-message-id');
        if (!messageId) return;

        const isVisible = rect.bottom >= viewportTop && rect.top <= viewportBottom;
        if (!isVisible) return;

        visibleMessages.push({ id: messageId, top: rect.top });

        const topInUpperHalf = rect.top >= viewportTop && rect.top <= upperHalfBottom;
        if (topInUpperHalf) {
          upperHalfTopMessages.push({ id: messageId, top: rect.top });
        }

        const visibleInUpperHalf = rect.top <= upperHalfBottom && rect.bottom >= viewportTop;
        if (visibleInUpperHalf) {
          upperHalfVisibleMessages.push({ id: messageId, top: rect.top });
        }
      });

      if (upperHalfTopMessages.length > 0) {
        upperHalfTopMessages.sort((a, b) => a.top - b.top);
        bestMessageId = upperHalfTopMessages[0].id;
      } else if (upperHalfVisibleMessages.length > 0) {
        upperHalfVisibleMessages.sort((a, b) => a.top - b.top);
        bestMessageId = upperHalfVisibleMessages[0].id;
      } else if (visibleMessages.length > 0) {
        visibleMessages.sort((a, b) => a.top - b.top);
        bestMessageId = visibleMessages[0].id;
      }

      if (bestMessageId && bestMessageId !== selectedMessageId) {
        setSelectedMessageId(bestMessageId);
      }
    };
  }, [selectedMessageId]);

  // Effect to handle scroll events for highlighting
  useEffect(() => {
    const container = messagesContainerRef.current;
    const scrollableViewport = container ? (container.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null) : null;

    if (scrollableViewport && container) {
      const handleScroll = () => {
        updateSelectedMessageOnScroll(container);
      };

      scrollableViewport.addEventListener('scroll', handleScroll);
      
      // Initial check
      const timerId = setTimeout(() => {
        updateSelectedMessageOnScroll(container);
      }, 0);

      return () => {
        clearTimeout(timerId);
        scrollableViewport.removeEventListener('scroll', handleScroll);
      };
    }
  }, [messages, updateSelectedMessageOnScroll]);

  const handleCopyChat = async () => {
    if (!isSignedIn) {
      toast({
        title: "Sign in required",
        description: "Please sign in to copy this chat",
        variant: "destructive"
      });
      return;
    }

    setIsCopying(true);
    try {
      const response = await fetch(`/api/shares/${shareId}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to copy chat');
      }

      const data = await response.json();
      toast({
        title: "Chat copied",
        description: "You can now access this chat in your account",
      });
      router.push(`/chat/${data.chatId}`);
    } catch (error) {
      console.error('Error copying chat:', error);
      toast({
        title: "Error copying chat",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsCopying(false);
    }
  };

  const contextValue = useMemo(() => ({
    messages,
    setMessages: () => {},
    scrollToMessage,
    setScrollToMessageFn: () => {},
    userImageUrl: "gradient",
    selectedMessageId,
    setSelectedMessageId
  }), [messages, scrollToMessage, selectedMessageId]);

  return (
    <ChatMessagesContext.Provider value={contextValue}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-gray-100">
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 overflow-y-auto bg-white border-r border-gray-200">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold truncate">Chat Messages</h2>
            </div>
            <ChatProgress
              isActiveChat={true}
              messages={messages}
              configId={chat?.configId}
              scrollToMessage={scrollToMessage}
              userImageUrl="gradient"
              hideTitle={true}
            />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-6" ref={messagesContainerRef}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    data-message-role={message.role}
                  >
                    <ChatMessage
                      message={message}
                      content={typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                      role={message.role}
                      configId={chat?.configId || ''}
                      userImageUrl="gradient"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          {/* Right sidebar - Content adjusted for "Share" context */}
          <div className="w-64 border-l bg-white p-4 flex flex-col">
            <div>
              <h3 className="font-medium mb-2">Shared Chat</h3>
              <p className="text-sm text-gray-600 mb-4">This is a shared chat conversation.</p>
              <SignedIn>
                <Button className="w-full bg-black text-white hover:bg-gray-800 mb-6" onClick={handleCopyChat} disabled={isCopying}>
                  {isCopying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {isCopying ? "Copying..." : "Copy to my account"}
                </Button>
              </SignedIn>
              <SignedOut>
                <Link href="/sign-in">
                  <Button className="w-full bg-black text-white hover:bg-gray-800 mb-6">Log in to copy this chat</Button>
                </Link>
              </SignedOut>
            </div>
            <div className="flex-1"></div>
          </div>
        </div>
      </div>
    </ChatMessagesContext.Provider>
  );
} 