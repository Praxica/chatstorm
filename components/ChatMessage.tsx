import { Avatar } from "@/components/ui/avatar"
import { Markdown } from './markdown';
import { User, Bot, ArrowRight, Info, RotateCcw } from 'lucide-react'
import { useChatAgentStore } from "@/lib/stores/chatAgentStore"
import { useConfigsStore } from '@/lib/stores/configsStore'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from 'react';
import { useChatMessages } from '@/lib/contexts/ChatMessagesContext';
import { getData as getUIData } from '@/lib/chat/services/ui-message';
import { getDialogueInfo } from '@/lib/utils/dialogue';
import { MessageMetadataModal } from './MessageMetadataModal';

interface ChatMessageProps {
  content: string
  role: string
  message: any
  configId: string;
  onSuggestionClick?: (suggestion: string) => void
  onNextRound?: (roundId: string) => void
  onReplay?: (messageId: string) => void
  lastMessageId?: string | null
  userImageUrl?: string
  previousMessage?: any
  mode?: 'preview' | 'user';
}

export function ChatMessage({ content, role, message, configId, onSuggestionClick, onNextRound, onReplay, lastMessageId, userImageUrl, previousMessage, mode }: ChatMessageProps) {
  const { setSelectedMessageId } = useChatMessages();
  const [isHovered, setIsHovered] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  // Get config to access design settings
  const config = useConfigsStore(state =>
    configId ? state.configs.find(c => c.id === configId) : null
  );

  // Get rounds for this config - use config.rounds directly to avoid selector issues
  const rounds = config?.rounds || [];

  // Get all agents from the store
  const agents = useChatAgentStore(state => state.agents);
  
  // Make sure data-message-id is set properly
  useEffect(() => {
    // Component lifecycle hook - no logging needed
  }, [message.id]);
  
  // Handler for when the message is clicked directly
  const handleMessageClick = () => {
    setSelectedMessageId(message.id);
  };
  
  // Get agent from message agentId
  const agentId = message?.metadata?.agentId;
  
  const agent = useChatAgentStore(state => 
    agentId ? state.agents.find(a => a.id === agentId) : undefined
  );

  // Memoize dialogue information to avoid recalculation during streaming
  const dialogueInfo = useMemo(() => {
    const info = getDialogueInfo(message, previousMessage);
    return info;
  }, [message, previousMessage]);

  const sanitizeContent = (content: string) => {
    // Strip out the agent prefix and the next agent selection format
    return content
      .replace(/<AGENT>.*?<\/AGENT>/g, '')
      .replace(/\[NEXT_AGENT:[^\]]+\]/g, '')
      .replace(/\[NEXT_AGENT:/g, '');
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(<SELF>|<\/SELF>)/);
    let isInSelfTag = false;
    
    return parts.map((part, index) => {
      if (part === '<SELF>') {
        isInSelfTag = true;
        return null;
      }
      if (part === '</SELF>') {
        isInSelfTag = false;
        return null;
      }
      if (!part) return null;
      
      return (
        <div key={index} className={isInSelfTag ? "italic bg-gray-100 text-gray-700 px-3 py-3 mb-4 rounded border border-gray-300" : ""}>
          <Markdown>{part}</Markdown>
        </div>
      );
    });
  };

  const renderAvatar = () => {
    if (role === 'user') {
      // Handle the special "gradient" value for userImageUrl
      if (userImageUrl === "gradient") {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="h-9 w-9 rounded-full flex items-center justify-center" 
                  style={{ 
                    background: 'linear-gradient(135deg, #5E2D79 0%, #FF44CC 100%)'
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>User</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      
      if (userImageUrl) {
        const params = new URLSearchParams();
        params.set('height', '36');
        params.set('width', '36');
        
        const imageSrc = `${userImageUrl}?${params.toString()}`;
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <img 
                  src={imageSrc}
                  alt="User avatar"
                  className="h-9 w-9 rounded-full"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>You</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-9 w-9 bg-white rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-gray-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>You</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }
    
    if (agent?.avatar) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <img 
                src={`data:image/svg+xml;utf8,${encodeURIComponent(agent.avatar)}`} 
                alt={`${agent.name} avatar`}
                className="h-9 w-9"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{agent.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Bot className="h-9 w-9 text-gray-600" />
          </TooltipTrigger>
          <TooltipContent>
            <p>AI Assistant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
    <div
      className={`mx-auto flex flex-1 flex-col gap-4 text-base md:gap-5 lg:gap-6 md:max-w-3xl lg:max-w-[40rem] xl:max-w-[48rem] chat-message ${
        dialogueInfo.isDialogue && !dialogueInfo.isFirstMessage ? '!-mt-[22px]' : ''
      }`}
      data-message-id={message.id}
      onClick={handleMessageClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex ${role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
        <div className={`flex items-start w-full ${role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <Avatar className="h-9 w-9 mt-1 flex items-center justify-center">
            {renderAvatar()}
          </Avatar>
          <div
            className={`mx-3 p-4 rounded-lg w-full relative ${
              role === 'user' ? 'bg-white text-gray-800 border border-gray-200' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {/* Replay button - show for assistant messages, and user messages in preview mode */}
            {/* TEMPORARY: Always visible for testing - remove isHovered condition */}
            {onReplay && message.id && (role === 'assistant' || mode === 'preview') && (
              <div className="absolute top-2 right-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-70 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Use database UUID from metadata, fallback to SDK ID
                          const messageId = message.metadata?.messageId || message.id;
                          onReplay(messageId);
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {role === 'user' ? 'Edit this message' : 'Replay this message'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {role === 'assistant' && agent && (
              <div className="text-sm font-semibold text-black mb-2 flex items-center gap-2">
                <span>{agent.name}</span>
                {(() => {
                  const showMetadata = (config as any)?.designSettings?.showMessageMetadata;
                  return isHovered && showMetadata;
                })() && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMetadataModal(true);
                          }}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Info className="h-4 w-4 text-gray-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-normal">View message metadata</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
            {renderContent(sanitizeContent(content))}
          </div>
        </div>
      </div>
      {(() => {
        const nextRoundData = getUIData<{ id?: string }>(message, 'next-round');
        const nextRoundId = nextRoundData?.id ?? message?.metadata?.nextRoundId;
        if (nextRoundId && message.id === lastMessageId && rounds.length > 1) {
          return (
            <div className="flex flex-wrap gap-2 pl-14" key="transition">
              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNextRound?.(nextRoundId);
                  }}
                  className="px-3 py-2 text-sm text-white bg-black border border-black rounded-lg hover:bg-gray-800 flex items-center justify-center"
                >
                  {(() => {
                    const round = rounds.find(r => r.id === nextRoundId);
                    const roundName = round ? ((round.name && round.name !== round.type) ? round.name : round.type) : 'selected';
                    if (round && round.name && round.name !== round.type) {
                      return `Proceed to ${roundName}`;
                    }
                    return `Proceed to the ${roundName} round`;
                  })()}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </button>
                <p className="text-sm text-gray-500">Or keep chatting below</p>
              </div>
            </div>
          );
        }
        return null;
      })()}
      {(() => {
        const suggestions = getUIData<string[]>(message, 'prompt-suggestions')
          ?? (message?.metadata?.promptSuggestions as string[] | undefined);
        if (suggestions && message.id === lastMessageId) {
          return (
            <div className="flex flex-wrap gap-2 pl-14" key="promptSuggestions">
              <p className="w-full text-sm text-gray-500">Suggested prompts:</p>
              <div className="grid grid-cols-1 gap-2 w-full">
                {suggestions.map((suggestion: string, index: number) => (
                  <button
                    key={index}
                    className="px-3 py-2 text-sm text-left text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSuggestionClick?.(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>

    {role === 'assistant' && (
      <MessageMetadataModal
        open={showMetadataModal}
        onOpenChange={setShowMetadataModal}
        message={message}
        agents={agents}
        rounds={rounds as any}
      />
    )}
    </>
  )
}