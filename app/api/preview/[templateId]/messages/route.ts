import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MessageService } from '@/lib/services/MessageService';

// GET method to retrieve messages for a template preview
// This endpoint is public and does not require authentication
export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  console.log('[Preview Messages API] GET request for template:', templateId);
  try {
    // First validate that the template exists and is public
    const template = await prisma.template.findUnique({
      where: {
        id: templateId,
        isPublic: true
      },
      select: {
        previewChatId: true
      }
    });

    if (!template) {
      console.log('[Preview Messages API] Template not found or not public:', templateId);
      return NextResponse.json(
        { error: 'Template not found or not public' },
        { status: 404 }
      );
    }

    if (!template.previewChatId) {
      console.log('[Preview Messages API] Template has no preview chat:', templateId);
      return NextResponse.json(
        { error: 'Template has no preview chat configured' },
        { status: 404 }
      );
    }

    // Get messages as UIMessage format (includes parts with dialogue data)
    const messages = await MessageService.getUIMessagesByChat(template.previewChatId);

    console.log('[Preview Messages API] Messages found, count:', messages.length);

    return NextResponse.json(messages);
  } catch (error) {
    console.error('[Preview Messages API] Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
} 