import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { NextRequest } from "next/server";
import { SpaceService } from "@/lib/services/SpaceService";
import { logError } from '@/lib/utils/error';
import { prisma } from '@/lib/prisma';

// PUT /api/spaces/[slug]/members/[memberId]/role - Update member role
export async function PUT(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    const { slug, memberId } = await params;

    const body = await req.json();
    const { role } = body;

    // Validate role
    if (!role || !['member', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be "member" or "admin"' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get space and verify permissions
    const space = await SpaceService.getSpaceBySlug(slug, userId);
    if (!space) {
      return new Response(JSON.stringify({ error: 'Space not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only owners can change roles
    if (space.userRole !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only space owners can change member roles' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check that the target member exists and is not the owner
    const targetMember = await prisma.spaceMembers.findUnique({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: memberId
        }
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (!targetMember) {
      return new Response(JSON.stringify({ error: 'Member not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Cannot change owner role
    if (targetMember.role === 'owner') {
      return new Response(JSON.stringify({ error: 'Cannot change owner role' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Cannot change your own role
    if (memberId === userId) {
      return new Response(JSON.stringify({ error: 'Cannot change your own role' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the role
    const updatedMember = await prisma.spaceMembers.update({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: memberId
        }
      },
      data: {
        role: role
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Role updated to ${role}`,
      member: updatedMember 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`PUT /api/spaces/${(await params).slug}/members/${(await params).memberId}/role`, error);
    const message = error instanceof Error ? error.message : 'Failed to update member role';
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}