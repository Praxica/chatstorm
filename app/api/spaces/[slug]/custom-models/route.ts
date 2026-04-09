import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/error';

// GET - Fetch all custom models for a space
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

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

    const customModels = await prisma.customModel.findMany({
      where: { spaceId: space.id },
      orderBy: { createdAt: 'asc' },
    });

    // Return models without the API key for security
    const sanitizedModels = customModels.map(({ apiKey: _apiKey, ...model }: {apiKey: any, [key: string]: any}) => model);

    return NextResponse.json(sanitizedModels);
  } catch (error) {
    logError('Fetching space custom models', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Create a new custom model for a space
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

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

    const body = await req.json();
    const { name, provider, modelId, apiKey, baseURL } = body;

    if (!name || !provider || !modelId || !apiKey) {
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

    const encryptedApiKey = encrypt(apiKey);

    const newCustomModel = await prisma.customModel.create({
      data: {
        spaceId: space.id,
        name,
        provider: dbProvider as any,
        modelId,
        apiKey: encryptedApiKey,
        baseURL: dbProvider === 'custom' ? baseURL : null,
      },
    });

    // Return the new model without the API key
    const { apiKey: _, ...sanitizedModel } = newCustomModel;

    return NextResponse.json(sanitizedModel, { status: 201 });
  } catch (error) {
    logError('Creating space custom model', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}