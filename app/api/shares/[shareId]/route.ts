import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';

/**
 * GET /api/shares/[shareId]
 * Retrieves the shared chat content
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    
    if (!shareId) {
      return NextResponse.json(
        { error: 'Missing share ID' },
        { status: 400 }
      );
    }

    try {
      // First find the share
      const share = await prisma.share.findFirst({
        where: {
          id: shareId,
          isActive: true,
        },
        include: {
          chat: {
            select: {
              id: true,
              title: true,
              configId: true,
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

      // Then update the access count
      await prisma.share.update({
        where: {
          id: shareId,
        },
        data: {
          accessCount: {
            increment: 1,
          },
          lastAccessedAt: new Date(),
        },
      });

      // Get all messages up to the lastMessageId in this share
      const messages = await prisma.message.findMany({
        where: {
          chatId: share.chatId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Find the position of the last message
      const lastMessageIndex = messages.findIndex(
        (message) => message.id === share.lastMessageId
      );

      // Include messages only up to lastMessageId
      const includedMessages = lastMessageIndex >= 0 
        ? messages.slice(0, lastMessageIndex + 1) 
        : messages;

      return NextResponse.json({
        share,
        chat: {
          id: share.chat.id,
          title: share.chat.title,
          configId: share.chat.configId,
        },
        messages: includedMessages,
      });
    } catch (dbError) {
      console.error('[Share Retrieval] Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error while retrieving share' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error retrieving share:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to retrieve share' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shares/[shareId]
 * Deactivates a share
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    
    if (!shareId) {
      return NextResponse.json(
        { error: 'Missing share ID' },
        { status: 400 }
      );
    }
    
    // Get internal user ID using the utility function
    const userId = await getAuthenticatedUserId();

    try {
      // Find the share first to verify ownership
      const share = await prisma.share.findFirst({
        where: {
          id: shareId,
        },
        select: {
          createdById: true,
        },
      });

      if (!share) {
        return NextResponse.json(
          { error: 'Share not found' },
          { status: 404 }
        );
      }

      // Verify ownership
      if (share.createdById !== userId) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this share' },
          { status: 403 }
        );
      }

      // Deactivate the share
      await prisma.share.update({
        where: {
          id: shareId,
        },
        data: {
          isActive: false,
        },
      });

      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('Database error deactivating share:', dbError);
      return NextResponse.json(
        { error: 'Database error while deactivating share' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deactivating share:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to deactivate share' },
      { status: 500 }
    );
  }
} 