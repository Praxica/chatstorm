import { prisma } from '@/lib/prisma'
import { NextResponse, NextRequest } from 'next/server'
import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth'
import { getSpaceId, addSpaceFilter } from '@/lib/utils/space-aware'
import { ROUND_DEFAULTS } from '@/lib/schemas/round'

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    const spaceId = getSpaceId(req);
    
    const configs = await prisma.config.findMany({
      where: addSpaceFilter({ userId }, spaceId),
      orderBy: {
        lastUpdatedAt: 'desc'
      },
      include: {
        rounds: {
          orderBy: { sequence: 'asc' }
        },
        projects: {
          select: {
            id: true
          }
        }
      }
    })
    return NextResponse.json(configs)
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    const data = await req.json()
    
    // Get spaceId from request body or query params
    const spaceId = data.spaceId || getSpaceId(req);
    
    const roundsToCreate = (Array.isArray(data.rounds) && data.rounds.length > 0)
      ? data.rounds
      : (data.type
          ? [{
              id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined,
              type: data.type,
              depth: ROUND_DEFAULTS.depth,
              lengthType: 'total',
              lengthNumber: 1,
              lengthRounds: 1,
              sequence: 0,
              participantOrder: ROUND_DEFAULTS.participantOrder,
              transition: ROUND_DEFAULTS.transition,
              createdAt: new Date(),
              updatedAt: new Date()
            }]
          : []);
    
    const config = await prisma.config.create({
      data: {
        id: data.id,
        title: data.title,
        userId,
        spaceId, // Add space context to new configs
        createdAt: data.createdAt,
        lastUpdatedAt: data.lastUpdatedAt,
        rounds: {
          create: roundsToCreate.map((round: any) => ({
            id: round.id,
            type: round.type,
            depth: round.depth,
            lengthType: round.lengthType,
            lengthNumber: round.lengthNumber,
            lengthRounds: round.lengthRounds,
            sequence: round.sequence,
            participantOrder: round.participantOrder,
            moderatorAgentId: round.moderatorAgentId,
            participantOrderPrompt: round.participantOrderPrompt,
            lengthModerator: round.lengthModerator,
            lengthPrompt: round.lengthPrompt,
            transition: round.transition,
            createdAt: round.createdAt || new Date(),
            updatedAt: round.updatedAt || new Date()
          }))
        },
        designSettings: data.designSettings ?? { showRoundTitles: true },
        projects: {
          connect: data.projectIds?.map((id: string) => ({ id })) || []
        }
      },
      include: {
        rounds: true,
        projects: {
          select: {
            id: true
          }
        }
      }
    })
    
    return NextResponse.json(config)
  } catch (error) {
    return handleAuthError(error);
  }
} 