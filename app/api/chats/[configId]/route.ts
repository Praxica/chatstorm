import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, validateReadAccess } from '@/lib/utils/auth'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    
    // First validate read access
    await validateReadAccess();
    
    // Then get the user ID for business logic
    const userId = await getAuthenticatedUserId();

    // Validate config exists
    const config = await prisma.config.findUnique({
      where: { id: configId },
      select: { id: true, userId: true }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      )
    }

    const chats = await prisma.chat.findMany({
      where: {
        configId,
        userId,
        isPreview: false // Exclude preview chats
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    return NextResponse.json(chats)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching chats:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to fetch chats', details: errorMessage },
      { status: 500 }
    )
  }
} 