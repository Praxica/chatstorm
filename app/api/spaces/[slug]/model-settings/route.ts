import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { NextRequest } from "next/server";
import { SpaceService } from "@/lib/services/SpaceService";
import { prisma } from "@/lib/prisma";
import { logError } from '@/lib/utils/error';

// PUT /api/spaces/[slug]/model-settings - Update space model settings
export async function PUT(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

    // Get space and verify permissions
    const space = await SpaceService.getSpaceBySlug(slug, userId);
    if (!space) {
      return new Response(JSON.stringify({ error: 'Space not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin or owner
    if (space.userRole !== 'owner' && space.userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { modelSettings } = body;

    if (!modelSettings) {
      return new Response(JSON.stringify({ error: 'Model settings are required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate model settings structure
    if (!modelSettings.mode || !['all', 'include', 'exclude'].includes(modelSettings.mode)) {
      return new Response(JSON.stringify({ error: 'Invalid model settings mode' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the space model settings
    const updatedSpace = await prisma.spaces.update({
      where: { id: space.id },
      data: {
        modelSettings: modelSettings
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      modelSettings: updatedSpace.modelSettings 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`PUT /api/spaces/${(await params).slug}/model-settings`, error);
    const message = error instanceof Error ? error.message : 'Failed to update model settings';
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET /api/spaces/[slug]/model-settings - Get space model settings
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

    // Get space and verify access
    const space = await SpaceService.getSpaceBySlug(slug, userId);
    if (!space) {
      return new Response(JSON.stringify({ error: 'Space not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      modelSettings: space.modelSettings || {
        mode: 'all',
        includedModels: [],
        excludedModels: [],
        defaultModel: null
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`GET /api/spaces/${(await params).slug}/model-settings`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch model settings' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}