import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, validateReadAccess } from '@/lib/utils/auth'

interface ConfigChat {
  configId: string;
  configTitle: string;
  chatCount: number;
  lastChatId: string | null;
  lastChatAt: Date | null;
  roundType: string | null;
}

interface ExtendedChat {
  id: string;
  configId: string;
  updatedAt: Date;
  config: {
    title: string;
    rounds: {
      type: string;
    }[];
  };
}

export async function GET(request: Request) {
  try {
    // Validate read access
    await validateReadAccess();
    
    // Get the user ID
    const userId = await getAuthenticatedUserId();
    
    // Get spaceId from query params if provided
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId');

    // Query all chats for the user, including the config title
    // Filter by spaceId if provided
    // Exclude preview chats from the main chat list
    const chats = await prisma.chat.findMany({
      where: {
        userId,
        isPreview: false, // Exclude preview chats
        ...(spaceId && {
          config: {
            spaceId: spaceId
          }
        })
      },
      include: {
        config: {
          select: {
            id: true,
            title: true,
            rounds: {
              select: {
                type: true
              },
              take: 1
            }
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    }) as unknown as ExtendedChat[];

    // Group chats by config
    const chatsByConfig: Record<string, ConfigChat> = {};

    for (const chat of chats) {
      const configId = chat.configId;
      
      if (!chatsByConfig[configId]) {
        chatsByConfig[configId] = {
          configId,
          configTitle: chat.config.title,
          chatCount: 0,
          lastChatId: null,
          lastChatAt: null,
          roundType: chat.config.rounds[0]?.type || null
        };
      }
      
      chatsByConfig[configId].chatCount += 1;
      
      // Update the last chat info if this is the most recent chat for this config
      if (!chatsByConfig[configId].lastChatAt || chat.updatedAt > chatsByConfig[configId].lastChatAt!) {
        chatsByConfig[configId].lastChatId = chat.id;
        chatsByConfig[configId].lastChatAt = chat.updatedAt;
      }
    }

    return NextResponse.json(Object.values(chatsByConfig));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching all chats:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch chats', details: errorMessage },
      { status: 500 }
    );
  }
} 