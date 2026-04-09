import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TokenCadence } from '@prisma/client';

interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface TokenContext {
  userId: string;
  spaceId?: string;
}

export class TokenService {
  /**
   * Calculate the next period end date based on cadence
   */
  private calculatePeriodEndDate(startDate: Date, cadence: TokenCadence): Date {
    const endDate = new Date(startDate);
    if (cadence === 'WEEKLY') {
      endDate.setDate(endDate.getDate() + 7);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
  }

  /**
   * Checks if a user has exceeded their token limit
   * @param context The token context including userId and optional spaceId
   * @returns Response object if limit exceeded, null otherwise
   */
  async checkTokenLimit(context: TokenContext | string): Promise<Response | null> {
    // Handle legacy string parameter
    const tokenContext: TokenContext = typeof context === 'string' 
      ? { userId: context } 
      : context;
    const { userId, spaceId } = tokenContext;
    // console.log('checkTokenLimit', { userId, spaceId });
    try {
      // Find the user by Clerk ID or internal ID (userId could be either)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      const user = await prisma.user.findFirst({
        where: isUuid
          ? { OR: [{ externalId: userId }, { id: userId }] }
          : { externalId: userId },
        select: { id: true }
      });

      if (!user) {
        console.error(`TokenService: User not found for userID: ${userId}`);
        return null; // Allow the operation to continue if user not found
      }

      // Check space token usage if spaceId is provided
      if (spaceId) {
        // console.log(`[TOKEN_CHECK] Checking space token limit for user ${user.id} in space ${spaceId}`);
        
        // Get member with their assigned plan or space default
        const spaceMember = await prisma.spaceMembers.findUnique({
          where: {
            spaceId_userId: {
              spaceId,
              userId: user.id
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
          // console.log(`[TOKEN_CHECK] User ${user.id} is not a member of space ${spaceId}`);
          return null; // Not a member, allow operation
        }

        // Get the effective plan (member-specific or space default)
        const effectivePlan = spaceMember.tokenPlan || spaceMember.space.defaultTokenPlan;
        if (!effectivePlan) {
          // console.log(`[TOKEN_CHECK] No token plan configured for space ${spaceId}`);
          return null; // No plan configured, allow operation
        }

        // Get token usage record
        const spaceTokenUsage = await prisma.spaceTokenUsage.findUnique({
          where: { 
            spaceId_userId: {
              spaceId,
              userId: user.id
            }
          }
        });

        if (spaceTokenUsage) {
          // console.log('[TOKEN_CHECK] Found space token usage:', {
          //   currentUsage: spaceTokenUsage.tokensUsedInPeriod,
          //   limit: effectivePlan.tokenLimit,
          //   percentUsed: ((spaceTokenUsage.tokensUsedInPeriod / effectivePlan.tokenLimit) * 100).toFixed(2) + '%',
          //   planName: effectivePlan.name
          // });
          // Check if period has expired and reset if needed
          const now = new Date();
          if (now > spaceTokenUsage.periodEndDate) {
            const newPeriodEnd = this.calculatePeriodEndDate(now, effectivePlan.cadence);
            await prisma.spaceTokenUsage.update({
              where: { id: spaceTokenUsage.id },
              data: {
                periodStartDate: now,
                periodEndDate: newPeriodEnd,
                tokensUsedInPeriod: 0
              }
            });
            return null; // Reset period, allow operation
          }

          // Check if the user has exceeded their space limit
          if (spaceTokenUsage.tokensUsedInPeriod >= effectivePlan.tokenLimit) {
            console.log('[TOKEN_CHECK] ❌ SPACE TOKEN LIMIT EXCEEDED:', {
              usage: spaceTokenUsage.tokensUsedInPeriod,
              limit: effectivePlan.tokenLimit,
              planName: effectivePlan.name,
              spaceId
            });
            
            return NextResponse.json(
              {
                error: 'Space token limit exceeded',
                message: `You have reached your ${effectivePlan.cadence.toLowerCase()} token limit for this space. Please contact your space administrator.`,
                tokenUsage: {
                  used: spaceTokenUsage.tokensUsedInPeriod,
                  limit: effectivePlan.tokenLimit,
                  percentUsed: (spaceTokenUsage.tokensUsedInPeriod / effectivePlan.tokenLimit) * 100,
                  context: 'space'
                }
              },
              { status: 402 } // Payment Required
            );
          } else {
            // console.log('[TOKEN_CHECK] ✅ Space token limit check passed');
          }
        } else {
          // console.log('[TOKEN_CHECK] No existing space token usage, will be created on first use');
        }
        return null; // Allow operation
      }

      // Check personal token usage for non-space configs
      const tokenUsage = await prisma.userTokenUsage.findUnique({
        where: { userId: user.id },
        include: { plan: true }
      });

      if (!tokenUsage) {
        console.warn(`TokenService: No token usage record found for user: ${user.id}`);
        return null; // Allow the operation to continue if no usage record
      }

      // Check if the user has exceeded their limit
      if (tokenUsage.tokensUsedInPeriod >= tokenUsage.plan.monthlyTokenLimit) {
        return NextResponse.json(
          {
            error: 'Token limit exceeded',
            message: 'You have reached your monthly token limit. Please upgrade your plan to continue.',
            tokenUsage: {
              used: tokenUsage.tokensUsedInPeriod,
              limit: tokenUsage.plan.monthlyTokenLimit,
              percentUsed: (tokenUsage.tokensUsedInPeriod / tokenUsage.plan.monthlyTokenLimit) * 100,
              context: 'user'
            }
          },
          { status: 402 } // Payment Required
        );
      }

      return null; // User has not exceeded their limit
    } catch (error) {
      console.error('TokenService: Error checking token limit:', error);
      return null; // Allow the operation to continue if there's an error
    }
  }

  /**
   * Records token usage for a user
   * @param context The token context including userId and optional spaceId
   * @param usage The token usage to record
   */
  async recordTokenUsage(context: TokenContext | string, usage: TokenUsage): Promise<void> {
    // Handle legacy string parameter
    const tokenContext: TokenContext = typeof context === 'string' 
      ? { userId: context } 
      : context;
    const { userId, spaceId } = tokenContext;
    try {
      // Calculate total tokens if not provided
      const totalTokens = usage.totalTokens || 
        ((usage.promptTokens || 0) + (usage.completionTokens || 0));
      
      if (!totalTokens) {
        // console.log('TokenService: No tokens to record, usage data is empty or zero');
        return;
      }

      // Find the user by Clerk ID or internal UUID
      const isClerkId = userId.startsWith('user_');
      const user = await prisma.user.findFirst({
        where: isClerkId 
          ? { externalId: userId }
          : { id: userId },
        select: { id: true }
      });

      if (!user) {
        console.error(`TokenService: User not found for UserId: ${userId}`);
        return;
      }

      // Handle space token usage if spaceId is provided
      if (spaceId) {
        // console.log(`[TOKEN_RECORD] Recording ${totalTokens} tokens for space context:`, { 
        //   spaceId, 
        //   userId: user.id,
        //   clerkId: isClerkId ? userId : 'n/a'
        // });
        
        // Get member with their assigned plan or space default
        const spaceMember = await prisma.spaceMembers.findUnique({
          where: {
            spaceId_userId: {
              spaceId,
              userId: user.id
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
          console.error(`[TOKEN_RECORD] User ${user.id} is not a member of space ${spaceId}`);
          return;
        }

        // Get the effective plan (member-specific or space default)
        const effectivePlan = spaceMember.tokenPlan || spaceMember.space.defaultTokenPlan;
        if (!effectivePlan) {
          console.error(`[TOKEN_RECORD] No token plan configured for space ${spaceId}`);
          return;
        }

        // Get space token usage record
        const spaceTokenUsage = await prisma.spaceTokenUsage.findUnique({
          where: { 
            spaceId_userId: {
              spaceId,
              userId: user.id
            }
          }
        });

        if (spaceTokenUsage) {
          // console.log('[TOKEN_RECORD] Found existing space token usage:', {
          //   currentUsage: spaceTokenUsage.tokensUsedInPeriod,
          //   limit: effectivePlan.tokenLimit,
          //   planName: effectivePlan.name,
          //   periodEnd: spaceTokenUsage.periodEndDate
          // });
          // Check if period has expired and reset if needed
          const now = new Date();
          if (now > spaceTokenUsage.periodEndDate) {
            // console.log('[TOKEN_RECORD] Period expired, resetting usage');
            const newPeriodEnd = this.calculatePeriodEndDate(now, effectivePlan.cadence);
            await prisma.spaceTokenUsage.update({
              where: { id: spaceTokenUsage.id },
              data: {
                periodStartDate: now,
                periodEndDate: newPeriodEnd,
                tokensUsedInPeriod: totalTokens
              }
            });
            // console.log('[TOKEN_RECORD] Reset period and recorded tokens:', {
            //   newUsage: totalTokens,
            //   newPeriodEnd
            // });
          } else {
            // Update existing space token usage
            await prisma.spaceTokenUsage.update({
              where: { id: spaceTokenUsage.id },
              data: {
                tokensUsedInPeriod: {
                  increment: totalTokens
                }
              }
            });
            // console.log('[TOKEN_RECORD] Updated space token usage:', {
            //   previousUsage: spaceTokenUsage.tokensUsedInPeriod,
            //   addedTokens: totalTokens,
            //   newUsage,
            //   percentUsed: ((newUsage / effectivePlan.tokenLimit) * 100).toFixed(2) + '%'
            // });
          }
        } else {
          // console.log('[TOKEN_RECORD] No existing space token usage found, creating new record...');
          // console.log('[TOKEN_RECORD] Creating new space token usage with plan:', {
          //   planName: effectivePlan.name,
          //   tokenLimit: effectivePlan.tokenLimit,
          //   cadence: effectivePlan.cadence
          // });

          const now = new Date();
          const periodEnd = this.calculatePeriodEndDate(now, effectivePlan.cadence);

          await prisma.spaceTokenUsage.create({
            data: {
              spaceId,
              userId: user.id,
              tokensUsedInPeriod: totalTokens,
              periodStartDate: now,
              periodEndDate: periodEnd
            }
          });
          
          // console.log('[TOKEN_RECORD] Created new space token usage record:', {
          //   id: newSpaceTokenUsage.id,
          //   initialUsage: totalTokens,
          //   periodStart: now,
          //   periodEnd: periodEnd
          // });
        }
        return;
      }

      // Handle personal token usage (non-space)
      const tokenUsage = await prisma.userTokenUsage.findUnique({
        where: { userId: user.id }
      });

      if (tokenUsage) {
        // Update existing token usage record
        await prisma.userTokenUsage.update({
          where: { userId: user.id },
          data: {
            tokensUsedInPeriod: {
              increment: totalTokens
            }
          }
        });
      } else {
        // If no record exists, we should create one with a default plan
        // First, get the default plan (e.g., free tier)
        const defaultPlan = await prisma.subscriptionPlan.findFirst({
          where: { isActive: true },
          orderBy: { priceCents: 'asc' }
        });

        if (!defaultPlan) {
          console.error('TokenService: No subscription plans found in the database');
          return;
        }

        // Create a new token usage record
        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await prisma.userTokenUsage.create({
          data: {
            userId: user.id,
            planId: defaultPlan.id,
            tokensUsedInPeriod: totalTokens,
            periodStartDate: now,
            periodEndDate: nextMonth
          }
        });
      }

    } catch (error) {
      console.error('TokenService: Error recording token usage:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  }
} 