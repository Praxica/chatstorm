import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { ChatService } from '@/lib/services/ChatService';

/**
 * POST /api/configs/[configId]/copy-to-preview
 * Copy a live or batch chat to the preview workspace
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { configId } = await params;
    const { sourceChatId } = await req.json();

    if (!sourceChatId) {
      return NextResponse.json(
        { error: 'sourceChatId is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Copying chat ${sourceChatId} to preview for config ${configId}`);

    const previewChat = await ChatService.copyToPreview(sourceChatId, userId);

    return NextResponse.json({
      success: true,
      chatId: previewChat.id,
      title: previewChat.title
    });
  } catch (error) {
    console.error('[API] Error copying to preview:', error);

    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to copy chat to preview' },
      { status: 500 }
    );
  }
}
