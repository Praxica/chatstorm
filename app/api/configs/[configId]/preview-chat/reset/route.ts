import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/configs/[configId]/preview-chat/reset
 * Delete the current preview chat and reset the config's previewChatId
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { configId } = await params;

    // Get the config to find the current preview chat
    const config = await prisma.config.findUnique({
      where: { id: configId, userId },
      select: { previewChatId: true }
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      );
    }

    // If there's a preview chat, delete it
    if (config.previewChatId) {
      await prisma.$transaction([
        // Delete shares
        prisma.share.deleteMany({
          where: { chatId: config.previewChatId }
        }),
        // Delete branches
        prisma.branch.deleteMany({
          where: { chatId: config.previewChatId }
        }),
        // Delete messages
        prisma.message.deleteMany({
          where: { chatId: config.previewChatId }
        }),
        // Delete round sessions
        prisma.chatRoundSession.deleteMany({
          where: { chatId: config.previewChatId }
        }),
        // Delete the chat
        prisma.chat.delete({
          where: { id: config.previewChatId }
        }),
        // Clear the previewChatId from config
        prisma.config.update({
          where: { id: configId },
          data: { previewChatId: null }
        })
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/configs/[configId]/preview-chat/reset] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset preview chat' },
      { status: 500 }
    );
  }
}
