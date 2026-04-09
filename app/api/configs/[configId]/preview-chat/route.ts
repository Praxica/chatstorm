import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { ChatService } from '@/lib/services/ChatService';

/**
 * GET /api/configs/[configId]/preview-chat
 * Get or create the preview chat for a config
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { configId } = await params;

    // Get or create preview chat
    const previewChat = await ChatService.getOrCreatePreviewChat(configId, userId);

    return NextResponse.json({
      chatId: previewChat.id,
      title: previewChat.title
    });
  } catch (error) {
    console.error('[GET /api/configs/[configId]/preview-chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get preview chat' },
      { status: 500 }
    );
  }
}
