import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/utils/error'
import { roundInputSchema } from '@/lib/schemas/round'

// POST route requires client-provided ID
const roundCreateSchema = roundInputSchema.extend({
  id: z.string(),
})

// GET - Get all rounds for a config
export async function GET(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    
    const rounds = await prisma.chatRound.findMany({
      where: { configId },
      include: { 
        participants: { 
          select: { id: true } 
        },
        stances: {
          select: {
            agentId: true,
            stance: true
          }
        }
      },
      orderBy: { sequence: 'asc' }
    })

    return NextResponse.json(rounds)
  } catch (error) {
    logError('Fetching rounds list', error)
    return NextResponse.json(
      { error: 'Failed to fetch rounds' },
      { status: 500 }
    )
  }
}

// POST - Create a new round
export async function POST(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params
    const data = await request.json()
    
    // Validate input data
    const validatedData = roundCreateSchema.parse(data)

    // Check if config has projects and get agents if needed
    const config = await prisma.config.findUnique({
      where: { id: configId },
      include: {
        projects: {
          include: {
            agents: {
              where: {
                isActive: true // Only get active agents
              },
              take: 10, // Limit to 10 agents
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    })

    // Determine participants based on project agents
    let participantIds = validatedData.participants

    // Only auto-assign project agents if frontend sent no participants
    if (config && config.projects.length > 0 && (!validatedData.participants || validatedData.participants.length === 0)) {
      // Collect all agents from all projects (up to 10 total)
      const projectAgents: string[] = []
      for (const project of config.projects) {
        for (const agent of project.agents) {
          if (!projectAgents.includes(agent.id) && projectAgents.length < 10) {
            projectAgents.push(agent.id)
          }
        }
      }

      // Use project agents if we found any
      if (projectAgents.length > 0) {
        // For review rounds, only use one agent
        if (validatedData.type === 'review') {
          participantIds = projectAgents.slice(0, 1)
        } else {
          participantIds = projectAgents
        }
      }
    }
    
    // Create round in a transaction
    const createdRound = await prisma.$transaction(async (prisma) => {
      // Create the round
      const round = await prisma.chatRound.create({
        data: {
          id: validatedData.id,
          configId,
          type: validatedData.type,
          name: validatedData.name,
          icon: validatedData.icon,
          depth: validatedData.depth,
          lengthType: validatedData.lengthType,
          lengthNumber: validatedData.lengthNumber,
          lengthRounds: validatedData.lengthRounds,
          outputNumber: validatedData.outputNumber,
          sequence: validatedData.sequence,
          // Participant configuration
          participantMode: validatedData.participantMode,
          participantGenerationPrompt: validatedData.participantGenerationPrompt,
          participantLengthType: validatedData.participantLengthType,
          participantLength: validatedData.participantLength,
          action: validatedData.action,
          stanceType: validatedData.stanceType,
          participantOrder: validatedData.participantOrder,
          moderatorAgentId: validatedData.moderatorAgentId,
          participantOrderPrompt: validatedData.participantOrderPrompt,
          lengthModerator: validatedData.lengthModerator,
          lengthPrompt: validatedData.lengthPrompt,
          transition: validatedData.transition,
          creativityType: validatedData.creativityType,
          creativityNumber: validatedData.creativityNumber,
          instructions: validatedData.instructions,
          showPrompts: validatedData.showPrompts,
          agentQuestions: validatedData.agentQuestions,
          agentSelfReflection: validatedData.agentSelfReflection,
          modelSelectionMode: validatedData.modelSelectionMode,
          selectedModel: validatedData.selectedModel,
          agentIsolation: validatedData.agentIsolation,
          isPrivate: validatedData.isPrivate,
          dataTool: validatedData.dataTool,
          retentionSettings: validatedData.retentionSettings,
          
          // Dialogue fields
          dialogueSenderMode: validatedData.dialogueSenderMode,
          dialogueSelectedSenders: validatedData.dialogueSelectedSenders,
          dialogueSenderInstructions: validatedData.dialogueSenderInstructions,
          dialogueSenderModerator: validatedData.dialogueSenderModerator,
          dialogueReceiverMode: validatedData.dialogueReceiverMode,
          dialogueSelectedReceivers: validatedData.dialogueSelectedReceivers,
          dialogueReceiverInstructions: validatedData.dialogueReceiverInstructions,
          dialogueReceiverModerator: validatedData.dialogueReceiverModerator,
          dialogueInitialMessageMode: validatedData.dialogueInitialMessageMode,
          dialogueInitialMessage: validatedData.dialogueInitialMessage,
          dialogueInitialMessageInstructions: validatedData.dialogueInitialMessageInstructions,
          dialogueInstructionsMode: validatedData.dialogueInstructionsMode,
          dialogueInstructions: validatedData.dialogueInstructions,
          dialogueInstructionsPrompt: validatedData.dialogueInstructionsPrompt,
          dialogueLengthMode: validatedData.dialogueLengthMode,
          dialogueLength: validatedData.dialogueLength,
          dialogueLengthInstructions: validatedData.dialogueLengthInstructions,
          dialogueLengthModerator: validatedData.dialogueLengthModerator,
          
          // Message sender fields for non-dialogue rounds
          messageSenderMode: validatedData.messageSenderMode,
          messageSenderInstructions: validatedData.messageSenderInstructions,
          messageSenderModerator: validatedData.messageSenderModerator,
          
          // Conditional transition fields
          transitionModerator: validatedData.transitionModerator,
          transitionPrompt: validatedData.transitionPrompt,
          transitionConditions: validatedData.transitionConditions,
          
          participants: {
            connect: participantIds.map(id => ({ id }))
          }
        } as any, // Type assertion to bypass TypeScript checking
        include: {
          participants: true
        }
      })

      // If there are stances to create, do it after the round creation
      if (validatedData.stances && validatedData.stances.length > 0) {
        await prisma.roundStance.createMany({
          data: validatedData.stances.map(stance => ({
            roundId: round.id,
            agentId: stance.agentId,
            stance: stance.stance
          }))
        })
      }

      return round
    })

    return NextResponse.json(createdRound)
  } catch (error) {
    logError('Creating new round', error)
    return NextResponse.json(
      { error: 'Failed to create round' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ configId: string }>}
) {
  try {
    const { configId } = await params;
    
    await prisma.chatRound.deleteMany({
      where: { configId }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rounds:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to delete rounds' },
      { status: 500 }
    )
  }
} 