import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/preview/[templateId]
 * Retrieves the template preview content (template details and messages for its previewChatId)
 * This endpoint is public and does not require authentication
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Missing template ID' },
        { status: 400 }
      );
    }

    try {
      // Get the template
      const template = await prisma.template.findUnique({
        where: {
          id: templateId,
          isPublic: true, // Only allow access to public templates
        },
        select: {
          id: true,
          title: true,
          previewChatId: true,
          configId: true, // Important for loading the correct config/rounds
          // Add any other template fields needed for the preview
        },
      });

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found or not public' },
          { status: 404 }
        );
      }

      if (!template.previewChatId) {
        return NextResponse.json(
          { error: 'Template does not have a preview chat configured' },
          { status: 404 } // Or a different status code like 400 if it's a bad request
        );
      }
      
      // If template exists, but no configId, treat as an error
      if (!template.configId) {
        return NextResponse.json(
            { error: 'Template is missing configuration ID.' },
            { status: 500 } // Internal server error as this is an invalid state
        );
      }

      // Get all messages for the template's previewChatId
      const messages = await prisma.message.findMany({
        where: {
          chatId: template.previewChatId,
          isActive: true, // Assuming you only want active messages
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Unlike shares, templates don't have their own accessCount or lastMessageId.
      // The "preview" object here will be simpler, mainly carrying template info.
      return NextResponse.json({
        preview: {
          id: template.id,
          title: template.title,
          configId: template.configId,
          previewChatId: template.previewChatId,
          // Include other relevant template details here if needed by the frontend
        },
        // We are not returning a full "chat" object like in shares, as the preview is tied to a template.
        // The essential chat-related info (previewChatId, configId, title) is in the `preview` object.
        messages: messages, 
      });

    } catch (dbError) {
      console.error('Database error retrieving template preview:', dbError);
      return NextResponse.json(
        { error: 'Database error while retrieving template preview' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error retrieving template preview:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to retrieve template preview' },
      { status: 500 }
    );
  }
}