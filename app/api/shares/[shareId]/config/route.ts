import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET method to retrieve config for a shared chat
// This does not require full authentication, only a valid share ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    
    // Validate the share exists and is active
    const share = await prisma.share.findFirst({
      where: {
        id: shareId,
        isActive: true,
      },
      include: {
        chat: {
          select: {
            configId: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Share not found or not active' },
        { status: 404 }
      );
    }

    // Get the config ID from the share
    const configId = share.chat.configId;

    // Fetch the config
    const config = await prisma.config.findUnique({
      where: {
        id: configId,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastUpdatedAt: true,
      },
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      );
    }
    
    // Fetch the rounds separately
    const roundsData = await prisma.chatRound.findMany({
      where: {
        configId: configId,
      },
      select: {
        id: true,
        configId: true,
        type: true,
        name: true,
      },
      orderBy: [
        { 
          // Use an explicit field that exists on ChatRound
          createdAt: 'asc' 
        }
      ],
    });

    // Return config with rounds formatted for use by client
    return NextResponse.json({
      id: config.id,
      title: config.title,
      // Only include fields we know exist in the database
      rounds: roundsData.map(round => ({
        id: round.id,
        configId: round.configId,
        type: round.type,
        name: round.name || "Unnamed Round",
      })),
      createdAt: config.createdAt,
      lastUpdatedAt: config.lastUpdatedAt,
    });
  } catch (error) {
    console.error('Error fetching config for share:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
} 