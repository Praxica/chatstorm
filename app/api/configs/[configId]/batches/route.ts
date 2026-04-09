import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    // Log params
    const resolvedParams = await params;
    console.log('Request params:', resolvedParams);
    
    // Validate user authentication and get internal UUID
    const userId = await getAuthenticatedUserId();

    // Get configId from params
    const { configId } = resolvedParams;
    
    // userId is now the internal UUID from getAuthenticatedUserId()
    
    // Verify the config belongs to the user
    const config = await prisma.config.findUnique({
      where: {
        id: configId,
        userId: userId
      }
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'Config not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch batches for this config
    const batches = await prisma.chatBatch.findMany({
      where: { 
        configId,
        userId: userId
      },
      select: {
        id: true,
        name: true,
        status: true,
        totalChats: true,
        completedChats: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
} 