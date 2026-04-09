import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { TokenCadence } from "@prisma/client";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; planId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { slug, planId } = await params;
    const { name, tokenLimit, cadence, priceCents, isActive } = await req.json();

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

    // Verify plan belongs to this space
    const existingPlan = await prisma.spaceTokenPlan.findFirst({
      where: {
        id: planId,
        spaceId: space.id
      }
    });

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Update token plan
    const tokenPlan = await prisma.spaceTokenPlan.update({
      where: { id: planId },
      data: {
        ...(name && { name }),
        ...(tokenLimit && { tokenLimit: parseInt(tokenLimit) }),
        ...(cadence && { cadence: cadence as TokenCadence }),
        ...(priceCents !== undefined && { priceCents: parseInt(priceCents) }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json({ tokenPlan });
  } catch (error: any) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    console.error('Error updating space token plan:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "A plan with this name already exists in this space" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to update token plan" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string; planId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { slug, planId } = await params;

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

    // Verify plan belongs to this space
    const existingPlan = await prisma.spaceTokenPlan.findFirst({
      where: {
        id: planId,
        spaceId: space.id
      }
    });

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Check if plan is being used as default
    const isDefault = space.defaultTokenPlanId === planId;
    if (isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the default plan. Please set a different default plan first." },
        { status: 400 }
      );
    }

    // Check if plan has active members
    const membersWithPlan = await prisma.spaceMembers.count({
      where: { tokenPlanId: planId }
    });

    if (membersWithPlan > 0) {
      return NextResponse.json(
        { error: `Cannot delete plan. ${membersWithPlan} member(s) are currently assigned to this plan.` },
        { status: 400 }
      );
    }

    // Delete the plan
    await prisma.spaceTokenPlan.delete({
      where: { id: planId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    console.error('Error deleting space token plan:', error);
    return NextResponse.json(
      { error: "Failed to delete token plan" },
      { status: 500 }
    );
  }
}