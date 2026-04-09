'use client'

import { ScrollArea } from "./ui/scroll-area"
import { Button } from "./ui/button"
import { Settings, ChevronDown, MessageCircle, ChevronRight, Bot } from "lucide-react"
import { useChatProgressStore } from "@/lib/stores/chatProgressStore"
import { useConfigsStore } from "@/lib/stores/configsStore"
import { useChatAgentStore } from "@/lib/stores/chatAgentStore"
import { cn } from "@/lib/utils"
import { RoundIcon } from '@/components/rounds/RoundIcon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEffect, useState, memo, useMemo } from "react"
import { getDialogueData, isFirstDialogueMessage as checkIsFirstDialogueMessage } from '@/lib/utils/dialogue'

import { Message } from "@/types/message"
import { useChatMessages } from "@/lib/contexts/ChatMessagesContext"

// Helper for development-only logging - defined at module level to avoid hoisting issues
const logDebug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

interface ChatProgressProps {
  isActiveChat?: boolean;
  onEditClick?: () => void;
  configId?: string;
  messages?: Message[];
  scrollToMessage?: (messageId: string) => void;
  userImageUrl?: string;
  hideTitle?: boolean;
}

interface RoundHistoryItem {
  roundId: string;
  roundType: string;
  roundName: string;
  roundIcon?: string;
  isActive: boolean;
  messages: {
    id: string;
    authorId: string;
    timestamp: Date;
  }[];
  timestamp: Date;
  sessionId: string; // Added to group repeated rounds
}

function ChatProgress({ isActiveChat, onEditClick, configId, messages = [], scrollToMessage, userImageUrl, hideTitle = false }: ChatProgressProps) {
  const { 
    currentChatId,
    activeRoundId,
    messageCount
  } = useChatProgressStore()
  
  // Get rounds from configsStore using the passed configId prop instead of store configId
  // This prevents flicker when the store configId is temporarily null during navigation
  const rounds = useConfigsStore(state => 
    configId ? state.getRounds(configId) : []
  )
  
  const { setSelectedMessageId, selectedMessageId } = useChatMessages();
  
  const agents = useChatAgentStore(state => state.agents)
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [roundHistory, setRoundHistory] = useState<RoundHistoryItem[]>([]);

  // Helper function to get agent by id
  const getAgent = (id: string) => agents.find(agent => agent.id === id)

  // Helper function to encode SVG for avatar
  const encodeAvatarSvg = (svg: string | undefined) => {
    try {
      return svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` : ''
    } catch {
      return ''
    }
  }

  // Helper function to toggle a round's expanded state
  const toggleRoundExpanded = (sessionId: string) => {
    setExpandedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  // Helper function to get round information from round id
  const getRound = (roundId: string): { type: string, name: string } => {
    const round = rounds.find(r => r.id === roundId);
    return {
      type: round?.type || 'Unknown Round',
      name: round?.name || round?.type || 'Unknown Round'
    };
  };

  // Memoize the rounds data to prevent unnecessary re-processing
  const roundsLength = rounds.length;
  const memoizedRounds = useMemo(() => {
    return rounds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsLength]);

  /**
   * Gets session ID from message for ChatProgress grouping.
   * 
   * Priority order:
   * 1. Session annotation (server-provided)
   * 2. chatRoundSessionId field (backup)
   * 3. Smart fallback for unprocessed user messages (replay detection)
   * 4. Final fallback with unknown session
   * 
   * @param message - The message to get session ID from
   * @param messageIndex - Index for fallback session naming
   * @returns Session ID string for grouping messages
   */
  const getSessionIdFromMessage = (message: Message, messageIndex: number): string => {
    logDebug(`Processing message ${message.id} (index ${messageIndex})`, {
      chatRoundSessionId: (message as any).chatRoundSessionId,
      role: message.role,
      metaSession: (message as any)?.metadata?.sessionId,
      metaRound: (message as any)?.metadata?.roundId
    });

    // 1. Message metadata sessionId (primary)
    const metaSessionId = (message as any)?.metadata?.sessionId as string | undefined;
    if (metaSessionId) {
      logDebug(`Using session metadata: ${metaSessionId}`);
      return metaSessionId;
    }
    
    // 2. Server-provided chatRoundSessionId (backup for existing messages)
    if ((message as any).chatRoundSessionId) {
      const sessionId = (message as any).chatRoundSessionId;
      logDebug(`Using chatRoundSessionId: ${sessionId}`);
      return sessionId;
    }
    
    // 3. Edge case: Message hasn't been processed by server yet (during streaming)
    // This only happens for user messages that are added client-side before server processing
    if (message.role === 'user') {
      const messageRoundId = (message as any)?.metadata?.roundId || activeRoundId;
      
      if (messageRoundId) {
        // Check if this is a replay (same round as active) or new round
        if (messageRoundId === activeRoundId) {
          // Replay - find most recent session for this round
          const candidateSessions = roundHistory.filter(session => 
            session.roundId === messageRoundId && 
            !session.sessionId.startsWith('new-session-') && 
            !session.sessionId.startsWith('unknown-session-')
          );
          
          const mostRecentSession = candidateSessions.sort((a, b) => 
            b.timestamp.getTime() - a.timestamp.getTime()
          )[0];
          
          if (mostRecentSession) {
            logDebug(`Replay detected - using most recent session: ${mostRecentSession.sessionId} for round ${messageRoundId}`);
            return mostRecentSession.sessionId;
          }
        }
        
        // New round or no existing session - create temporary
        const sessionId = `new-session-${messageRoundId}`;
        logDebug(`Creating temporary session: ${sessionId} for round ${messageRoundId}`);
        return sessionId;
      }
    }
    
    // 4. Final fallback (should rarely happen)
    const sessionId = `unknown-session-${messageIndex}`;
    logDebug(`Using fallback session ID: ${sessionId}`);
    return sessionId;
  };

  // Effect to process messages when messageCount from store changes
  useEffect(() => {
    if (!isActiveChat && currentChatId) return;
    if (!messages || messages.length === 0) return;
    if (!(memoizedRounds && memoizedRounds.length > 0)) return;
    
    // Use the messages prop as already filtered
    const filteredMessages = messages;
    if (filteredMessages.length === 0) return;
    
    // Process only unprocessed messages
    const processedMessageIds = new Set(
      roundHistory.flatMap(round => round.messages.map(msg => msg.id))
    );
    
    const unprocessedMessages = filteredMessages.filter(
      msg => !processedMessageIds.has(msg.id)
    );
    
    if (unprocessedMessages.length === 0) return;
    
    // Use functional update to avoid depending on roundHistory
    setRoundHistory(prevHistory => {
      const newRoundHistory = [...prevHistory];
      
      unprocessedMessages.forEach((message, messageIndex) => {
        // Get session ID using simplified logic - server handles legacy sessions
        const sessionId = getSessionIdFromMessage(message, messageIndex);
        
        // Check if this message has a session annotation and there are existing sessions with temporary IDs
        // that should be updated to use the real session ID
        const realSessionId = (message as any)?.metadata?.sessionId as string | undefined;
        if (realSessionId && realSessionId.length > 20) { // Real UUIDs are longer than temp IDs
          const messageRoundId = (message as any)?.metadata?.roundId 
            || activeRoundId;
            
          if (messageRoundId) {
            // Find any existing session with a temporary ID for the same round
            const tempSessionId = `new-session-${messageRoundId}`;
            const existingTempSession = newRoundHistory.find(s => s.sessionId === tempSessionId);
            
            if (existingTempSession) {
              logDebug(`Updating temporary session ${tempSessionId} to real session ${realSessionId}`);
              existingTempSession.sessionId = realSessionId;
              // Also update the expanded state
              setExpandedRounds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(tempSessionId)) {
                  newSet.delete(tempSessionId);
                  newSet.add(realSessionId);
                }
                return newSet;
              });
            }
          }
        }
        
        // Determine round ID for display purposes
        const messageRoundId = (message as any)?.metadata?.roundId || activeRoundId;
        
        if (!messageRoundId) {
          return;
        }
        
        // Get round info
        const { type: roundType, name: roundName } = getRound(messageRoundId);
        
        // Find or create session
        let session = newRoundHistory.find(s => s.sessionId === sessionId);
        if (!session) {
          logDebug(`Creating NEW session: ${sessionId} for round ${messageRoundId} (${roundName})`);
          const roundObj = memoizedRounds.find(r => r.id === messageRoundId);
          const iconString = (roundObj as any)?.icon || (roundObj?.icon ? String(roundObj.icon) : undefined);
          
          session = {
            roundId: messageRoundId,
            roundType,
            roundName,
            roundIcon: iconString,
            isActive: false,
            messages: [],
            timestamp: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now()),
            sessionId: sessionId
          };
          newRoundHistory.push(session);
        } else {
          logDebug(`Using EXISTING session: ${sessionId} for round ${messageRoundId} (${roundName})`);
        }
        
        // Get author
        const authorId = (message as any)?.metadata?.agentId
          || (message as any).authorId
          || (message as any).agentId
          || (message.role === 'user' ? 'user' : 'unknown');
        
        // Add message to session
        const createdAt = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now());

        session.messages.push({
          id: message.id,
          authorId,
          timestamp: createdAt
        });
      });
      
      // Sort and return new history
      newRoundHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return newRoundHistory;
    });
    
    // Auto-expand the last session
    if (unprocessedMessages.length > 0) {
      setExpandedRounds(prev => {
        const newSet = new Set(prev);
        // Find the session of the last message
        const lastMessage = unprocessedMessages[unprocessedMessages.length - 1];
        const lastSessionId = getSessionIdFromMessage(lastMessage, unprocessedMessages.length - 1);
        newSet.add(lastSessionId);
        return newSet;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount, isActiveChat, currentChatId, memoizedRounds, activeRoundId]);

  // Reset fingerprint when chat changes to prevent false positives
  useEffect(() => {
  }, [currentChatId]);

  // Auto-expand all rounds for shared view
  useEffect(() => {
    if (roundHistory.length > 0) {
      const allSessionIds = roundHistory.map(item => item.sessionId);
      setExpandedRounds(new Set(allSessionIds));
    }
  }, [roundHistory]);

  // Handle message click with improved scrolling and highlighting
  const handleMessageClick = (messageId: string) => {
    if (!scrollToMessage) {
      // Use a fallback direct DOM approach as last resort
      try {
        setTimeout(() => {
          const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
          if (messageElement) {
            // Align the top of the message with the top of the viewport for better visibility of long messages
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Highlight the message content after scrolling with a delay
            setTimeout(() => {
              // Set the selected message ID for visual feedback
              setSelectedMessageId(messageId);
              
              // Find the content div within the message element
              try {
                // Find the message bubble div (parent of the content div)
                const messageBubble = messageElement.querySelector('.chat-message > div > div > div:last-child');
                
                if (messageBubble) {
                  // Highlight the entire message bubble
                  messageBubble.classList.add('pulse-highlight');
                  setTimeout(() => {
                    messageBubble.classList.remove('pulse-highlight');
                  }, 1500);
                }
              } catch (_err) {
              }
            }, 700); // Delay highlighting until scrolling is mostly complete
          } else {
          }
        }, 100);
      } catch (_error) {
      }

      return;
    }

    // Then call the scroll function if available
    try {
      scrollToMessage(messageId);
    } catch (_error) {
    }
  };

  // Check if a message is the selected message
  const isMessageSelected = (messageId: string) => {
    const isSelected = selectedMessageId === messageId;
    return isSelected;
  };

  // Log when selectedMessageId changes in ChatProgress
  useEffect(() => {
    if (selectedMessageId) {
      // Try to find which round contains this message
      for (const round of roundHistory) {
        const matchingMessage = round.messages.find(msg => msg.id === selectedMessageId);
        if (matchingMessage) {
          // Make sure this round is expanded
          if (!expandedRounds.has(round.sessionId)) {
            setExpandedRounds(prev => {
              const newSet = new Set(prev);
              newSet.add(round.sessionId);
              return newSet;
            });
          }
          break;
        }
      }
    }
  }, [selectedMessageId, roundHistory, expandedRounds]);

  return (
    <div className="h-full flex flex-col relative">
      {!hideTitle && (
        <div className="px-4 py-3 border-b flex items-center justify-between">
          {isActiveChat ? (
            <div className="flex items-center justify-between w-full">
              <h2 className="text font-semibold truncate">
                Chat Messages
              </h2>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold truncate whitespace-nowrap max-w-[calc(100%-40px)]">Chat Preview</h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary"
                      onClick={onEditClick}
                      className="h-8 w-8"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit this chat template</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-auto">
        <div className="p-4 space-y-2">
          {roundHistory.map((historyItem) => {
            const isExpanded = expandedRounds.has(historyItem.sessionId);
            
            return (
              <div key={historyItem.sessionId} className="space-y-1">
                <button 
                  onClick={() => toggleRoundExpanded(historyItem.sessionId)}
                  className={cn(
                    "flex items-center justify-between w-full text-left px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RoundIcon
                      iconName={historyItem.roundIcon && historyItem.roundIcon !== 'undefined' ? historyItem.roundIcon : undefined}
                      roundType={historyItem.roundType as any}
                      className="h-4 w-4 text-blue-500"
                      fallback={MessageCircle}
                    />
                    <span className="font-medium">
                      {historyItem.roundName}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                <div 
                  className={cn(
                    "ml-4 overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "opacity-100" : "max-h-0 opacity-0"
                  )}
                  style={isExpanded ? { maxHeight: `${historyItem.messages.length * 40}px` } : {}}
                >
                  {historyItem.messages.length > 0 && (
                    <div className="space-y-2 py-1">
                      {historyItem.messages.map((message) => {
                        const isUserMessage = message.authorId === 'user';
                        const agent = isUserMessage ? null : getAgent(message.authorId);
                        const isSelected = isMessageSelected(message.id);
                        
                        return (
                          <button 
                            key={`${message.id}`} 
                            className={cn(
                              "flex items-center gap-2 text-sm text-gray-600 w-full text-left px-2 py-1 rounded min-w-0",
                              isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                            )}
                            onClick={() => handleMessageClick(message.id)}
                          >
                            <div className="flex-shrink-0 relative">
                              {/* Check if this is a dialogue message by looking at the message in the full messages array */}
                              {(() => {
                                const fullMessage = messages.find(m => m.id === message.id) as any;
                                const currentDialogue = getDialogueData(fullMessage);
                                
                                // Find the previous message in the historyItem to check if it's the same dialogue
                                const messageIndex = historyItem.messages.findIndex(m => m.id === message.id);
                                const previousMessage = messageIndex > 0 ? (messages.find(m => m.id === historyItem.messages[messageIndex - 1].id) as any) : null;
                                
                                const isDialogueMessage = !!currentDialogue;
                                const isFirstDialogueMessage = checkIsFirstDialogueMessage(fullMessage, previousMessage);
                                
                                // Show connector line for dialogue messages that aren't the first
                                const showConnector = isDialogueMessage && !isFirstDialogueMessage;
                                
                                return showConnector ? (
                                  <div className="absolute left-1/2 -top-4 w-px h-4 bg-gray-300 -translate-x-1/2"></div>
                                ) : null;
                              })()}
                              
                              {isUserMessage ? (
                                // Debug log for user message rendering
                                userImageUrl === "gradient" ? (
                                  <div 
                                    className="w-5 h-5 rounded-full flex items-center justify-center" 
                                    style={{ 
                                      background: 'linear-gradient(135deg, #5E2D79 0%, #FF44CC 100%)'
                                    }}
                                  />
                                ) : userImageUrl ? (
                                  <div 
                                    className="w-5 h-5 rounded-full bg-center bg-cover"
                                    style={{ 
                                      backgroundImage: `url('${userImageUrl}')`
                                    }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                                    U
                                  </div>
                                )
                              ) : (
                                agent && agent.avatar ? (
                                  <div 
                                    className="w-5 h-5 rounded-full bg-center bg-cover"
                                    style={{ 
                                      backgroundImage: `url('${encodeAvatarSvg(agent?.avatar)}')`
                                    }}
                                  />
                                ) : (
                                  <Bot className="h-4 w-4" />
                                )
                              )}
                            </div>
                            <span className={cn(
                              "truncate min-w-0 flex-1",
                              isSelected ? "font-medium" : ""
                            )} title={isUserMessage ? (hideTitle ? 'Anonymous' : 'You') : (agent?.name || `Agent ${message.authorId.slice(0, 6)}`)}>
                              {isUserMessage ? (hideTitle ? 'Anonymous' : 'You') : (agent?.name || `Agent ${message.authorId.slice(0, 6)}`)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {roundHistory.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              {messages.length > 0 ? (
                <div>
                  <p>No organized message history available</p>
                  <p className="text-xs mt-1">({messages.length} messages exist but couldn&apos;t be properly categorized)</p>
                  {rounds.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs">Available rounds:</p>
                      <ul className="text-xs mt-1">
                        {rounds.map(round => (
                          <li key={round.id}>{round.type} ({round.id})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p>No messages yet</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// Export the component with memo to prevent unnecessary re-renders
export default memo(ChatProgress); 