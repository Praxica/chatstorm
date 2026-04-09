import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { AgentService } from '@/lib/services/AgentService'

// GET /api/configs/[configId]/agents - Get all agents associated with rounds in a config
export async function GET(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    const _userId = await getAuthenticatedUserId()

    // First, verify the user has access to this config
    const config = await prisma.config.findUnique({
      where: { 
        id: configId,
      },
      select: { userId: true }
    })

    // Check if config exists and user has access
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    // Use the centralized service to get agents
    const agents = await AgentService.getAgentsFromConfig(configId)

    console.log(`GET /api/configs/${configId}/agents - Returning ${agents.length} agents (including moderators)`)
    return NextResponse.json(agents)
  } catch (error) {
    console.error('Error fetching agents:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
} 