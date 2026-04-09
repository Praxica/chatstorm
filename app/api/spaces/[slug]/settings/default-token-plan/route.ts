import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { slug } = await params;
    const { defaultTokenPlanId } = await req.json();

    // Get space and verify user is admin/owner
    const space = await prisma.spaces.findUnique({
      where: { slug },
      include: {
        members: {
          where: { 
            userId: userId,
            role: { in: ['owner', 'admin'] }
          }
        }
      }
    });

    if (!space || space.members.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If defaultTokenPlanId is provided, verify it belongs to this space
    if (defaultTokenPlanId) {
      const plan = await prisma.spaceTokenPlan.findFirst({
        where: {
          id: defaultTokenPlanId,
          spaceId: space.id,
          isActive: true
        }
      });

      if (!plan) {
        return NextResponse.json({ error: "Invalid token plan" }, { status: 400 });
      }
    }

    // Update space default token plan
    const updatedSpace = await prisma.spaces.update({
      where: { id: space.id },
      data: { defaultTokenPlanId: defaultTokenPlanId || null }
    });

    return NextResponse.json({ space: updatedSpace });
  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    console.error('Error updating space default token plan:', error);
    return NextResponse.json(
      { error: "Failed to update default token plan" },
      { status: 500 }
    );
  }
}