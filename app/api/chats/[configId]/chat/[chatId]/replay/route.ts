import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/utils/error';
import { dbMessageToUIMessage } from '@/lib/utils/uiMessage';
import { getData as getUIData } from '@/lib/chat/services/ui-message';
import type { ChatProgress } from '@/lib/types/chat-progress';

/**
 * POST /api/chats/[configId]/chat/[chatId]/replay
 * Handles message replay by deleting target message and subsequent messages,
 * determining the correct progress state, and returning instructions for client
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { configId, chatId } = await params;
    const { messageId } = await req.json();

    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json(
        { error: 'messageId is required and must be a string' },
        { status: 400 }
      );
    }

    // Auth check: User must own the chat
    const chat = await prisma.chat.findUnique({
      where: { id: chatId, userId },
      select: { id: true }
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or unauthorized' },
        { status: 404 }
      );
    }

    // Get all active messages for this chat, ordered by creation
    const allMessages = await prisma.message.findMany({
      where: {
        chatId,
        isActive: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Find the target message by database ID (direct lookup)
    const targetIndex = allMessages.findIndex(m => m.id === messageId);

    if (targetIndex === -1) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const targetMessage = allMessages[targetIndex];
    const isUserMessage = targetMessage.role === 'user';

    // Determine which messages to keep and delete
    const messagesToKeep = allMessages.slice(0, targetIndex);
    const messagesToDelete = allMessages.slice(targetIndex);

    // Soft delete messages on server
    if (messagesToDelete.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: messagesToDelete.map(m => m.id) }
        },
        data: { isActive: false }
      });
    }

    // Determine progress state by looking backwards through remaining messages
    let progress: ChatProgress | null = null;
    let userInput: string | undefined = undefined;

    if (messagesToKeep.length === 0) {
      // No messages left - need to initialize with first round
      // Load config to get first round
      const config = await prisma.config.findUnique({
        where: { id: configId },
        select: {
          rounds: {
            orderBy: { sequence: 'asc' },
            take: 1
          }
        }
      });

      const firstRound = config?.rounds[0];
      if (firstRound) {
        // Create minimal progress for first round
        progress = {
          active: {
            round: {
              id: firstRound.id,
              order: firstRound.sequence
            }
          }
        } as unknown as ChatProgress;
      }
    } else {
      // Look backwards through messages to find progress from last ASSISTANT message
      // Skip user messages because they don't have progress data (e.g., "next agent" shortcuts)
      for (let i = messagesToKeep.length - 1; i >= 0; i--) {
        const msg = messagesToKeep[i];

        // Skip user messages - only assistant messages have progress data
        if (msg.role === 'user') {
          continue;
        }

        const uiMessage = dbMessageToUIMessage(msg);

        // Try to get full progress from assistant message
        const progressData = getUIData(uiMessage, 'progress') || (msg.metadata as any)?.progress;
        if (progressData) {
          progress = progressData;

          // IMPORTANT: Handle session ID based on round completion state
          if (progressData.active?.round?.isComplete && progressData.next?.round?.id) {
            // Round is complete, transitioning to next round
            // Look for existing session for the next round (created in natural flow)
            const nextRoundSession = await prisma.chatRoundSession.findFirst({
              where: {
                chatId: chatId,
                roundId: progressData.next.round.id
              },
              orderBy: {
                startedAt: 'desc'
              }
            });

            if (nextRoundSession && progress) {
              // Reuse existing next round session
              (progress.next as any).session = { id: nextRoundSession.id };
            }
          } else if (msg.chatRoundSessionId && progress?.active) {
            // Round is not complete, reuse current session
            (progress.active as any).session = { id: msg.chatRoundSessionId };
          }
          break;
        }

        // Fall back to roundId in metadata (agent messages always have this)
        const roundId = (msg.metadata as any)?.roundId;
        if (roundId) {
          // Load the round to get sequence
          const round = await prisma.chatRound.findUnique({
            where: { id: roundId },
            select: { sequence: true }
          });

          if (round) {
            // Create minimal progress for this round
            progress = {
              active: {
                round: {
                  id: roundId,
                  order: round.sequence
                }
              }
            } as unknown as ChatProgress;

            // IMPORTANT: Add session ID from message so backend reuses existing session
            if (msg.chatRoundSessionId) {
              (progress.active as any).session = { id: msg.chatRoundSessionId };
            }
            break;
          }
        }
      }

      // If still no progress found, fall back to first round
      if (!progress) {
        const config = await prisma.config.findUnique({
          where: { id: configId },
          select: {
            rounds: {
              orderBy: { sequence: 'asc' },
              take: 1
            }
          }
        });

        const firstRound = config?.rounds[0];
        if (firstRound) {
          progress = {
            active: {
              round: {
                id: firstRound.id,
                order: firstRound.sequence
              }
            }
          } as unknown as ChatProgress;
        }
      }
    }

    // For user messages, extract the text content for the input field
    if (isUserMessage) {
      const uiMessage = dbMessageToUIMessage(targetMessage);
      const textPart = uiMessage.parts?.find((p: any) => p.type === 'text') as { type: string; text: string } | undefined;
      userInput = textPart?.text || '';
    }

    // Get any dynamic agents created during this chat
    // These need to be reloaded into the client store on replay
    const dynamicAgents = await prisma.chatAgent.findMany({
      where: {
        isDynamic: true,
        chatRoundSession: {
          chatId: chatId
        }
      }
    });

    // Return replay state to client
    return NextResponse.json({
      deletedMessageIds: messagesToDelete.map(m => m.id),
      progress,
      shouldRegenerate: !isUserMessage,
      userInput,
      dynamicAgents
    });

  } catch (err) {
    logError('Replay failed', err);
    return NextResponse.json(
      { error: 'Failed to process replay' },
      { status: 500 }
    );
  }
}
