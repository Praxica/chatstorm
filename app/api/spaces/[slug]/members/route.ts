import { NextRequest } from "next/server";
import { SpaceService } from "@/lib/services/SpaceService";
import { prisma } from "@/lib/prisma";
import { logError } from '@/lib/utils/error';
import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';

// GET /api/spaces/[slug]/members - Get space members
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

    // Check if user is admin or owner
    if (space.userRole !== 'owner' && space.userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch all members with user details, token plan, and usage
    const members = await prisma.spaceMembers.findMany({
      where: {
        spaceId: space.id
      },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        joinedAt: true,
        tokenPlanId: true,
        user: {
          select: {
            id: true,
            email: true,
            externalId: true,
            createdAt: true,
            spaceTokenUsages: {
              where: {
                spaceId: space.id
              },
              select: {
                tokensUsedInPeriod: true,
                periodStartDate: true,
                periodEndDate: true
              }
            }
          }
        },
        tokenPlan: {
          select: {
            name: true,
            tokenLimit: true,
            cadence: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // pending first
        { joinedAt: 'asc' }
      ]
    });

    // Get space default token plan for members without specific plans
    const spaceWithDefault = await prisma.spaces.findUnique({
      where: { id: space.id },
      select: {
        defaultTokenPlan: {
          select: {
            name: true,
            tokenLimit: true,
            cadence: true
          }
        }
      }
    });

    // Enhance members data with computed token usage info
    const enhancedMembers = members.map(member => {
      const tokenUsage = member.user.spaceTokenUsages[0] || null;
      const memberPlan = member.tokenPlan || spaceWithDefault?.defaultTokenPlan || null;
      
      // Only use explicitly assigned member plan or space default - never usage plan
      const effectivePlan = memberPlan;
      
      return {
        ...member,
        tokenUsage: tokenUsage ? {
          tokensUsed: tokenUsage.tokensUsedInPeriod,
          tokenLimit: effectivePlan?.tokenLimit || 0,
          planName: effectivePlan?.name || 'Unassigned',
          cadence: effectivePlan?.cadence || 'MONTHLY',
          periodStartDate: tokenUsage.periodStartDate,
          periodEndDate: tokenUsage.periodEndDate,
          percentageUsed: effectivePlan?.tokenLimit 
            ? Math.round((tokenUsage.tokensUsedInPeriod / effectivePlan.tokenLimit) * 100)
            : 0
        } : {
          tokensUsed: 0,
          tokenLimit: effectivePlan?.tokenLimit || 0,
          planName: effectivePlan?.name || 'Unassigned',
          cadence: effectivePlan?.cadence || 'MONTHLY',
          periodStartDate: null,
          periodEndDate: null,
          percentageUsed: 0
        }
      };
    });

    return new Response(JSON.stringify({ members: enhancedMembers }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`GET /api/spaces/${(await params).slug}/members`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch members' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST /api/spaces/[slug]/members - Invite new member
export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Use the existing auth service to get normalized internal user ID
    const userId = await getAuthenticatedUserId();
    const { slug } = await params;

    const body = await req.json();
    const { email, role = 'member' } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { 
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

    // Use SpaceService to invite user (userId is already the internal ID)
    const membership = await SpaceService.inviteUser(space.id, email, userId, role);

    return new Response(JSON.stringify({ membership }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    logError(`POST /api/spaces/${(await params).slug}/members`, error);
    const message = error instanceof Error ? error.message : 'Failed to invite member';
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}