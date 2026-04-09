import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { TokenService } from "@/lib/services/TokenService";
import { prisma } from "@/lib/prisma";
import { GenerationMode, PersistenceMode } from "@/lib/chat/types";
import { ChatEngine } from "@/lib/chat/ChatEngine";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { User } from "@prisma/client";
import { MessageServices } from "@/lib/chat/services/messages";
import { activateNextProgress } from "@/lib/chat/services/progress";
import { ChatRoundSessionService } from "@/lib/chat/services/sessions";
import { ModelService } from "@/lib/chat/services/models";
import { logError } from '@/lib/utils/error';
import { logDebug } from '@/lib/utils/debug';
import { NextRequest, NextResponse } from 'next/server';

// Define a type that extends the User type with capabilities
type UserWithCapabilities = User & {
  capabilities?: any;
};

const tokenService = new TokenService();

// Helper function to get model information for error logging
function getModelInfo(chatState: any) {
  try {
    const selectedModel = ModelService.getLLMModel(chatState);
    return {
      modelId: (selectedModel as any)?.modelId || 'unknown',
      providerId: (selectedModel as any)?.providerId || 'unknown',
      // Try to extract more info from model key/config
      selectedModelKey: chatState.activeRound?.selectedModel || 
                        chatState.activeAgent?.selectedModels?.[0] || 
                        'default'
    };
  } catch (error) {
    return {
      modelId: 'error-retrieving-model',
      providerId: 'error-retrieving-provider',
      selectedModelKey: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ configId: string }> }) {
  
  const requestId = Math.random().toString(36).substring(7);
  const { messages, chatId, mode: _mode = 'user', progress: initialProgress, isReplay, temporarySessionId: _temporarySessionId, modelOverride, trigger } = await req.json();
  const { configId } = await params;

  // Also check for model override in query parameters (for regenerate with different model)
  const url = new URL(req.url);
  const queryModelOverride = url.searchParams.get('modelOverride');
  const finalModelOverride = modelOverride || queryModelOverride;

  logDebug('StreamRoute', 'POST request START', { requestId, chatId });

  // Normal chat handling with database operations
  try {
    
    // Get user ID from auth service (returns internal user ID)
    const userId = await getAuthenticatedUserId();
    
    // Get config to check if this is a space app
    const config = await prisma.config.findUnique({
      where: { id: configId },
      select: { spaceId: true }
    });

    // Check if user has exceeded their token limit
    if (userId) {
      const tokenContext = {
        userId,
        spaceId: config?.spaceId || undefined
      };
      const tokenLimitResponse = await tokenService.checkTokenLimit(tokenContext);
      
      // If we got a response object back, it means the token limit was reached
      if (tokenLimitResponse) {
        return tokenLimitResponse;
      }
    }
  
    // Fetch user if authenticated (userId is already the internal ID from getAuthenticatedUserId)
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { capabilities: true },
      });
    } catch (_error) {
      throw new Error('Error fetching user');
    }

    // configure chat params
    const progress = initialProgress;

    // if next progress exists, set as active progress
    const updatedProgress = activateNextProgress(progress);

    // Fetch chat from database to get branch info
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { activeBranch: true, activeBranchPath: true }
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    const chatSettings = {
      id: chatId,
      branchId: chat.activeBranch as string,
      activeBranchPath: chat.activeBranchPath,
      generationMode: 'stream' as GenerationMode,
      persistenceMode: 'save' as PersistenceMode,
    };

    // Create initial state using ChatEngine namespace
    let chatState = ChatEngine.createState(chatSettings);

    // Set user ID and capabilities (use internal UUID, not Clerk ID)
    chatState.user = {
      id: user?.id || userId // Use internal UUID if user found, fallback to Clerk ID
    } as UserWithCapabilities;
    
    if (user?.capabilities) {
      (chatState.user as UserWithCapabilities).capabilities = user.capabilities;
    }

    try {
      // Handle session assignment for replays BEFORE ChatEngine.initialize
      if (isReplay) {
        const currentRoundId = updatedProgress.active.round.id;
        logDebug('StreamRoute', 'Looking for existing session for round', { requestId, chatId, currentRoundId });
        
        // Reactivate existing session for replay
        const reactivatedSessionId = await ChatRoundSessionService.replayExistingSession(chatId, currentRoundId);
        
        if (reactivatedSessionId) {
          chatState.currentSessionId = reactivatedSessionId;
        }
      }
    
      // Add messages to state as UIMessage[]; conversion happens in LLMService
      chatState.messages = messages as any;

      // Save the latest user message BEFORE initializing ChatEngine
      // This ensures user message timestamp is before pre-created assistant message
      // Skip saving on regenerate/retry to avoid duplicates
      if (chatState.chat.persistenceMode === 'save' && trigger !== 'regenerate-message') {
        const latestUserMessage = messages[messages.length - 1];
        if (latestUserMessage && latestUserMessage.role === 'user') {
          // Count completed assistant messages (those with totalTokens set)
          // This excludes pre-created assistant message stubs which have totalTokens = null
          // User messages also have totalTokens = null, so this effectively counts completed rounds
          const completedMessageCount = await prisma.message.count({
            where: {
              chatId: chatState.chat.id,
              isActive: true,
              totalTokens: { not: null }
            }
          });

          // Save if either:
          // 1. This is the first completed message (completedMessageCount === 0), OR
          // 2. There's more than one message in the request (messages.length > 1)
          if (completedMessageCount === 0 || messages.length > 1) {
            const savedUserMessage = await MessageServices.saveChatMessage(chatState, 'user', '', undefined, undefined, null, latestUserMessage as any);
            // Store the database UUID so we can stream it to the client
            chatState.userMessageId = savedUserMessage.id;
          }
        }
      }

      // Initialize chat using ChatEngine namespace (after user message is saved)
      logDebug('StreamRoute', 'Starting ChatEngine.initialize()', {
        requestId,
        configId,
        sessionIdInProgress: (updatedProgress?.active as any)?.session?.id
      });
      chatState = await ChatEngine.initialize(chatState, configId, updatedProgress);
      logDebug('StreamRoute', 'ChatEngine initialized', {
        requestId,
        currentSessionId: chatState.currentSessionId
      });

      // Apply model override if provided (for overloaded error retries)
      if (finalModelOverride && chatState.activeAgent) {
        logDebug('StreamRoute', 'Applying model override', { requestId, modelOverride: finalModelOverride });
        try {
          // Check if the model exists in available models
          const availableModels = chatState.languageModels || {};
          if (availableModels[finalModelOverride]) {
            // Temporarily override the active agent's model
            chatState.activeAgent = {
              ...chatState.activeAgent,
              model: finalModelOverride,
              selectedModels: [finalModelOverride]
            };
            logDebug('StreamRoute', 'Model override applied successfully', { requestId, modelOverride: finalModelOverride });
          } else {
            console.warn(`[StreamRoute] Model override ${finalModelOverride} not available for user ${chatState.user.id}`);
          }
        } catch (error) {
          console.warn(`[StreamRoute] Failed to apply model override ${finalModelOverride}:`, error);
        }
      }

      // Start the stream
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          try {
            chatState.adapter.setDataStream(writer);

            // generate the chat using ChatEngine namespace
            // streamChat returns void; any errors will surface via onError/onFinish
            await ChatEngine.streamChat(chatState);

          } catch (error) {
            if (error instanceof Error && error.message && error.message.trim() !== '') {
              const modelInfo = getModelInfo(chatState);
              // Include model info in context; pass the actual Error to logger per error-handling rules
              logError(`Streaming chat execution [${requestId}] for chat ${chatId} :: model=${modelInfo.modelId} provider=${modelInfo.providerId} key=${modelInfo.selectedModelKey}`, error);
            } else if (error instanceof Error) {
              // Log minimal info for empty Error objects
              console.warn(`[StreamRoute] Empty error caught in streaming execution [${requestId}]:`, error.constructor.name);
            }
            // Do not log non-Error values to avoid noisy `{}` output
          }
        },
      });

      return createUIMessageStreamResponse({ stream });
      
    } catch (error) {
      // Enhanced error logging with model information
      if (error instanceof Error) {
        const modelInfo = getModelInfo(chatState);
        console.error('Chat initialization error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          modelInfo: modelInfo
        });
        throw new Error(`Chat initialization failed: ${error.message}`);
      } else {
        const modelInfo = getModelInfo(chatState);
        const errorString = JSON.stringify(error, null, 2);
        console.error('Non-Error object in chat initialization:', errorString, 'Model info:', modelInfo);
        throw new Error(`Chat initialization failed: ${errorString}`);
      }
    }

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    if (error instanceof Error) {
      logError(`POST /api/configs/${(await params).configId}/chats`, error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    } else {
      logError(`POST /api/configs/${(await params).configId}/chats (non-Error)`, error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500 }
      );
    }
  }
}

/**
 * GET /api/configs/[configId]/chats
 * Get list of chats for a config (used by preview banner)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { configId } = await params;

    // Check if we should include preview chats
    const url = new URL(req.url);
    const includePreview = url.searchParams.get('includePreview') === 'true';

    // Get chats for this config
    const chats = await prisma.chat.findMany({
      where: {
        configId,
        userId,
        isPreview: includePreview ? undefined : false
      },
      select: {
        id: true,
        title: true,
        originType: true,
        createdAt: true,
        _count: {
          select: {
            messages: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format response
    const formattedChats = chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      originType: chat.originType,
      createdAt: chat.createdAt.toISOString(),
      messageCount: chat._count.messages
    }));

    return NextResponse.json({ chats: formattedChats });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    logError('GET /api/configs/[configId]/chats', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}