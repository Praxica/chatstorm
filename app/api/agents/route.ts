import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { AgentService } from '@/lib/services/AgentService'
import { prisma } from '@/lib/prisma'

// GET /api/agents - Get all agents
export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    const { searchParams } = new URL(request.url)
    const includeDynamic = searchParams.get('includeDynamic') === 'true'
    
    const agents = await AgentService.getAgents(userId, { includeDynamic });

    return NextResponse.json(agents);
  } catch (error) {
    console.error('GET /api/agents error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}

// POST /api/agents - Create new agent
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    const agent = await req.json()
    const { projectIds, ...otherData } = agent;
    
    const result = await prisma.chatAgent.create({
      data: {
        ...otherData,
        userId: userId,
        projects: projectIds ? {
          connect: projectIds.map((id: string) => ({ id }))
        } : undefined
      },
      include: {
        projects: {
          select: {
            id: true
          }
        }
      }
    });

    // Transform the response to match the expected format
    return NextResponse.json({
      ...result,
      projectIds: result.projects.map(p => p.id)
    });
  } catch (error) {
    console.error('POST /api/agents error:', error)
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    )
  }
} 