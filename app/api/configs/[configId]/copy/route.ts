import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { ConfigService } from '@/lib/services/ConfigService'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    
    // Get the current user
    const userId = await getAuthenticatedUserId();
    
    // Find the source config with all its rounds and stances
    const sourceConfig = await prisma.config.findUnique({
      where: { id: configId },
      include: {
        rounds: {
          include: {
            participants: true,
            stances: true
          },
          orderBy: { sequence: 'asc' }
        },
        projects: true
      }
    })

    if (!sourceConfig) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      )
    }

    // Get parameters from request
    const { title, appendToAgentNames = '' } = await request.json()

    // Use the unified ConfigService method for same-user copying
    // Preserve the spaceId if the source config belongs to a space
    const updatedConfig = await ConfigService.copyConfig(
      sourceConfig,
      userId,
      {
        // If title is provided, use it as the complete replacement
        // Otherwise append ' Copy' to the original title
        appendToTitle: title ? '' : ' Copy',
        appendToAgentNames,
        reuseAgents: true, // Reuse existing agents for same-user copy
        reuseProjects: true, // Reuse existing projects for same-user copy
        spaceId: sourceConfig.spaceId ?? undefined // Preserve space assignment
      }
    )

    // If a custom title was provided, update it after creation
    if (title && updatedConfig) {
      await prisma.config.update({
        where: { id: updatedConfig.id },
        data: { title }
      })
      updatedConfig.title = title
    }

    console.log('[copy/route] Config copied:', {
      sourceConfigId: configId,
      sourceSpaceId: sourceConfig.spaceId,
      newConfigId: updatedConfig?.id,
      newConfigSpaceId: updatedConfig?.spaceId,
      spacePreserved: sourceConfig.spaceId === updatedConfig?.spaceId
    })

    return NextResponse.json(updatedConfig)
  } catch (error) {
    console.error('Error copying config:', error instanceof Error ? error.message : error)
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to copy config' },
      { status: 500 }
    )
  }
} 