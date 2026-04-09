import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanupMemorySettingsAfterRoundDeletion } from '@/lib/utils/memory'
import { roundInputSchema } from '@/lib/schemas/round'

// GET - Get a specific round
export async function GET(
  request: Request,
  { params }: { params: Promise<{ configId: string, roundId: string }> }
) {
  try {
    const { configId, roundId } = await params
    
    const round = await prisma.chatRound.findUnique({
      where: { 
        id: roundId,
        configId 
      },
      include: {
        participants: true
      }
    })

    if (!round) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(round)
  } catch (error) {
    console.error('Error fetching round:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to fetch round' },
      { status: 500 }
    )
  }
}

// PATCH - Update a round
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ configId: string, roundId: string }> }
) {
  try {
    const { configId, roundId } = await params
    const body = await request.json()
    
    // Validate input
    const validatedData = roundInputSchema.parse(body)
    
    console.log('Updating round with validated data:', validatedData);

    // Use a transaction to ensure atomicity
    const updatedRound = await prisma.$transaction(async (tx) => {
      // Construct the update data object dynamically to avoid type issues
      // This avoids strict typing by treating it as a generic object
      const updateData: any = {
        type: validatedData.type,
        name: validatedData.name,
        icon: validatedData.icon,
        depth: validatedData.depth,
        lengthType: validatedData.lengthType,
        lengthNumber: validatedData.lengthNumber,
        lengthRounds: validatedData.lengthRounds,
        outputNumber: validatedData.outputNumber,
        sequence: validatedData.sequence,
        action: validatedData.action,
        stanceType: validatedData.stanceType,
        participantMode: validatedData.participantMode,
        participantGenerationPrompt: validatedData.participantGenerationPrompt,
        participantLengthType: validatedData.participantLengthType,
        participantLength: validatedData.participantLength,
        creativityType: validatedData.creativityType,
        creativityNumber: validatedData.creativityNumber,
        instructions: validatedData.instructions,
        showPrompts: validatedData.showPrompts,
        agentQuestions: validatedData.agentQuestions,
        agentSelfReflection: validatedData.agentSelfReflection,
        agentIsolation: validatedData.agentIsolation,
        isPrivate: validatedData.isPrivate,
        participantOrder: validatedData.participantOrder,
        moderatorAgentId: validatedData.moderatorAgentId,
        participantOrderPrompt: validatedData.participantOrderPrompt,
        lengthModerator: validatedData.lengthModerator,
        lengthPrompt: validatedData.lengthPrompt,
        transition: validatedData.transition,
        modelSelectionMode: validatedData.modelSelectionMode,
        selectedModel: validatedData.selectedModel,
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
        transitionConditions: validatedData.transitionConditions
      };
      
      // First update the round properties without touching relationships
      await tx.chatRound.update({
        where: { 
          id: roundId,
          configId 
        },
        data: updateData as any // Type assertion to bypass TypeScript checking
      });

      // Clear existing participants (direct SQL for efficiency)
      await tx.$executeRaw`DELETE FROM "_RoundParticipants" WHERE "B" = ${roundId}::uuid`;

      // Add new participants
      for (const participantId of validatedData.participants) {
        await tx.$executeRaw`
          INSERT INTO "_RoundParticipants" ("A", "B") 
          VALUES (${participantId}, ${roundId}::uuid)
        `;
      }

      // Handle stances if present
      if (validatedData.stances) {
        // Delete existing stances
        await tx.roundStance.deleteMany({
          where: { roundId }
        });

        // Create new stances
        await Promise.all(validatedData.stances.map(stance => 
          tx.roundStance.create({
            data: {
              roundId,
              agentId: stance.agentId,
              stance: stance.stance
            }
          })
        ));
      }

      // Get the final updated round with all relations
      return tx.chatRound.findUnique({
        where: { id: roundId },
        include: {
          participants: true,
          stances: true
        }
      });
    });

    if (!updatedRound) {
      return NextResponse.json(
        { error: 'Failed to update round - round not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedRound);
  } catch (error) {
    console.error('Error updating round:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to update round: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

// DELETE - Delete a specific round
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ configId: string, roundId: string }> }
) {
  try {
    const { configId, roundId } = await params
    
    // Get config to clean up memory settings
    const config = await prisma.config.findUnique({
      where: { id: configId },
      select: { memorySettings: true }
    });
    
    // Clean up memory settings using utility function
    const updatedMemorySettings = cleanupMemorySettingsAfterRoundDeletion(
      config?.memorySettings as any, 
      roundId
    );
    
    // Use transaction to delete round and update memory settings
    await prisma.$transaction(async (tx) => {
      // Clean up transition conditions in other rounds that reference this round
      const allRounds = await tx.chatRound.findMany({
        where: { configId },
        select: { id: true, transitionConditions: true }
      });

      for (const round of allRounds) {
        if (round.transitionConditions && Array.isArray(round.transitionConditions)) {
          const conditions = round.transitionConditions as Array<{ roundId: string; condition: string }>;
          const cleanedConditions = conditions.filter(c => c.roundId !== roundId);

          // Only update if conditions were actually removed
          if (cleanedConditions.length !== conditions.length) {
            await tx.chatRound.update({
              where: { id: round.id },
              data: { transitionConditions: cleanedConditions }
            });
          }
        }
      }

      // Delete the round
      await tx.chatRound.delete({
        where: {
          id: roundId,
          configId
        }
      });

      // Update memory settings if needed
      if (updatedMemorySettings) {
        await tx.config.update({
          where: { id: configId },
          data: { memorySettings: updatedMemorySettings as any }
        });
      }
    });
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting round:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to delete round' },
      { status: 500 }
    )
  }
} 