import { NextRequest, NextResponse } from 'next/server';
import { SpaceService } from "@/lib/services/SpaceService";
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/utils/error';
import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';

// GET /api/spaces/[slug]/token-usage - Get space token usage for current user
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Use the existing auth service to get normalized internal user ID
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

    // Get space and verify user has access
    const space = await SpaceService.getSpaceBySlug(slug, userId);
    if (!space) {
      return new Response(JSON.stringify({ error: 'Space not found or no access' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get member with their assigned plan or space default
    const spaceMember = await prisma.spaceMembers.findUnique({
      where: {
        spaceId_userId: {
          spaceId: space.id,
          userId: userId
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

    if (!spaceMember) {
      return NextResponse.json(
        { error: 'Not a member of this space' }, 
        { status: 404 }
      );
    }

    // Get the effective plan (member-specific or space default)
    const effectivePlan = spaceMember.tokenPlan || spaceMember.space.defaultTokenPlan;
    if (!effectivePlan) {
      return NextResponse.json(
        { error: 'No token plan configured for this space' }, 
        { status: 404 }
      );
    }

    // Fetch space token usage for this user
    const spaceTokenUsage = await prisma.spaceTokenUsage.findUnique({
      where: { 
        spaceId_userId: {
          spaceId: space.id,
          userId: userId
        }
      }
    });
    
    // If no usage record exists yet, return zeros
    const tokensUsed = spaceTokenUsage?.tokensUsedInPeriod || 0;
    const periodStart = spaceTokenUsage?.periodStartDate || new Date();
    const periodEnd = spaceTokenUsage?.periodEndDate || new Date();
    
    // Calculate percentage used
    const percentageUsed = effectivePlan.tokenLimit > 0 
      ? (tokensUsed / effectivePlan.tokenLimit) * 100
      : 0;
    
    // Calculate days remaining in the period
    const now = new Date();
    const daysRemaining = spaceTokenUsage 
      ? Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Format the response
    return NextResponse.json({
      tokensUsedInPeriod: tokensUsed,
      tokenLimit: effectivePlan.tokenLimit,
      percentageUsed,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      daysRemaining: Math.max(0, daysRemaining),
      planName: effectivePlan.name
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`GET /api/spaces/${(await params).slug}/token-usage`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch space token usage' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}