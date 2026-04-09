import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/error';

// PUT - Update a custom model for a space
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string, id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug, id } = await params;

    // Get the space and verify permissions
    const space = await prisma.spaces.findUnique({
      where: { slug },
      include: { members: true }
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Check if user is owner or admin
    const isOwner = space.ownerId === userId;
    const memberRecord = space.members.find(m => m.userId === userId);
    const isAdmin = memberRecord?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Verify the custom model belongs to this space
    const existingModel = await prisma.customModel.findFirst({
      where: { 
        id,
        spaceId: space.id
      }
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found or access denied' }, { status: 404 });
    }

    const body = await req.json();
    const { name, provider, modelId, apiKey, baseURL } = body;

    if (!name || !provider || !modelId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize provider to match Prisma enum ProviderType
    const providerStr = (provider || '').toString().trim().toLowerCase();
    const validProviders = ['openai', 'anthropic', 'google', 'xai', 'deepseek', 'groq', 'custom'];
    const dbProvider = providerStr.includes('custom') ? 'custom' : providerStr;

    if (!validProviders.includes(dbProvider)) {
      return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
    }
    if (dbProvider === 'custom' && !baseURL) {
      return NextResponse.json({ error: 'Base URL is required for custom providers' }, { status: 400 });
    }

    const updateData: any = {
      name,
      provider: dbProvider as any,
      modelId,
      baseURL: dbProvider === 'custom' ? baseURL : null,
    };

    // Only update the API key if it's provided (allow updating without changing the key)
    if (apiKey) {
      updateData.apiKey = encrypt(apiKey);
    }

    const updatedModel = await prisma.customModel.update({
      where: { id },
      data: updateData,
    });

    // Return the updated model without the API key
    const { apiKey: _, ...sanitizedModel } = updatedModel;

    return NextResponse.json(sanitizedModel);
  } catch (error) {
    logError('Updating space custom model', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Delete a custom model for a space
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string, id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug, id } = await params;

    // Get the space and verify permissions
    const space = await prisma.spaces.findUnique({
      where: { slug },
      include: { members: true }
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Check if user is owner or admin
    const isOwner = space.ownerId === userId;
    const memberRecord = space.members.find(m => m.userId === userId);
    const isAdmin = memberRecord?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Verify the custom model belongs to this space
    const existingModel = await prisma.customModel.findFirst({
      where: { 
        id,
        spaceId: space.id
      }
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found or access denied' }, { status: 404 });
    }

    await prisma.customModel.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Model deleted successfully' });
  } catch (error) {
    logError('Deleting space custom model', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}