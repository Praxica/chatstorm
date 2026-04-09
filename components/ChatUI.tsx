'use client';

import { useRef, useState, useEffect, useMemo } from "react"
import { useChat } from '@ai-sdk/react';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ArrowUp, Square, Repeat, ArrowRight, ExternalLink } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { ChatMessage } from "./ChatMessage";
import { useChatProgressStore } from '@/lib/stores/chatProgressStore';
import { CHAT_USER_CONTINUE } from '@/lib/constants';
import { Message } from '@/types/message';
import { useUser } from '@clerk/nextjs';
import { filterDisplayMessages } from '@/lib/utils/messages';
import { useChatMessages } from '@/lib/contexts/ChatMessagesContext';
import { ChatProgress } from '@/lib/types/chat-progress';
import { useConfigsStore } from '@/lib/stores/configsStore';
import { useChatAgentStore } from '@/lib/stores/chatAgentStore';
import { ConfigUtils } from '@/lib/services/ConfigService';
import { logError } from '@/lib/utils/error';
import { RoundTitleDivider } from '@/components/RoundTitleDivider';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { getData as getUIData } from '@/lib/chat/services/ui-message';
import { isOverloadedError } from '@/lib/utils/user-models';
import ChatErrorHandler from './ChatErrorHandler';
import { PreviewBanner } from './preview/PreviewBanner';
import { ConfirmModal } from '@/components/ui/confirm-modal';

// Helper for creating consistent chat payloads
const createChatPayload = (activeChatId: string, progress: any, mode?: string, extraProps?: object) => ({
  progress,
  chatId: activeChatId,
  ...(mode && { mode }),
  ...(extraProps && extraProps)
  // Note: 'trigger' field is automatically added by useChat hook
  // sendMessage() → trigger: "submit-message"  
  // regenerate() → trigger: "regenerate-message"
});

// Handle retry for error scenarios  
const handleRetry = (setIsStreaming: any, regenerate: any, activeChatId: string, getProgress: any, mode: string) => {
  // Restart streaming for the retry
  console.log('[ChatUI] Restarting streaming for retry');
  setIsStreaming(true);
  
  // regenerate() automatically handles regenerating the last assistant message
  regenerate({
    body: createChatPayload(activeChatId, getProgress(), mode)
  });
};

// Helper functions for session storage state persistence
const saveStreamingState = (chatId: string, isStreaming: boolean) => {
  try {
    if (typeof window !== 'undefined') {
      const key = `streaming_${chatId}`;
      if (isStreaming) {
        window.sessionStorage.setItem(key, 'true');
      } else {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error('Error saving streaming state to sessionStorage:', e);
  }
};

const getStreamingState = (chatId: string): boolean => {
  try {
    if (typeof window !== 'undefined') {
      const key = `streaming_${chatId}`;
      const value = window.sessionStorage.getItem(key);
      return value === 'true';
    }
  } catch (e) {
    console.error('Error reading streaming state from sessionStorage:', e);
  }
  return false;
};

const clearStreamingState = (chatId: string) => {
  try {
    if (typeof window !== 'undefined') {
      const key = `streaming_${chatId}`;
      window.sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.error('Error clearing streaming state from sessionStorage:', e);
  }
};

interface ChatUIProps {
  configId: string;
  chatId: string;
  mode?: 'preview' | 'user';
  onMessagesUpdate?: (messages: Message[]) => void;
  setScrollToMessageFn?: (fn: ((messageId: string) => void) | undefined) => void;
}

// Helper function to check if the error is a token limit error
const isTokenLimitError = (error: Error | string | null | undefined): boolean => {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' ? error : (error?.message || '');
  
  // First check for 402 status code in the message
  if (errorMessage.includes('402')) {
    return true;
  }
  
  // Check for 402 in the stack trace if it's an Error object
  if (error instanceof Error && error.stack && error.stack.includes('status code 402')) {
    return true;
  }
  
  // Try parsing the error message for specific token limit message
  try {
    const errorData = JSON.parse(errorMessage || '{}');
    return errorData?.error === "Token limit exceeded";
  } catch (_e) {
    // If parsing fails, we've already checked the raw string above
    return false;
  }
};

export default function ChatUI({ 
  configId, 
  chatId = 'preview', 
  mode = 'user',
  onMessagesUpdate,
  setScrollToMessageFn
}: ChatUIProps) {
  const [activeChatId] = useState(chatId);
  const inputValueRef = useRef('');
  const isStreamingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialLoadFiredRef = useRef<string | null>(null);
  const replayRegenerating = useRef(false);
  
  // Get config data from the store
  const activeConfig = useConfigsStore(state => state.activeConfig);
  const configs = useConfigsStore(state => state.configs);
  const getRounds = useConfigsStore(state => state.getRounds);
  
  // Get agent store for dynamic agent updates
  const { agents, setAgents } = useChatAgentStore();
  
  // Get the config for this chat
  const config = activeConfig?.id === configId 
    ? activeConfig 
    : configs.find(c => c.id === configId);
    
  // Get rounds for this config
  const rounds = getRounds(configId);
    
  // Get chatInstructions and examplePrompts from the config using utility functions
  const chatInstructions = ConfigUtils.getChatInstructions(config);
  const examplePrompts = ConfigUtils.getExamplePrompts(config);
  
  const { setProgress, getProgress, initChat, getNextRound, getCurrentRoundId, clearChat, updateActiveRoundId, updateMessageCount } = useChatProgressStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingAgents, setIsGeneratingAgents] = useState(false);
  const [replayingMessage, setReplayingMessage] = useState<{message: UIMessage, index: number} | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  
  // Simple function to update ChatProgress store with new round
  const updateChatProgressRound = (roundId: string) => {
    // Update the active round ID tracking variable
    updateActiveRoundId(roundId);
  };

  const [input, setInput] = useState('');
  const [latestData, setLatestData] = useState<any>();

  // Sync isStreaming state with ref and session storage
  useEffect(() => {
    isStreamingRef.current = isStreaming;
    
    // When streaming ends, clear the session storage flag
    if (!isStreaming && activeChatId !== 'new') {
      clearStreamingState(activeChatId);
    } else if (isStreaming && activeChatId !== 'new') {
      // When streaming starts, save to session storage
      saveStreamingState(activeChatId, true);
    }
  }, [isStreaming, activeChatId]);

  const { messages, setMessages, sendMessage, status, stop, error, regenerate } =
    useChat({
      transport: new DefaultChatTransport({ api: '/api/configs/' + configId + '/chats' }) as any,
      onFinish: (ev: any) => {
        try {
          const msg = ev?.message ?? ev;

          // If the assistant message has a userMessageId in metadata, update the user message with it
          if (msg?.metadata?.userMessageId && msg?.role === 'assistant') {
            setMessages((prevMessages) => {
              // Find THIS assistant message's index first
              const assistantIndex = prevMessages.findIndex(m => m.id === msg.id);
              if (assistantIndex === -1) {
                return prevMessages;
              }

              // Find the user message that directly precedes this assistant message
              let targetUserMessageIndex = -1;
              for (let i = assistantIndex - 1; i >= 0; i--) {
                if (prevMessages[i].role === 'user') {
                  targetUserMessageIndex = i;
                  break;
                }
              }

              if (targetUserMessageIndex === -1) {
                return prevMessages; // No user message to update
              }

              // Update only that specific user message
              return prevMessages.map((m, index) => {
                if (index === targetUserMessageIndex) {
                  return {
                    ...m,
                    metadata: {
                      ...(m.metadata as Record<string, unknown>),
                      messageId: msg.metadata.userMessageId
                    }
                  };
                }
                return m;
              });
            });
          }
        } catch {}
      },
      onError: (err) => {
        console.log('[ChatUI] onError called:', err);
        logError('ChatUI stream error', err);
        // Stop streaming on any error - retry handler will restart it if needed
        console.log('[ChatUI] Error occurred - stopping streaming');
        setIsStreaming(false);
      },
      onData: (part: any) => {
        try {
          if (typeof part?.type === 'string' && part.type.startsWith('data-')) {
            const val = part?.data;
            if (val) setLatestData(val);
          }
        } catch {}
      },
      id: activeChatId !== 'new' ? activeChatId : undefined
    });
  const isLoading = status === 'submitted' || status === 'streaming';

  // Removed legacy mappers; use native v5 UI messages end-to-end
  
  // Keep input value in ref for state persistence
  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const { user } = useUser();

  const { setSelectedMessageId } = useChatMessages();

  // Initialize chat progress when component mounts
  useEffect(() => {
    if (!activeChatId || typeof activeChatId !== 'string') return;
    
    if (activeChatId === 'new') {
      // Removed setIsNewChat(true) as it's handled by redirect now
      clearChat();
      return;
    }

    if (initialLoadFiredRef.current === activeChatId) {
      return;
    }

    initChat(activeChatId);

    loadChatMessages(activeChatId).then(chat => {
      // Map existing DB messages to UIMessage[] with parts preserved
      const uiMessages = chat.messages.map((msg: any) => {
        // Parts are now directly on the message (flattened structure)
        const parts = msg.parts || [];
        const metadata = msg.metadata || {};

        // Ensure messageId is set in metadata for all messages (for replay functionality)
        if (!metadata.messageId) {
          metadata.messageId = msg.id; // Use database UUID
        }

        const uiMsg: UIMessage = {
          id: msg.id,
          role: msg.role,
          parts,
          metadata
        } as UIMessage;
        return uiMsg;
      });

      setMessages(uiMessages);

      // Restore dynamic agents if any were created during this chat
      if (chat.dynamicAgents && chat.dynamicAgents.length > 0) {
        const existingAgentIds = agents.map((a: any) => a.id);
        const newDynamicAgents = chat.dynamicAgents.filter((agent: any) => !existingAgentIds.includes(agent.id));
        if (newDynamicAgents.length > 0) {
          setAgents([...agents, ...newDynamicAgents]);
        }
      }

      // Check if this is a new chat with first message in GENERATE round
      if (uiMessages.length === 1 && uiMessages[0].role === 'user' && rounds.length > 0) {
        const firstRound = rounds[0];
        if (firstRound.participantMode === 'GENERATE') {
          setIsGeneratingAgents(true);
        }
      }

      // Initialize progress based on message state
      if (uiMessages.length > 0) {
        // get progress from the last message (prefer data-progress part over legacy metadata)
        const lastUiMessage = uiMessages[uiMessages.length - 1] as any;
        const metadata = lastUiMessage?.metadata;
        const progressData = getUIData(lastUiMessage, 'progress') || metadata?.progress;
        if (progressData) {
          const roundIdForProgress = progressData?.active?.round?.id || metadata?.roundId || getCurrentRoundId();
          if (roundIdForProgress) {
            setProgress(roundIdForProgress, progressData);
          } else {
            console.warn('Cannot set progress - unable to determine round ID');
          }
        }
      } else if (rounds.length > 0) {
        // No messages yet - initialize progress with first round
        const firstRound = rounds[0];
        // Create initial progress for the first round
        const initialProgress = {
          messageCount: 0,
          messageAuthors: [],
          active: {
            step: 'user' as const,
            agent: { id: '', mode: 'participant' as const },
            round: { id: firstRound.id, isComplete: false }
          },
          next: {
            step: 'api' as const,
            round: { id: firstRound.id }
          }
        };
        setProgress(firstRound.id, initialProgress);
      }

      // reload the chat if this was a new chat with one user message
      const needsResponse = uiMessages.length === 1 && 
                             uiMessages[0].role === 'user';

      if (needsResponse) {
        setIsStreaming(true);
        // Use sendMessage for initial response, not regenerate
        sendMessage(
          { text: CHAT_USER_CONTINUE },
          {
            body: createChatPayload(activeChatId, getProgress(), mode)
          }
        );
      } else {
        // If no response needed, clear the global loading state set during chat creation
        useChatProgressStore.getState().setGlobalLoading(false);
      }
    }).catch(error => {
      logError('Failed to load chat messages', error);
      useChatProgressStore.getState().setGlobalLoading(false);
    });

    initialLoadFiredRef.current = activeChatId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, mode, rounds]);

  // Handle the data stream to continue the debate with the next step
  useEffect(() => {
    const data: any = latestData;
    if (!data) return;

    console.log('[ChatUI] Processing data stream:', {
      dataType: typeof data,
      isObject: typeof data === 'object',
      keys: typeof data === 'object' ? Object.keys(data) : [],
      isStreaming,
      activeChatId
    });

    // Check for streaming state in session storage first for newly remounted components
    console.log('[ChatUI] Streaming state check:', {
      isStreaming,
      activeChatId,
      sessionStorageState: activeChatId !== 'new' ? getStreamingState(activeChatId) : null,
      isStreamingRefCurrent: isStreamingRef.current
    });

    if (!isStreaming && activeChatId !== 'new' && getStreamingState(activeChatId)) {
      console.log('[ChatUI] Setting streaming=true from session storage');
      setIsStreaming(true);
    } else if (!isStreaming && isStreamingRef.current) {
      console.log('[ChatUI] Setting streaming=true from ref');
      setIsStreaming(true);
    } else if (!isStreaming) {
      console.log('[ChatUI] Not streaming and no override - returning early');
      return;
    }

    // Handle agent update streams - check for data-agents type
    if (data && typeof data === 'object') {
      // Check if this is a data-agents stream part
      if (data.agents && Array.isArray(data.agents)) {
        console.log('[ChatUI] Received dynamic agents:', data.agents.length);
        
        // Hide loading UI when agents are ready
        setIsGeneratingAgents(false);
        
        // Combine existing agents with new dynamic agents, avoiding duplicates
        const existingAgentIds = agents.map((a: any) => a.id);
        const newAgents = data.agents.filter((agent: any) => !existingAgentIds.includes(agent.id));
        if (newAgents.length > 0) {
          setAgents([...agents, ...newAgents]);
        }
      }
    }

    const progress = (Array.isArray(data) ? data.at(-1) : data) as unknown as ChatProgress;

    if (!progress || !progress.next) {
      setLatestData(undefined as any);
      return;
    }

    // Ensure we have an active round ID from the progress data
    const activeRoundId = progress.active?.round?.id;
    if (activeRoundId) {
      setProgress(activeRoundId, progress);
    } else {
      console.warn('[ChatUI] Progress data received without active round ID, cannot set progress');
    }

    // Check if the next step requires API action
    if (progress.next && progress.next.step === 'api') {
      console.log('[ChatUI] Processing next step=api:', {
        nextAgentId: progress.next.agent?.id,
        nextRoundId: progress.next.round?.id,
        activeRoundId: progress.active?.round?.id,
        messageCount: messages.length,
        replayRegenerating: replayRegenerating.current
      });

      // Don't auto-send if replay is handling regeneration manually
      if (replayRegenerating.current) {
        return;
      }

      // Update ChatProgress store for automatic transitions
      const nextRoundId = progress.next.round?.id;
      if (nextRoundId) {
        updateChatProgressRound(nextRoundId);
      }

      // Send continuation message for automatic transitions to next round/agent
      console.log('[ChatUI] Sending continuation message...');
      sendMessage(
        { text: CHAT_USER_CONTINUE },
        {
          body: createChatPayload(activeChatId, getProgress(), mode)
        }
      );
    }

    // If next step is user, stop streaming
    if (progress.next && progress.next.step === 'user') {
      console.log('[ChatUI] Stopping streaming - next step is user');
      setIsStreaming(false);
      clearStreamingState(activeChatId);
    }

    // clear data
    setLatestData(undefined as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestData, activeChatId, messages.length]);

  // Handle scrolling behavior
  useEffect(() => {
    const scrollArea = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollArea && autoScroll) {
      const scrollBottom = scrollArea.scrollHeight - scrollArea.clientHeight;
      scrollArea.scrollTop = scrollBottom;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Set up scroll listener
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const distanceFromBottom = 
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const isAtBottom = distanceFromBottom <= 1;
      if (isAtBottom !== autoScroll) {
        setAutoScroll(isAtBottom);
      }
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [autoScroll]);

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion as any);
    inputRef.current?.focus();
  };

  // Shared utility to check if we should show loading UI for a round
  const checkAndShowLoadingForRound = (roundId: string, source: string) => {
    const round = rounds.find(r => r.id === roundId);
    
    if (round?.participantMode === 'GENERATE') {
      console.log(`[CHATUI-GENERATE] ${source} - GENERATE round detected - showing loading UI`);
      setIsGeneratingAgents(true);
    }
  };

  const handleNextRound = (nextRoundId: string) => {
    // Check if we should show loading UI for this round
    checkAndShowLoadingForRound(nextRoundId, 'handleNextRound');
    
    setIsStreaming(true);
    
    // Update ChatProgress store with expected round
    updateChatProgressRound(nextRoundId);

    // Only update the next round information for the server
    // We don't update the full progress state here - the server will determine that
    const progress = getProgress();
    const updatedProgress = {
      ...progress,
      next: {
        ...progress.next,
        round: {
          id: nextRoundId
        }
      }
    };
    
    // Only update the server-bound progress payload, not the store
    sendMessage(
      { text: CHAT_USER_CONTINUE },
      {
        body: createChatPayload(activeChatId, updatedProgress, mode)
      }
    );
  };

  const handleChatProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming || !input.trim()) return;

    const nextRound = getNextRound(configId);
    if (!nextRound) {
      console.error('No next round available');
      return;
    }

    // Check if we should show loading UI for this round
    checkAndShowLoadingForRound(nextRound.id, 'handleChatProceed');

    // Update ChatProgress store with expected round
    updateChatProgressRound(nextRound.id);

    // Only update the next round information for the server
    // We don't update the full progress state here - the server will determine that
    const progress = getProgress();
    const updatedProgress = {
      ...progress,
      next: {
        ...progress.next,
        round: {
          id: nextRound.id
        }
      }
    };

    setIsStreaming(true);

    sendMessage(
      { text: input },
      {
        body: createChatPayload(activeChatId, updatedProgress, mode, {
          temporarySessionId: `new-session-${nextRound.id}`
        })
      }
    );

    // Clear the input after sending
    setInput('');
  };

  const handleChatReplay = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming || !input.trim()) return;

    // Only update the next round information for the server
    // We don't update the full progress state here - the server will determine that
    const progress = getProgress();

    // Update the store with the active round ID before submitting
    updateChatProgressRound(progress.active.round.id);

    const updatedProgress = {
      ...progress,
      next: {
        ...progress.next,
        round: {
          id: progress.active.round.id
        }
      }
    };
    
    setIsStreaming(true);
    
    sendMessage(
      { text: CHAT_USER_CONTINUE },
      {
        body: createChatPayload(activeChatId, updatedProgress, mode, {
          isReplay: true // Flag to indicate this is a replay, not a new round
        })
      }
    );
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming || !input.trim()) return;

    const currentChatId = activeChatId; // needed because activeChatId is only updated on re-render
    // submitting chat message

    // check if we have to create a new chat
    if (mode === 'user' && activeChatId === 'new') {
      createNewChat(input);
      return;
    }

    try {
      // Check if this is the first message in a GENERATE round
      
      if (messages.length === 0 && rounds.length > 0) {
        const firstRound = rounds[0];
        if (firstRound.participantMode === 'GENERATE') {
          setIsGeneratingAgents(true);
        }
      }

      // For existing chats, just set streaming state
      setIsStreaming(true);
      saveStreamingState(activeChatId, true);

      const progress = getProgress();

      sendMessage(
        { text: input },
        {
          body: createChatPayload(currentChatId, progress, mode)
        }
      );

      // Clear the input after sending
      setInput('');
    } catch (error) {
      logError('Chat submission failed', error);
      // Reset isNewChat if there was an error creating the chat
      if (activeChatId === 'new') {
        clearStreamingState(activeChatId);
        // Clear global loading state on error
        useChatProgressStore.getState().setGlobalLoading(false);
      }
    }
  }; 
  
  // Add this function to handle new chat creation
  const createNewChat = async (message: string) => {

    useChatProgressStore.getState().setGlobalLoading(true);

    // Create new chat with the first message as the name
    const chatName = message.length > 30 ? message.substring(0, 30) + '...' : message;
    
    try {
      const response = await fetch(`/api/chats/${configId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id,
          configId: configId as string,
          title: chatName,
          initialMessage: input // Send initial message with chat creation
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create chat');
      }
      
      const chat = await response.json();
      // Add chat to Zustand store immediately
      /*
      addChat({
        id: chat.id,
        configId: configId as string,
        title: chat.title,
        createdAt: new Date(chat.createdAt)
      });
      */
      
      // Perform hard navigation (full page reload)
      window.location.href = `/chats/${configId}/chat/${chat.id}`;
    } catch (error) {
      logError('Failed to create chat', error);
      // Handle error display to user (e.g., using a toast notification)
      // setError(error); // You might need a local state for this
      useChatProgressStore.getState().setGlobalLoading(false);
    }
  };

  // Handle replay from a specific message - show confirmation modal
  const handleReplay = async (messageId: string) => {

    // Find target message in local state for confirmation
    // messageId is now the database UUID (from metadata.messageId)
    const targetIndex = messages.findIndex(m =>
      ((m.metadata as Record<string, unknown>)?.messageId || m.id) === messageId
    );
    if (targetIndex === -1) {
      return;
    }

    const targetMessage = messages[targetIndex];
    setReplayingMessage({ message: targetMessage, index: targetIndex });
  };

  // Actually perform the replay after confirmation
  const confirmReplay = async () => {
    if (!replayingMessage) return;

    const { message: targetMessage } = replayingMessage;
    setIsReplaying(true);

    try {
      // FIRST: Stop any in-progress streaming to prevent race conditions
      if (isStreaming) {
        stop();
        setIsStreaming(false);
        // Wait a moment for streaming to fully stop
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Call server-side replay API to handle deletion and progress determination
      // Use the database messageId from metadata (streamed at start)
      // Fallback to SDK messageId for backward compatibility
      const dbMessageId = (targetMessage.metadata as Record<string, unknown>)?.messageId || targetMessage.id;


      const response = await fetch(`/api/chats/${configId}/chat/${chatId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: dbMessageId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Replay request failed');
      }

      const { deletedMessageIds, progress, shouldRegenerate, userInput, dynamicAgents } = await response.json();


      // Update local state - remove deleted messages
      const remainingMessages = messages.filter(m => {
        const dbMessageId = (m.metadata as Record<string, unknown>)?.messageId || m.id;
        return !deletedMessageIds.includes(dbMessageId);
      });

      // Restore dynamic agents if any were created during this chat
      if (dynamicAgents && dynamicAgents.length > 0) {
        const existingAgentIds = agents.map((a: any) => a.id);
        const newDynamicAgents = dynamicAgents.filter((agent: any) => !existingAgentIds.includes(agent.id));
        if (newDynamicAgents.length > 0) {
          setAgents([...agents, ...newDynamicAgents]);
        }
      }

      // Restore progress from server response
      if (progress) {
        const roundId = progress.active?.round?.id;
        if (roundId) {
          setProgress(roundId, progress);
        }
      }

      // Update messages state and wait for it to settle before regenerating
      setMessages(remainingMessages);

      // Handle based on message type
      if (shouldRegenerate) {
        // Wait for state to update before sending
        await new Promise(resolve => setTimeout(resolve, 50));

        replayRegenerating.current = true;

        // Assistant message: automatically regenerate using existing message history
        const payload = createChatPayload(activeChatId, progress, mode, {
          isReplay: true // Flag to indicate this is a replay regeneration
        });
        setIsStreaming(true);

        // Use regenerate() to resend existing messages without adding a duplicate user message
        regenerate({
          body: payload
        });

        // Reset the guard after a delay to allow the message to be sent
        setTimeout(() => {
          replayRegenerating.current = false;
        }, 1000);
      } else {
        // User message: populate input, focus, and select all
        setInput(userInput || '');
        // Wait for input to be updated before selecting
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);
      }


      // Close modal on success
      setReplayingMessage(null);
      setIsReplaying(false);
    } catch (error) {
      logError('Replay failed', error);
      setIsReplaying(false);
      // Keep modal open on error so user can see the error and try again
    }
  };

  // Handle copying a live chat to preview
  const handleCopyToPreview = async (sourceChatId: string) => {
    try {
      const response = await fetch(`/api/configs/${configId}/copy-to-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceChatId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to copy chat');
      }

      // Reload the page to show the copied messages
      window.location.reload();
    } catch (error) {
      console.error('[ChatUI] Failed to copy to preview:', error);
      logError('Failed to load chat into preview', error);
      alert('Failed to load chat. Please try again.');
    }
  };

  const getButtonControls = () => {
    if (isStreaming) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={(e) => {
                e.preventDefault();
                stop();
                setIsStreaming(false);
              }}>
                <Square className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Stop chat responses
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // If no messages or only one round, show default send button
    if (messages.length === 0 || rounds.length <= 1) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleChatSubmit}>
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Send message
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }


    // Get next round name for proceed button
    const nextRound = getNextRound(configId);
    const nextRoundLabel = (() => {
      // Check if next round has unique name (not equal to type)
      if (nextRound?.name && nextRound.name !== nextRound.type) {
        return `Proceed to ${nextRound.name}`;
      }
      return `Proceed to next round`;
    })();

    // Get current round name for replay button
    const currentRoundId = getCurrentRoundId();
    const currentRound = rounds.find(r => r.id === currentRoundId);
    const replayLabel = (() => {
      // Check if current round has unique name (not equal to type)
      if (currentRound?.name && currentRound.name !== currentRound.type) {
        return `Replay ${currentRound.name}`;
      }
      return `Replay the current round`;
    })();

    // Show replay and proceed buttons
    return (
      <div className="flex gap-2">

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleChatProceed}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {nextRoundLabel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleChatReplay}>
                <Repeat className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {replayLabel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  const loadChatMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${configId}/chat/${chatId}`)
      if (!response.ok) throw new Error('Failed to load chat')
      const chat = await response.json()
      return chat
    } catch (error) {
      logError('Failed to load chat', error);
      throw error
    }
  }

  // filterDisplayMessages expects .content; derive it on the fly for filtering while retaining parts
  const displayMessages = useMemo(() => {
    const withContent = (messages || []).map((m: any) => ({
      ...m,
      content: (m.parts || [])
        .filter((p: any) => p?.type === 'text')
        .map((p: any) => p.text)
        .join(''),
    }));
    return filterDisplayMessages(withContent);
  }, [messages]);

  // Track the length of displayMessages for ChatProgress
  const lastDisplayCountRef = useRef(0);
  useEffect(() => {
    const newCount = displayMessages.length;
    if (newCount === lastDisplayCountRef.current) return;
    lastDisplayCountRef.current = newCount;


    updateMessageCount(newCount);
    onMessagesUpdate?.(displayMessages as Message[]);
  }, [displayMessages.length, updateMessageCount, onMessagesUpdate, displayMessages]);

  // Define scroll to message function with improved behavior
  useEffect(() => {
    
    if (setScrollToMessageFn && scrollAreaRef.current) {
      const scrollToMessageFn = (messageId: string) => {
        // Add check for undefined or empty messageId
        if (!messageId) {
          // invalid message id, skip scrolling
          return;
        }
                
        // Wait for any pending state updates and DOM rendering
        setTimeout(() => {          const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
          
          if (messageElement) {            
            // First make sure the viewport is available
            const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
            
            if (viewport) {
              
              // Get the current scroll position
              const viewportRect = viewport.getBoundingClientRect();
              const messageRect = messageElement.getBoundingClientRect();
              
              // Calculate the center position
              const scrollTop = 
                messageRect.top - 
                viewportRect.top - 
                (viewportRect.height / 2) + 
                (messageRect.height / 2) +
                viewport.scrollTop;
              
              // Use scrollTo with smooth behavior
              viewport.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
              });
              
              // Also try scrollIntoView as a fallback
              setTimeout(() => {
                messageElement.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center'
                });
              }, 50);
              
              // Temporarily disable auto-scroll
              setAutoScroll(false);
              
              // Delay highlighting until after scrolling completes
              setTimeout(() => {
                
                // Set the selected message ID for visual feedback after scrolling
                setSelectedMessageId(messageId);
                
                // Add a temporary class for a more dramatic effect
                try {
                  // Find the message bubble div (parent of the content div)
                  const messageBubble = messageElement.querySelector('.chat-message > div > div > div:last-child');
                  
                  if (messageBubble) {
                    // Highlight the entire message bubble
                    messageBubble.classList.add('pulse-highlight');
                    
                    // Remove it after the animation completes
                    setTimeout(() => {
                      messageBubble.classList.remove('pulse-highlight');
                    }, 1500);
                  } else {
                  }
                } catch (err) {
                  console.error('Error applying highlight class:', err);
                }
              }, 700); // Delay highlighting until scrolling is mostly complete
              
            } else {
              console.warn('ChatUI: Scroll viewport not found');
              // Try direct scrollIntoView without the viewport
              messageElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
              });
              
              // Apply highlight after scrolling with a delay
              setTimeout(() => {
                setSelectedMessageId(messageId);
                
                try {
                  // Find the message bubble div (parent of the content div)
                  const messageBubble = messageElement.querySelector('.chat-message > div > div > div:last-child');
                  
                  if (messageBubble) {
                    // Highlight the entire message bubble
                    messageBubble.classList.add('pulse-highlight');
                    
                    // Remove it after the animation completes
                    setTimeout(() => {
                      messageBubble.classList.remove('pulse-highlight');
                    }, 1500);
                  } else {
                  }
                } catch (err) {
                  console.error('Error applying highlight class:', err);
                }
              }, 700); // Delay for scrolling completion
            }
          } else {
            console.warn(`ChatUI: Message element with ID ${messageId} not found in DOM`);
          }
        }, 150); // Small delay to ensure DOM is updated
      };
      
      setScrollToMessageFn(scrollToMessageFn);
      
      return () => {
        setScrollToMessageFn(undefined);
      };
    }
  }, [setScrollToMessageFn, scrollAreaRef, setSelectedMessageId, setAutoScroll]);

  // Add a useEffect to auto-focus the input when chatId is 'new'
  useEffect(() => {
    if (chatId === 'new' && inputRef.current) {
      // Small delay to ensure component is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [chatId]);

  // Old retry handlers removed - now handled by ChatErrorHandler

  // Log errors for debugging (only in development)
  useEffect(() => {
    if (error && process.env.NODE_ENV === 'development') {
      console.log('ChatUI Error:', error);
      console.log('Is token limit error:', isTokenLimitError(error));
    }
  }, [error]);

  return (
    <>
      <style jsx>{`
        .dot-flashing {
          position: relative;
          width: 8px;
          height: 8px;
          border-radius: 4px;
          background-color: #333333;
          color: #333333;
          animation: dot-flashing 1s infinite linear alternate;
          animation-delay: 0.5s;
        }
        .dot-flashing::before, .dot-flashing::after {
          content: "";
          display: inline-block;
          position: absolute;
          top: 0;
        }
        .dot-flashing::before {
          left: -12px;
          width: 8px;
          height: 8px;
          border-radius: 4px;
          background-color: #333333;
          color: #333333;
          animation: dot-flashing 1s infinite linear alternate;
          animation-delay: 0s;
        }
        .dot-flashing::after {
          left: 12px;
          width: 8px;
          height: 8px;
          border-radius: 4px;
          background-color: #333333;
          color: #333333;
          animation: dot-flashing 1s infinite alternate;
          animation-delay: 1s;
        }

        @keyframes dot-flashing {
          0% {
            background-color: #333333;
          }
          50%, 100% {
            background-color: rgba(51, 51, 51, 0.2);
          }
        }
      `}</style>
      <div className="flex flex-col h-full">
        {/* Preview banner - shows only in preview mode */}
        {mode === 'preview' && (
          <PreviewBanner
            configId={configId as string}
            chatId={chatId as string}
            onCopyFromLive={handleCopyToPreview}
            show={messages.length > 0}
          />
        )}

        {/* Display errors at the top of the chat for better visibility */}
        <div className="sticky top-0 z-10">
          <ChatErrorHandler
            error={error ?? null}
            onRetry={() => handleRetry(setIsStreaming, regenerate, activeChatId, getProgress, mode)}
            onErrorHandled={() => {
              console.log('[ChatUI] Error handled - clearing error state');
              // Note: error state is managed by useChat hook, no manual clearing needed
            }}
          />
        </div>
      
      <ScrollArea 
        className="flex-1 p-4"
        ref={scrollAreaRef}
      > 
        <div className="space-y-4">
          {displayMessages.map((message: any, index: number) => {
            // Check if we should show round titles and if this message starts a new round
            const showRoundTitles = (config as any)?.designSettings?.showRoundTitles;
            const currentSessionId = message.metadata?.sessionId;
            const previousSessionId = index > 0 ? displayMessages[index - 1].metadata?.sessionId : null;
            const isNewRound = showRoundTitles && currentSessionId && currentSessionId !== previousSessionId;
            
            // Find the round information for this session
            let roundTitle = null;
            let roundData = null;
            if (isNewRound && currentSessionId) {
              // We need to find the round associated with this sessionId
              // Since sessionId maps to chatRoundSessionId, we need to find the round from the roundId in metadata
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
              <div key={index}>
                {/* Render round title if this is the start of a new round */}
                {isNewRound && roundTitle && (
                  <RoundTitleDivider roundTitle={roundTitle} roundData={roundData ?? undefined} />
                )}

                <ChatMessage
                  content={message.content}
                  role={message.role}
                  message={message}
                  configId={configId}
                  onSuggestionClick={handleSuggestionClick}
                  onNextRound={handleNextRound}
                  onReplay={handleReplay}
                  lastMessageId={lastMessageId}
                  userImageUrl={user?.imageUrl}
                  previousMessage={index > 0 ? displayMessages[index - 1] : undefined}
                  mode={mode}
                />
              </div>
            );
          })}
        </div>

        {/* Loading UI for agent generation */}
        {isGeneratingAgents && (
          <div className="py-4 flex justify-center">
            <div className="bg-white rounded-lg px-4 py-3 mt-4">
              <div className="flex items-center gap-4">
                <span className="text-gray-700">Generating agents</span>
                <div className="dot-flashing" style={{ marginLeft: '4px', marginRight: '24px' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Loading UI for waiting on agent message stream */}
        {(() => {
          // Show loading indicator if streaming and either:
          // 1. No messages yet, or
          // 2. Last message is not an assistant message, or
          // 3. Last message is an assistant message but has no content yet (waiting for stream to start)
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          const lastMessageContent = lastMessage ? (lastMessage as any).parts?.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join('').trim() : '';
          const shouldShowLoading = isStreaming && !isGeneratingAgents && (
            !lastMessage ||
            lastMessage.role !== 'assistant' ||
            (lastMessage.role === 'assistant' && !lastMessageContent)
          );

          return shouldShowLoading && (
            <div className="py-4 flex justify-center">
              <div className="bg-gray-200 rounded-lg px-6 py-4 mt-4">
                <div className="flex justify-center items-center" style={{ width: '32px', height: '8px' }}>
                  <div className="dot-flashing"></div>
                </div>
              </div>
            </div>
          );
        })()}
      </ScrollArea>

      {/* Chat instructions and example prompts - now fixed at bottom above input */}
      {chatId === 'new' && messages.length === 0 && (
        <div className="flex flex-col items-center px-4 py-6 space-y-6">
          {chatInstructions && (
            <div className="bg-white p-5 rounded-lg max-w-[650px] text-left">
              <p className="text-base text-gray-600 whitespace-pre-wrap">{chatInstructions}</p>
            </div>
          )}
          
          {examplePrompts.length > 0 && (
            <div className="flex flex-col items-center w-full max-w-[500px] gap-2">
              <div className="flex flex-col w-full gap-2">
                {examplePrompts.map((prompt, index) => (
                  <TooltipProvider key={index}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleSuggestionClick(prompt)}
                          className="px-4 py-3 text-sm text-left text-gray-600 bg-white border border-gray-300 rounded-lg hover:border-gray-500 w-full"
                        >
                          {prompt}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Use this prompt to begin the chat
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview mode instructions - Now directly above the form and only shows if no messages */}
      {mode === 'preview' && messages.length === 0 && (
        <div className="px-4 py-2 border-b border-gray-200">
          {/* Reverted to just text, centered, with bg and rounded corners */}
          <div className="max-w-fit mx-auto text-sm p-3 text-muted-foreground bg-white rounded-lg mb-4">
            Type below to preview your chat, or{' '}
            <a 
              href={`/chats/${configId}/chat/new`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1 hover:text-primary"
            >
              start a live chat
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Conditionally apply border to the form */}
      <form 
        onSubmit={handleChatSubmit} 
        className={`p-4 ${mode !== 'preview' ? 'border-t border-gray-200' : ''}`}
      >
        <div className="flex space-x-2 mx-auto flex flex-1 gap-2 text-base lg:gap-3 md:max-w-3xl lg:max-w-[40rem] xl:max-w-[48rem]">
          <Textarea
            ref={inputRef}
            className="min-h-[36px] max-h-[160px] bg-white resize-none overflow-y-auto"
            value={input}
            placeholder="Type your message..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit(e);
              }
            }}
            rows={1}
            disabled={isLoading || (error && (isTokenLimitError(error) || isOverloadedError(error)))}
          />
          <div>
            {getButtonControls()}
          </div>
        </div>
      </form>

      {/* Replay confirmation modal */}
      {replayingMessage && (() => {
        // Count only visible assistant messages after the target (exclude hidden user "next agent" prompts)
        const subsequentMessages = messages.slice(replayingMessage.index + 1);
        const visibleSubsequentCount = subsequentMessages.filter(m => m.role === 'assistant').length;

        return (
          <ConfirmModal
            title={replayingMessage.message.role === 'user' ? "Replay Message" : "Regenerate Response"}
            message={
              replayingMessage.message.role === 'user'
                ? `Your message and ${visibleSubsequentCount} subsequent message${visibleSubsequentCount === 1 ? '' : 's'} will be deleted, and the message text will be restored to the input.`
                : `This message and ${visibleSubsequentCount} subsequent message${visibleSubsequentCount === 1 ? '' : 's'} will be deleted and regenerated.`
            }
            onConfirm={confirmReplay}
            onCancel={() => setReplayingMessage(null)}
            isLoading={isReplaying}
            cancelDisabled={isReplaying}
            confirmText={replayingMessage.message.role === 'user' ? "Replay" : "Regenerate"}
          />
        );
      })()}
    </div>
    </>
  );
}