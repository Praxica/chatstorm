import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { DataTool } from '@/types/config-round';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ configId: string; roundId: string }> }
) {
  try {
    const { targetRoundIds } = await request.json();
    const { roundId } = await params;

    // Get the source round's data tool
    const sourceRound = await prisma.chatRound.findUnique({
      where: {
        id: roundId,
      },
      select: {
        dataTool: true,
      },
    });

    if (!sourceRound?.dataTool) {
      return NextResponse.json(
        { error: 'Source round has no data tool' },
        { status: 400 }
      );
    }

    // Cast the source dataTool from JsonValue to our DataTool type
    const sourceDataTool = sourceRound.dataTool as unknown as DataTool;

    // Update each target round
    const updates = targetRoundIds.map(async (targetRoundId: string) => {
      const targetRound = await prisma.chatRound.findUnique({
        where: {
          id: targetRoundId,
        },
        select: {
          dataTool: true,
        },
      });

      // Cast the target dataTool from JsonValue to our DataTool type
      const targetDataTool = targetRound?.dataTool as unknown as DataTool | null;

      // Merge the data tools
      const mergedDataTool = {
        ...(targetDataTool ?? {}),
        parameters: [
          ...(targetDataTool?.parameters || []),
          ...sourceDataTool.parameters,
        ],
        instructions: targetDataTool?.instructions
          ? `${targetDataTool.instructions}\n\n${sourceDataTool.instructions}`
          : sourceDataTool.instructions,
      };

      // Update the target round
      return prisma.chatRound.update({
        where: {
          id: targetRoundId,
        },
        data: {
          dataTool: mergedDataTool as unknown as Prisma.InputJsonValue,
        },
      });
    });

    await Promise.all(updates);

    // Fetch and return the updated rounds for the current config 
    const updatedRounds = await prisma.chatRound.findMany({
      where: {
        id: { in: targetRoundIds },
      },
    });

    return NextResponse.json({ success: true, updatedRounds });
  } catch (error) {
    console.error('Error copying parameters:', error);
    return NextResponse.json(
      { error: 'Failed to copy parameters' },
      { status: 500 }
    );
  }
} 