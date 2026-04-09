import { NextRequest } from "next/server";
import { SpaceService } from "@/lib/services/SpaceService";
import { logError } from '@/lib/utils/error';
import { prisma } from '@/lib/prisma';
import { sendSpaceMemberApprovedEmail } from '@/lib/email';
import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';

// POST /api/spaces/[slug]/members/[memberId]/approve - Approve pending member
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

    // Use SpaceService to approve member (userId is already the internal ID)
    console.log('[APPROVE] About to approve member:', { spaceId: space.id, memberId, approverId: userId });
    const result = await SpaceService.approveMember(space.id, memberId, userId);
    console.log('[APPROVE] Approval result:', result);

    // Get the full space and user details for post-approval actions
    const fullSpace = await prisma.spaces.findUnique({
      where: { id: space.id },
      select: {
        id: true,
        name: true,
        slug: true,
        joinInstructions: true,
        autoInstallTemplates: true
      }
    });

    const approvedUser = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        email: true
      }
    });

    if (fullSpace && approvedUser) {
      // Auto-install space templates for the approved user
      try {
        await SpaceService.autoInstallTemplates(fullSpace.id, memberId, '[APPROVE]');
      } catch (error) {
        console.error('[APPROVE] Error installing templates for approved user:', error);
        // Don't fail the approval if template installation fails
      }

      // Send approval email notification to the user
      try {
        const userName = undefined; // User model doesn't have name fields

        await sendSpaceMemberApprovedEmail({
          userEmail: approvedUser.email,
          userName,
          spaceName: fullSpace.name,
          spaceSlug: fullSpace.slug,
          joinInstructions: fullSpace.joinInstructions ?? undefined
        });
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
        // Don't fail the approval if email fails
      }
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`POST /api/spaces/${(await params).slug}/members/${(await params).memberId}/approve`, error);
    const message = error instanceof Error ? error.message : 'Failed to approve member';
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}