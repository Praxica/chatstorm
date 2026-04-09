import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { ChatService } from '@/lib/services/ChatService';

/**
 * POST /api/shares/[shareId]/copy
 * Copies a shared chat to the current user's account
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { shareId } = await params;

    if (!shareId) {
      return NextResponse.json(
        { error: 'Missing share ID' },
        { status: 400 }
      );
    }

    try {
      // Find the share
      const share = await prisma.share.findFirst({
        where: {
          id: shareId,
          isActive: true,
        },
        include: {
          chat: {
            include: {
              config: true,
            },
          },
        },
      });

      if (!share) {
        return NextResponse.json(
          { error: 'Share not found or no longer active' },
          { status: 404 }
        );
      }

      // Use ChatService to copy the chat (DRY!)
      const newChat = await ChatService.copyChat({
        sourceChatId: share.chatId,
        targetUserId: userId,
        title: `Copy of ${share.chat.title}`,
        includeMessagesUpTo: share.lastMessageId, // Only copy up to shared message
        originType: 'copy',
        isPreview: false
      });

      return NextResponse.json({
        success: true,
        chatId: newChat.id,
        redirectUrl: `/chats/${share.chat.configId}/chat/${newChat.id}`,
      });
    } catch (dbError) {
      console.error('Database error copying shared chat:', dbError);
      return NextResponse.json(
        { error: 'Database error while copying shared chat' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error copying shared chat:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to copy shared chat' },
      { status: 500 }
    );
  }
} 