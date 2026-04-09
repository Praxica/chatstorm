import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/utils/auth';

// GET handler to fetch token usage information
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    
    // Fetch the token usage from the database
    const tokenUsage = await prisma.userTokenUsage.findUnique({
      where: { userId },
      include: {
        plan: true
      }
    });
    
    if (!tokenUsage) {
      return NextResponse.json(
        { error: 'Token usage information not found' }, 
        { status: 404 }
      );
    }
    
    // Calculate percentage used
    const percentageUsed = (tokenUsage.tokensUsedInPeriod / tokenUsage.plan.monthlyTokenLimit) * 100;
    
    // Calculate days remaining in the period
    const now = new Date();
    const daysRemaining = Math.ceil(
      (tokenUsage.periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Format the response
    return NextResponse.json({
      tokensUsedInPeriod: tokenUsage.tokensUsedInPeriod,
      tokenLimit: tokenUsage.plan.monthlyTokenLimit,
      percentageUsed,
      periodStartDate: tokenUsage.periodStartDate,
      periodEndDate: tokenUsage.periodEndDate,
      daysRemaining: Math.max(0, daysRemaining),
      planName: tokenUsage.plan.name
    });
  } catch (error) {
    console.error('Error fetching token usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token usage information' }, 
      { status: 500 }
    );
  }
} 