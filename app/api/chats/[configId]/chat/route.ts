import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, handleAuthError, UnauthorizedError } from '@/lib/utils/auth';
import { ChatService } from '@/lib/services/ChatService'; // Import ChatService module

// POST /api/chats/[configId]/chat
// Creates a new chat for a given config ID
export async function POST(req: NextRequest, { params }: { params: Promise<{ configId: string }> }) {
  const { configId } = await params;

  try {
    const userId = await getAuthenticatedUserId();
    const body = await req.json();
    const { title, initialMessage } = body;

    if (!configId) {
      return NextResponse.json({ error: 'Config ID is required' }, { status: 400 });
    }

    // Use ChatService module directly
    const newChat = await ChatService.createInitialChat({
      configId,
      userId,
      title,
      initialMessage,
    });

    // Return the necessary info for the client
    return NextResponse.json({
      id: newChat.id,
      title: newChat.title,
      createdAt: newChat.createdAt,
    });

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return handleAuthError(error);
    }
    // Handle specific error from ChatService if needed (e.g., no rounds)
    if (error instanceof Error && error.message.includes('No rounds configured')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}