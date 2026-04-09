import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { slug, memberId } = await params;
    const { tokenPlanId } = await req.json();

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

    // Verify member exists in this space
    const member = await prisma.spaceMembers.findFirst({
      where: {
        id: memberId,
        spaceId: space.id
      }
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // If tokenPlanId is provided, verify it belongs to this space
    if (tokenPlanId) {
      const plan = await prisma.spaceTokenPlan.findFirst({
        where: {
          id: tokenPlanId,
          spaceId: space.id,
          isActive: true
        }
      });

      if (!plan) {
        return NextResponse.json({ error: "Invalid token plan" }, { status: 400 });
      }
    }

    // Update member's token plan (null means use space default)
    const updatedMember = await prisma.spaceMembers.update({
      where: { id: memberId },
      data: { tokenPlanId: tokenPlanId || null },
      include: {
        tokenPlan: true,
        user: true
      }
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    console.error('Error updating member token plan:', error);
    return NextResponse.json(
      { error: "Failed to update member token plan" },
      { status: 500 }
    );
  }
}