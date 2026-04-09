import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/utils/auth';

// GET handler to fetch available subscription plans
export async function GET() {
  try {
    // Ensure the user is authenticated (even though we're just fetching public plan info)
    await getAuthenticatedUserId();
    
    // Fetch active plans from the database
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        priceCents: 'asc'
      },
      select: {
        name: true,
        monthlyTokenLimit: true,
        priceCents: true
      }
    });
    
    if (!plans || plans.length === 0) {
      return NextResponse.json([], { status: 200 });
    }
    
    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription plans' }, 
      { status: 500 }
    );
  }
}