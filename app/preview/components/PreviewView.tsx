"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/ChatMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useChatAgentStore } from '@/lib/stores/chatAgentStore';
import { useTemplatesStore } from '@/lib/stores/templatesStore';
import ChatProgress from '@/components/ChatProgress';
import { ChatMessagesContext } from '@/lib/contexts/ChatMessagesContext';
import { useAppStateStore } from '@/lib/stores/appStateStore';
import { useChatMessagesStore } from '@/lib/stores/chatMessagesStore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useConfigsStore } from '@/lib/stores/configsStore';
import { RoundTitleDivider } from '@/components/RoundTitleDivider';
import { uiMessageToPlainText } from '@/lib/utils/uiMessage';


export function PreviewView() {
  const params = useParams<{ templateId: string }>();
  const templateId = params?.templateId as string;
  const router = useRouter();
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState<{ success: boolean; configId?: string } | null>(null);
  const { installTemplate } = useTemplatesStore(state => state.actions);

  // Read from stores
  const chat = useAppStateStore(state => state.chat);
  const messages = useChatMessagesStore(state => state.messages || []);
  const agents = useChatAgentStore(state => state.agents || []);

  // Get config and rounds for round titles
  const config = useConfigsStore(state =>
    chat?.configId ? state.configs.find(c => c.id === chat.configId) : null
  );
  const rounds = config?.rounds || [];

  // ChatProgress and message selection logic (unchanged)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  useEffect(() => {
    if (agents.length > 0) setAgentsLoaded(true);
  }, [agents]);

  const scrollToMessage = useCallback((messageId: string) => {
    setSelectedMessageId(messageId);
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  // Scroll-to-highlight logic adapted from ShareView
  const updateSelectedMessageOnScroll = useMemo(() => {
    return (containerElement: HTMLDivElement | null) => {
      console.log('[PreviewView] updateSelectedMessageOnScroll called');
      
      if (!containerElement) {
        console.log('[PreviewView] Message container not found');
        return;
      }
      
      const viewport = containerElement.closest('[data-radix-scroll-area-viewport]');
      
      if (!viewport) {
        console.log('[PreviewView] Viewport not found using container.closest()');
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const viewportTop = viewportRect.top;
      const viewportHeight = viewportRect.height;
      const viewportBottom = viewportTop + viewportHeight;
      console.log('[PreviewView] Viewport rect:', { top: viewportTop, height: viewportHeight, bottom: viewportBottom });

      const messageElements = containerElement.querySelectorAll('[data-message-id]');
      if (messageElements.length === 0) {
        console.log('[PreviewView] No message elements found within container');
        return;
      }
      console.log(`[PreviewView] Found ${messageElements.length} message elements`);

      // Log details for the first message
      if (messageElements[0]) {
        const firstMessageRect = messageElements[0].getBoundingClientRect();
        const firstMessageVisible = firstMessageRect.bottom >= viewportTop && firstMessageRect.top <= viewportBottom;
        console.log('[PreviewView] First message rect:', firstMessageRect, `Is Visible: ${firstMessageVisible}`);
      }

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

      console.log('[PreviewView] Message visibility checks done:', { upperHalfTopMessages, upperHalfVisibleMessages, visibleMessages });

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

      console.log('[PreviewView] bestMessageId determined:', bestMessageId);

      if (bestMessageId && bestMessageId !== selectedMessageId) {
        console.log(`[PreviewView] setSelectedMessageId called with: ${bestMessageId} (previously ${selectedMessageId})`);
        setSelectedMessageId(bestMessageId);
      } else if (bestMessageId) {
        console.log(`[PreviewView] bestMessageId is ${bestMessageId}, same as selectedMessageId.`);
      } else {
        console.log('[PreviewView] No bestMessageId found.');
      }
    };
  }, [selectedMessageId]);

  // Effect to handle scroll events for highlighting
  useEffect(() => {
    console.log('[PreviewView] Scroll listener effect attaching (messages count:', messages.length, ')');
    const container = messagesContainerRef.current;
    const scrollableViewport = container ? (container.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null) : null;

    if (scrollableViewport && container) {
      console.log('[PreviewView] Viewport and message container found for scroll listener, attaching now.');
      
      const handleScroll = () => {
        // console.log('[PreviewView] Scroll event detected');
        updateSelectedMessageOnScroll(container);
      };

      scrollableViewport.addEventListener('scroll', handleScroll);
      
      // Initial check, delayed to allow DOM to update
      const timerId = setTimeout(() => {
        console.log('[PreviewView] Performing initial scroll check after timeout.');
        updateSelectedMessageOnScroll(container);
      }, 0);

      return () => {
        console.log('[PreviewView] Cleaning up scroll listener.');
        clearTimeout(timerId);
        scrollableViewport.removeEventListener('scroll', handleScroll);
      };
    } else {
      console.log('[PreviewView] Viewport or message container NOT found for scroll listener.', { viewport: !!scrollableViewport, container: !!container });
    }
  }, [messages, agentsLoaded, updateSelectedMessageOnScroll]);

  // Handler for installing the template
  const handleInstallTemplate = async () => {
    if (!templateId) return;
    setIsInstalling(true);
    setInstallSuccess(null);
    const result = await installTemplate(templateId);
    setIsInstalling(false);
    setInstallSuccess(result);
  };

  const handleEditConfig = () => {
    if (installSuccess?.configId) {
      router.push(`/config/${installSuccess.configId}/edit`);
    }
  };

  const handleCloseModal = () => {
    setInstallSuccess(null);
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
              <div className="max-w-3xl mx-auto space-y-4" ref={messagesContainerRef}>
                {!agentsLoaded ? (
                  <div className="flex justify-center items-center h-32 text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <p>Loading conversation...</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const authorId = (message as any).authorId || 'unknown';

                    // Check if we should show round titles and if this message starts a new round
                    const showRoundTitles = (config as any)?.designSettings?.showRoundTitles;
                    if (index === 0) {
                      console.log('[PreviewView] config:', config);
                      console.log('[PreviewView] designSettings:', (config as any)?.designSettings);
                      console.log('[PreviewView] showRoundTitles:', showRoundTitles);
                      console.log('[PreviewView] First message:', message);
                      console.log('[PreviewView] First message metadata:', message.metadata);
                    }
                    const currentSessionId = message.metadata?.sessionId;
                    const previousSessionId = index > 0 ? messages[index - 1].metadata?.sessionId : null;
                    const isNewRound = showRoundTitles && currentSessionId && currentSessionId !== previousSessionId;

                    // Find the round information for this session
                    let roundTitle = null;
                    let roundData = null;
                    if (isNewRound && currentSessionId) {
                      const roundId = message.metadata?.roundId;
                      if (roundId) {
                        const round = rounds.find(r => r.id === roundId);
                        if (round?.name) {
                          roundTitle = round.name;
                          roundData = round;
                        }
                      }
                    }

                    return (
                      <div key={message.id}>
                        {/* Render round title if this is the start of a new round */}
                        {isNewRound && roundTitle && (
                          <RoundTitleDivider roundTitle={roundTitle} roundData={roundData ?? undefined} />
                        )}

                        <div
                          data-message-id={message.id}
                          data-message-role={message.role}
                          data-message-author-id={authorId}
                        >
                          <ChatMessage
                            message={message}
                            content={uiMessageToPlainText(message as any)}
                            role={message.role}
                            userImageUrl="gradient"
                            configId={chat?.configId || ''}
                            mode="preview"
                            previousMessage={index > 0 ? messages[index - 1] : undefined}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
          {/* Right sidebar - Content adjusted for "Preview" context */}
          <div className="w-64 border-l bg-white p-4 flex flex-col">
            <div>
              <h3 className="font-medium mb-2">Template Preview</h3>
              <p className="text-sm text-gray-600 mb-4">This is a preview of a chat template.</p>
              <SignedIn>
                <Button className="w-full bg-black text-white hover:bg-gray-800 mb-6" onClick={handleInstallTemplate} disabled={isInstalling}>
                  {isInstalling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {isInstalling ? "Installing..." : "Install Template"}
                </Button>
              </SignedIn>
              <SignedOut>
                <Link href="/sign-in">
                  <Button className="w-full bg-black text-white hover:bg-gray-800 mb-6">Log in to use this template</Button>
                </Link>
              </SignedOut>
            </div>
            <div className="flex-1"></div>
          </div>
        </div>
      </div>
      {/* Installation Modal */}
      <Dialog open={isInstalling || installSuccess !== null} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setIsInstalling(false);
          setInstallSuccess(null);
        }
      }}>
        <DialogContent>
          {isInstalling ? (
            <>
              <DialogHeader>
                <DialogTitle>Installing Template</DialogTitle>
                <DialogDescription>Please wait while we set up your new chat design...</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            </>
          ) : installSuccess?.success ? (
            <>
              <DialogHeader>
                <DialogTitle>Template Installed Successfully</DialogTitle>
                <DialogDescription>Your new chat design is ready to use.</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={handleCloseModal}>Continue Previewing</Button>
                <Button onClick={handleEditConfig}>Edit Chat Design</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Installation Failed</DialogTitle>
                <DialogDescription>There was an error installing the template. Please try again.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleCloseModal}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ChatMessagesContext.Provider>
  );
} 