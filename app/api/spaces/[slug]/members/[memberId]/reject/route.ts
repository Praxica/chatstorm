import { NextRequest } from "next/server";
import { SpaceService } from "@/lib/services/SpaceService";
import { logError } from '@/lib/utils/error';
import { prisma } from '@/lib/prisma';
import { sendSpaceMemberRejectedEmail } from '@/lib/email';
import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';

// POST /api/spaces/[slug]/members/[memberId]/reject - Reject pending member
export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    // Use the existing auth service to get normalized internal user ID
    const userId = await getAuthenticatedUserId();
    const { slug, memberId } = await params;

    // Get space and verify permissions
    const space = await SpaceService.getSpaceBySlug(slug, userId);
    if (!space) {
      return new Response(JSON.stringify({ error: 'Space not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has admin/owner permissions
    if (space.userRole !== 'owner' && space.userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user and space details before deletion for email notification
    const memberToReject = await prisma.spaceMembers.findUnique({
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

    if (!memberToReject) {
      return new Response(JSON.stringify({ error: 'Member not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove the pending member
    const deletedMember = await prisma.spaceMembers.delete({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: memberId
        }
      }
    });

    // Send rejection email notification
    if (memberToReject.user) {
      try {
        const userName = undefined; // User model doesn't have name fields

        await sendSpaceMemberRejectedEmail({
          userEmail: memberToReject.user.email,
          userName,
          spaceName: space.name,
          rejectionReason: undefined, // Could be enhanced to accept reason in request body
          contactEmail: undefined // Could be enhanced to include space admin contact
        });
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
        // Don't fail the rejection if email fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Member request rejected',
      member: { ...deletedMember, user: memberToReject.user }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`POST /api/spaces/${(await params).slug}/members/${(await params).memberId}/reject`, error);
    const message = error instanceof Error ? error.message : 'Failed to reject member';
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}