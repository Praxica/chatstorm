import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { getAllAvailableModels } from '@/lib/services/ModelService';
import { logError } from '@/lib/utils/error';

export async function GET(_request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    const models = await getAllAvailableModels(userId);
    
    return NextResponse.json(models);
  } catch (error) {
    logError('GET /api/user/models', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
} 