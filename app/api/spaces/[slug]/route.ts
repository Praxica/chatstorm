import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { NextRequest } from "next/server";
import { SpaceService } from "@/lib/services/SpaceService";
import { logError } from '@/lib/utils/error';
import { prisma } from '@/lib/prisma';

// GET /api/spaces/[slug] - Get space details
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

    const space = await SpaceService.getSpaceBySlug(slug, userId);

    if (!space) {
      return new Response(JSON.stringify({ error: 'Space not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ space }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`GET /api/spaces/${(await params).slug}`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch space' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// DELETE /api/spaces/[slug] - Delete a space
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

    // Parse request body to get deleteConfigs option
    const body = await req.json().catch(() => ({}));
    const { deleteConfigs = false } = body;

    // Get the space and verify ownership
    const space = await SpaceService.getSpaceBySlug(slug, userId);

    if (!space) {
      return new Response(JSON.stringify({ error: 'Space not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only the owner can delete the space (userId is already the internal ID)
    if (space.ownerId !== userId) {
      return new Response(JSON.stringify({ error: 'Only the space owner can delete this space' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle configs based on deleteConfigs option
    if (deleteConfigs) {
      // Delete the space (cascade will handle related records including configs)
      await prisma.spaces.delete({
        where: { id: space.id }
      });
    } else {
      // First, move configs back to user's personal dashboard by removing spaceId
      await prisma.config.updateMany({
        where: { spaceId: space.id },
        data: { spaceId: null }
      });
      
      // Then delete the space
      await prisma.spaces.delete({
        where: { id: space.id }
      });
    }

    return new Response(JSON.stringify({ message: 'Space deleted successfully' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`DELETE /api/spaces/${(await params).slug}`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete space' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}