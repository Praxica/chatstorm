import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'

export async function POST(req: Request) {
  try {
    const { agentIds } = await req.json()
    const userId = await getAuthenticatedUserId()
    
    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: agentIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Verify all agents belong to user
    const agents = await prisma.chatAgent.findMany({
      where: {
        id: { in: agentIds },
        userId: userId
      }
    })

    if (agents.length !== agentIds.length) {
      return NextResponse.json(
        { error: 'One or more agents not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete all agents in a transaction
    await prisma.$transaction(async (prisma) => {
      // First delete any round stances associated with these agents
      await prisma.roundStance.deleteMany({
        where: {
          agentId: {
            in: agentIds
          }
        }
      })

      // Then delete the agents
      await prisma.chatAgent.deleteMany({
        where: {
          id: {
            in: agentIds
          },
          userId: userId
        }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting agents:', error)
    return NextResponse.json(
      { error: 'Failed to delete agents' },
      { status: 500 }
    )
  }
} 