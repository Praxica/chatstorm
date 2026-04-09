import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// POST handler to initialize token usage for a user
export async function POST() {
  try {
    // Get the authenticated user's Clerk ID
    const authResult = await auth();
    const clerkId = authResult.userId;
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Find the user by their Clerk ID
    const user = await prisma.user.findUnique({
      where: { externalId: clerkId },
      select: { id: true }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found', clerkId },
        { status: 404 }
      );
    }
    
    // Check if the user already has a token usage record
    const existingTokenUsage = await prisma.userTokenUsage.findUnique({
      where: { userId: user.id }
    });
    
    if (existingTokenUsage) {
      return NextResponse.json({
        message: 'Token usage record already exists',
        data: existingTokenUsage
      });
    }
    
    // Find the default plan (Free tier)
    const defaultPlan = await prisma.subscriptionPlan.findFirst({
      where: { isActive: true },
      orderBy: { priceCents: 'asc' }
    });
    
    if (!defaultPlan) {
      // Create a default Free plan if none exists
      const freePlan = await prisma.subscriptionPlan.create({
        data: {
          name: 'Free',
          monthlyTokenLimit: 100000,
          priceCents: 0,
          isActive: true
        }
      });
      
      console.log('Created default Free plan:', freePlan);
      
      // Create token usage record
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const tokenUsage = await prisma.userTokenUsage.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          tokensUsedInPeriod: 0,
          periodStartDate: now,
          periodEndDate: nextMonth
        }
      });
      
      return NextResponse.json({
        message: 'Created token usage record with new default plan',
        data: tokenUsage,
        plan: freePlan
      }, { status: 201 });
    }
    
    // Create token usage record with existing plan
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const tokenUsage = await prisma.userTokenUsage.create({
      data: {
        userId: user.id,
        planId: defaultPlan.id,
        tokensUsedInPeriod: 0,
        periodStartDate: now,
        periodEndDate: nextMonth
      }
    });
    
    return NextResponse.json({
      message: 'Created token usage record',
      data: tokenUsage,
      plan: defaultPlan
    }, { status: 201 });
  } catch (error) {
    console.error('Error initializing token usage:', error);
    return NextResponse.json(
      { error: 'Failed to initialize token usage', details: String(error) },
      { status: 500 }
    );
  }
} 