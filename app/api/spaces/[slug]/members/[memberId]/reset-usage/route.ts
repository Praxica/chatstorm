import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { slug, memberId } = await params;
    
    // console.log(`[RESET_USAGE] Request to reset token usage for member ${memberId} in space ${slug}`);
    
    const requestingUserId = await getAuthenticatedUserId();

    // Find the space by slug
    const space = await prisma.spaces.findUnique({
      where: { slug },
      select: { id: true, ownerId: true }
    });

    if (!space) {
      // console.log(`[RESET_USAGE] Space not found: ${slug}`);
      return NextResponse.json(
        { error: 'Space not found' },
        { status: 404 }
      );
    }

    // Check if the requesting user is the space owner or admin
    const requestingMember = await prisma.spaceMembers.findUnique({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: requestingUserId
        }
      },
      select: { role: true }
    });

    if (!requestingMember || (requestingMember.role !== 'owner' && requestingMember.role !== 'admin')) {
      // console.log(`[RESET_USAGE] Insufficient permissions for user ${requestingUserId} in space ${slug}`);
      return NextResponse.json(
        { error: 'Insufficient permissions. Only space owners and admins can reset member token usage.' },
        { status: 403 }
      );
    }

    // Find the member whose usage we want to reset
    const targetMember = await prisma.spaceMembers.findUnique({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: memberId
        }
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    });

    if (!targetMember) {
      // console.log(`[RESET_USAGE] Target member not found: ${memberId} in space ${space.id}`);
      return NextResponse.json(
        { error: 'Member not found in this space' },
        { status: 404 }
      );
    }

    // Find the member's space token usage record
    const spaceTokenUsage = await prisma.spaceTokenUsage.findUnique({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: memberId
        }
      }
    });

    if (!spaceTokenUsage) {
      // console.log(`[RESET_USAGE] No token usage record found for member ${memberId} in space ${space.id}`);
      return NextResponse.json(
        { error: 'No token usage record found for this member' },
        { status: 404 }
      );
    }

    // console.log(`[RESET_USAGE] Current usage for ${targetMember.user?.email}: ${spaceTokenUsage.tokensUsedInPeriod} tokens`);

    // Reset the token usage to 0
    const updatedUsage = await prisma.spaceTokenUsage.update({
      where: { id: spaceTokenUsage.id },
      data: {
        tokensUsedInPeriod: 0
      }
    });

    // console.log(`[RESET_USAGE] Successfully reset token usage for ${targetMember.user?.email} to 0 tokens`);

    // Get the effective plan for the response
    const memberWithPlan = await prisma.spaceMembers.findUnique({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: memberId
        }
      },
      include: {
        tokenPlan: true,
        space: {
          include: {
            defaultTokenPlan: true
          }
        }
      }
    });

    const effectivePlan = memberWithPlan?.tokenPlan || memberWithPlan?.space.defaultTokenPlan;

    return NextResponse.json({
      success: true,
      message: `Token usage reset to 0 for ${targetMember.user?.email}`,
      usage: {
        tokensUsedInPeriod: updatedUsage.tokensUsedInPeriod,
        tokenLimit: effectivePlan?.tokenLimit || 0,
        percentUsed: 0
      }
    });

  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('[RESET_USAGE] Error resetting token usage:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to reset token usage',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}