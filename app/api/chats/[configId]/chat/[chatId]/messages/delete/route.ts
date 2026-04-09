import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/utils/error';

/**
 * POST /api/chats/[configId]/chat/[chatId]/messages/delete
 * Soft-delete messages (for replay functionality)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { configId: _configId, chatId } = await params;
    const { messageIds } = await req.json();

    if (!messageIds || !Array.isArray(messageIds)) {
      return NextResponse.json(
        { error: 'messageIds array is required' },
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

    // Soft delete messages
    const result = await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        chatId: chatId
      },
      data: { isActive: false }
    });

    console.log(`[API] Soft-deleted ${result.count} messages from chat ${chatId}`);

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    });
  } catch (err) {
    logError('Delete messages', err);
    return NextResponse.json(
      { error: 'Failed to delete messages' },
      { status: 500 }
    );
  }
}
