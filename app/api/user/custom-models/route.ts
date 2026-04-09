import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/error';

// GET - Fetch all custom models for the authenticated user
export async function GET(_req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const customModels = await prisma.customModel.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    // Return models without the API key for security
    const sanitizedModels = customModels.map(({ apiKey: _apiKey, ...model }: {apiKey: any, [key: string]: any}) => model);

    return NextResponse.json(sanitizedModels);
  } catch (error) {
    logError('Fetching custom models', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Create a new custom model
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await req.json();
    const { name, provider, modelId, apiKey, baseURL } = body;

    if (!name || !provider || !modelId || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let dbProvider = provider;
    if (provider === 'Custom (OpenAI-compatible)') {
      dbProvider = 'custom';
    }

    const encryptedApiKey = encrypt(apiKey);

    // Require baseURL for custom OpenAI-compatible providers
    if (dbProvider === 'custom' && !baseURL) {
      return NextResponse.json({ error: 'Base URL is required for custom providers' }, { status: 400 });
    }

    const newCustomModel = await prisma.customModel.create({
      data: {
        userId,
        name,
        provider: dbProvider,
        modelId,
        apiKey: encryptedApiKey,
        baseURL: dbProvider === 'custom' ? baseURL : null,
      },
    });

    // Return the new model without the API key
    const { apiKey: _, ...sanitizedModel } = newCustomModel;

    return NextResponse.json(sanitizedModel, { status: 201 });
  } catch (error) {
    logError('Creating custom model', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 