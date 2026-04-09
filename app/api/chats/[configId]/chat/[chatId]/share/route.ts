import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';

/**
 * POST /api/chats/[configId]/chat/[chatId]/share
 * Creates a new share for the specified chat
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string; chatId: string }> }
) {
  try {
    // Get internal user ID using the utility function
    const userId = await getAuthenticatedUserId();

    // Extract params safely
    const { configId, chatId } = await params;
    
    if (!configId || !chatId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    try {
      // Verify chat exists and belongs to the user
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          configId: configId,
          userId: userId,
        },
      });
      
      if (!chat) {
        return NextResponse.json(
          { error: 'Chat not found or access denied' },
          { status: 404 }
        );
      }

      // Get the latest message in the active branch
      const messages = await prisma.message.findMany({
        where: {
          chatId: chatId,
          isActive: true,
          ...(chat.activeBranch ? { branchId: chat.activeBranch } : {})
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      if (messages.length === 0) {
        return NextResponse.json(
          { error: 'Chat has no messages to share' },
          { status: 400 }
        );
      }

      const lastMessageId = messages[0].id;

      // Create the share
      const share = await prisma.share.create({
        data: {
          chatId: chatId,
          createdById: userId,
          lastMessageId: lastMessageId,
          isActive: true,
        },
      });

      return NextResponse.json({
        shareId: share.id,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${share.id}`,
      });
    } catch (dbError) {
      console.error('Database error creating share:', dbError);
      return NextResponse.json(
        { error: 'Database error while creating share' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating share:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    );
  }
} 