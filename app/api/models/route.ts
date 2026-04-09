import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { getSpaceId } from '@/lib/utils/space-aware';
import { getContextualModels, type SpaceModelSettings } from '@/lib/utils/space-aware-models';
import { SpaceService } from '@/lib/services/SpaceService';
import { logError } from '@/lib/utils/error';

/**
 * GET /api/models - Get available models for current context (user or space)
 * 
 * This endpoint replaces /api/user/models and provides space-aware model filtering.
 * If called from a space context, it will filter models according to space settings.
 * If called from user context, it returns all user models.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    const spaceId = getSpaceId(request);
    
    let spaceModelSettings: SpaceModelSettings | null = null;
    
    // If in space context, get space model settings
    if (spaceId) {
      try {
        const space = await SpaceService.getSpaceById(spaceId, userId);
        if (space) {
          spaceModelSettings = (space.modelSettings as unknown as SpaceModelSettings) || {
            mode: 'all',
            defaultModel: null,
            includedModels: [],
            excludedModels: []
          };
        }
      } catch (error) {
        console.warn('Failed to fetch space model settings:', error);
        // Continue without space filtering if space lookup fails
      }
    }
    
    const models = await getContextualModels(userId, spaceId ?? undefined, spaceModelSettings);
    
    return NextResponse.json(models);
  } catch (error) {
    logError('GET /api/models', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}