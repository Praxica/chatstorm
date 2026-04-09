import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AgentService } from '@/lib/services/AgentService';

// GET method to retrieve agents for a share
// This endpoint is public and does not require authentication
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  try {
    // First validate that the share exists and is active
    const share = await prisma.share.findUnique({
      where: {
        id: shareId,
        isActive: true
      },
      select: {
        chat: {
          select: {
            configId: true // Need configId to find related agents
          }
        }
      }
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Share not found or not active' },
        { status: 404 }
      );
    }

    if (!share.chat?.configId) {
      return NextResponse.json(
        { error: 'Share has no configuration to derive agents from' },
        { status: 404 }
      );
    }

    // Use the direct service method to get agents
    const agents = await AgentService.getAgentsFromConfig(share.chat.configId);

    return NextResponse.json(agents);
  } catch (error) {
    console.error('[Share Agents API] Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
} 