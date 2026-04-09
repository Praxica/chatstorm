import { getAuthenticatedUserId, handleAuthError } from '@/lib/utils/auth';
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { TokenCadence } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { slug } = await params;

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

    // Get all token plans for this space
    const tokenPlans = await prisma.spaceTokenPlan.findMany({
      where: { spaceId: space.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ tokenPlans });
  } catch (error) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    console.error('Error fetching space token plans:', error);
    return NextResponse.json(
      { error: "Failed to fetch token plans" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { slug } = await params;
    const { name, tokenLimit, cadence, priceCents } = await req.json();

    // Validate input
    if (!name || !tokenLimit || !cadence) {
      return NextResponse.json({ 
        error: "Name, token limit, and cadence are required" 
      }, { status: 400 });
    }

    if (!['WEEKLY', 'MONTHLY'].includes(cadence)) {
      return NextResponse.json({ 
        error: "Cadence must be WEEKLY or MONTHLY" 
      }, { status: 400 });
    }

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

    // Create token plan
    const tokenPlan = await prisma.spaceTokenPlan.create({
      data: {
        spaceId: space.id,
        name,
        tokenLimit: parseInt(tokenLimit),
        cadence: cadence as TokenCadence,
        priceCents: priceCents ? parseInt(priceCents) : 0
      }
    });

    return NextResponse.json({ tokenPlan });
  } catch (error: any) {
    // Use the existing auth error handler for consistent error responses
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    
    console.error('Error creating space token plan:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "A plan with this name already exists in this space" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create token plan" },
      { status: 500 }
    );
  }
}