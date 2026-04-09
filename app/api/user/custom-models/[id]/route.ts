import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/error';

// PUT - Update an existing custom model
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const body = await req.json();
    const { name, provider, modelId, apiKey, baseURL } = body;

    if (!name || !provider || !modelId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    let dbProvider = provider;
    if (provider === 'Custom (OpenAI-compatible)') {
      dbProvider = 'custom';
    }

    // Find the existing model to ensure it belongs to the user
    const existingModel = await prisma.customModel.findFirst({
      where: { id, userId },
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const dataToUpdate: any = {
      name,
      provider: dbProvider,
      modelId,
      baseURL: dbProvider === 'custom' ? baseURL : null,
    };

    if (apiKey) {
      dataToUpdate.apiKey = encrypt(apiKey);
    }

    const updatedModel = await prisma.customModel.update({
      where: { id },
      data: dataToUpdate,
    });
    
    const { apiKey: _, ...sanitizedModel } = updatedModel;
    return NextResponse.json(sanitizedModel);

  } catch (error) {
    logError(`Updating custom model`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Delete a custom model
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const modelIdToDelete = `custom:${id}`;

    // Ensure the model exists and belongs to the user before starting a transaction
    const model = await prisma.customModel.findFirst({
      where: { id, userId },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    // Use a transaction to perform the cleanup and deletion atomically
    await prisma.$transaction(async (tx) => {
      // 1. Find all agents that use this model
      const agentsToUpdate = await tx.chatAgent.findMany({
        where: {
          userId,
          selectedModels: { has: modelIdToDelete },
        },
      });

      // Update them one by one
      for (const agent of agentsToUpdate) {
        const updatedModels = agent.selectedModels.filter(
          (m: string) => m !== modelIdToDelete
        );
        await tx.chatAgent.update({
          where: { id: agent.id },
          data: { selectedModels: updatedModels },
        });
      }

      // 2. Update ChatRounds: set `selectedModel` to null
      await tx.chatRound.updateMany({
        where: {
          config: { userId },
          selectedModel: modelIdToDelete,
        },
        data: {
          selectedModel: null,
        },
      });

      // 3. Update UserCapabilities: set `defaultModel` to null
      const userCapabilities = await tx.userCapabilities.findUnique({ where: { userId } });
      if (userCapabilities && (userCapabilities.modelSettings as any)?.defaultModel === modelIdToDelete) {
        await tx.userCapabilities.update({
          where: { userId },
          data: {
            modelSettings: {
              ...(userCapabilities.modelSettings as any),
              defaultModel: null,
            },
          },
        });
      }

      // 4. Delete the custom model
      await tx.customModel.delete({
        where: { id, userId },
      });
    });

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    logError(`Deleting custom model`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 