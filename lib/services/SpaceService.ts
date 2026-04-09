import { prisma } from '@/lib/prisma';

export type SpaceType = 'class' | 'company' | 'team' | 'community';
export type SpaceRole = 'owner' | 'admin' | 'member';
export type SpaceMemberStatus = 'pending' | 'active' | 'suspended';

export interface CreateSpaceData {
  name: string;
  slug: string;
  description?: string;
  type: SpaceType;
  settings?: Record<string, any>;
  badgeIcon?: string | null;
  signupMode?: 'closed' | 'open' | 'approval';
  allowedEmailDomain?: string | null;
  joinInstructions?: string | null;
}

export interface SpaceWithMembers {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: SpaceType;
  ownerId: string;
  settings: Record<string, any>;
  memberCount: number;
  userRole?: SpaceRole;
  userStatus?: SpaceMemberStatus;
  badgeIcon?: string | null;
}

export class SpaceService {
  
  /**
   * Create a new space
   */
  static async createSpace(ownerIdOrExternalId: string, data: CreateSpaceData) {
    // Check if it's a Clerk ID (starts with 'user_') or internal UUID
    const isClerkId = ownerIdOrExternalId.startsWith('user_');
    
    const user = await prisma.user.findFirst({
      where: isClerkId
        ? { externalId: ownerIdOrExternalId }
        : { id: ownerIdOrExternalId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const ownerId = user.id;
    const space = await prisma.spaces.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        ownerId,
        type: data.type,
        settings: data.settings || {},
        badgeIcon: data.badgeIcon || null,
        signupMode: data.signupMode || 'approval',
        allowedEmailDomain: data.allowedEmailDomain || null,
        joinInstructions: data.joinInstructions || null,
        modelSettings: {
          mode: 'all',
          defaultModel: null,
          excludedModels: [],
          includedModels: [],
        },
        autoInstallTemplates: [],
      }
    });

    // Add the owner as a member
    await prisma.spaceMembers.create({
      data: {
        spaceId: space.id,
        userId: ownerId,
        role: 'owner',
        status: 'active'
      }
    });

    return space;
  }

  /**
   * Get spaces where user is a member
   */
  static async getUserSpaces(userIdOrExternalId: string): Promise<SpaceWithMembers[]> {
    // Check if it's a Clerk ID (starts with 'user_') or internal UUID
    const isClerkId = userIdOrExternalId.startsWith('user_');
    
    const user = await prisma.user.findFirst({
      where: isClerkId
        ? { externalId: userIdOrExternalId }
        : { id: userIdOrExternalId }
    });

    if (!user) {
      return [];
    }

    const memberships = await prisma.spaceMembers.findMany({
      where: {
        userId: user.id,
        status: 'active'
      },
      include: {
        space: {
          include: {
            _count: {
              select: {
                members: {
                  where: { status: 'active' }
                }
              }
            }
          }
        }
      }
    });

    return memberships.map(membership => ({
      id: membership.space.id,
      name: membership.space.name,
      slug: membership.space.slug,
      description: membership.space.description,
      type: membership.space.type as SpaceType,
      ownerId: membership.space.ownerId,
      settings: membership.space.settings as Record<string, any>,
      memberCount: membership.space._count.members,
      userRole: membership.role as SpaceRole,
      userStatus: membership.status as SpaceMemberStatus,
      badgeIcon: membership.space.badgeIcon,
    }));
  }

  /**
   * Get space by slug if user has access
   */
  static async getSpaceBySlug(slug: string, userIdOrExternalId: string) {
    // Check if it's a Clerk ID (starts with 'user_') or internal UUID
    const isClerkId = userIdOrExternalId.startsWith('user_');
    
    const user = await prisma.user.findFirst({
      where: isClerkId
        ? { externalId: userIdOrExternalId }
        : { id: userIdOrExternalId }
    });

    if (!user) {
      return null;
    }

    const space = await prisma.spaces.findUnique({
      where: { slug },
      include: {
        members: {
          where: { userId: user.id },
          select: { role: true, status: true }
        },
        _count: {
          select: {
            members: { where: { status: 'active' } },
            templates: true,
            configs: true
          }
        }
      }
    });

    if (!space || space.members.length === 0) {
      return null;
    }

    const member = space.members[0];
    return {
      ...space,
      userRole: member.role as SpaceRole,
      userStatus: member.status as SpaceMemberStatus,
      memberCount: space._count.members,
      templateCount: space._count.templates,
      configCount: space._count.configs,
    };
  }

  /**
   * Get space by ID if user has access
   */
  static async getSpaceById(spaceId: string, userIdOrExternalId: string) {
    // Check if it's a Clerk ID (starts with 'user_') or internal UUID
    const isClerkId = userIdOrExternalId.startsWith('user_');
    
    const user = await prisma.user.findFirst({
      where: isClerkId
        ? { externalId: userIdOrExternalId }
        : { id: userIdOrExternalId }
    });

    if (!user) {
      return null;
    }

    const space = await prisma.spaces.findUnique({
      where: { id: spaceId },
      include: {
        members: {
          where: { userId: user.id },
          select: { role: true, status: true }
        },
        _count: {
          select: {
            members: { where: { status: 'active' } },
            templates: true,
            configs: true
          }
        }
      }
    });

    if (!space || space.members.length === 0) {
      return null;
    }

    const member = space.members[0];
    return {
      ...space,
      userRole: member.role as SpaceRole,
      userStatus: member.status as SpaceMemberStatus,
      memberCount: space._count.members,
      templateCount: space._count.templates,
      configCount: space._count.configs,
    };
  }

  /**
   * Check if user has permission in space
   */
  static async checkPermission(spaceId: string, userId: string, requiredRole: SpaceRole = 'member'): Promise<boolean> {
    const member = await prisma.spaceMembers.findFirst({
      where: {
        spaceId,
        userId,
        status: 'active'
      }
    });

    if (!member) return false;

    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    return roleHierarchy[member.role as SpaceRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Generate a unique slug from name
   */
  static async generateSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.spaces.findUnique({
        where: { slug },
        select: { id: true }
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Invite user to space
   */
  static async inviteUser(spaceId: string, userEmail: string, inviterId: string, role: SpaceRole = 'member') {
    // Check if inviter has permission
    const canInvite = await this.checkPermission(spaceId, inviterId, 'admin');
    if (!canInvite) {
      throw new Error('Insufficient permissions to invite users');
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { 
        OR: [
          { email: userEmail },
          { externalId: userEmail } // In case they use Clerk ID
        ]
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already a member
    const existing = await prisma.spaceMembers.findFirst({
      where: {
        spaceId,
        userId: user.id
      }
    });

    if (existing) {
      throw new Error('User is already a member of this space');
    }

    // Create membership
    return await prisma.spaceMembers.create({
      data: {
        spaceId,
        userId: user.id,
        role,
        status: 'pending' // Requires approval
      }
    });
  }

  /**
   * Approve pending member
   */
  static async approveMember(spaceId: string, memberUserId: string, approverId: string) {
    const canApprove = await this.checkPermission(spaceId, approverId, 'admin');
    if (!canApprove) {
      throw new Error('Insufficient permissions to approve members');
    }

    // Get space default token plan
    const space = await prisma.spaces.findUnique({
      where: { id: spaceId },
      select: { defaultTokenPlanId: true }
    });
    // console.log('[APPROVE_SERVICE] Space default token plan:', { spaceId, defaultTokenPlanId: space?.defaultTokenPlanId });

    const updateData = {
      status: 'active' as const,
      // Assign default token plan if one exists
      ...(space?.defaultTokenPlanId && { tokenPlanId: space.defaultTokenPlanId })
    };
    // console.log('[APPROVE_SERVICE] Update data for member:', updateData);

    const result = await prisma.spaceMembers.updateMany({
      where: {
        spaceId,
        userId: memberUserId,
        status: 'pending'
      },
      data: updateData
    });
    
    // console.log('[APPROVE_SERVICE] UpdateMany result:', result);

    // If default token plan was assigned, create space token usage record
    if (space?.defaultTokenPlanId) {
      // console.log('[APPROVE_SERVICE] Creating space token usage record...');
      try {
        // Get the token plan details
        const tokenPlan = await prisma.spaceTokenPlan.findUnique({
          where: { id: space.defaultTokenPlanId }
        });
        
        if (tokenPlan) {
          const now = new Date();
          const periodEndDate = new Date(now);
          if (tokenPlan.cadence === 'WEEKLY') {
            periodEndDate.setDate(periodEndDate.getDate() + 7);
          } else {
            periodEndDate.setMonth(periodEndDate.getMonth() + 1);
          }

          await prisma.spaceTokenUsage.upsert({
            where: {
              spaceId_userId: {
                spaceId,
                userId: memberUserId
              }
            },
            create: {
              spaceId,
              userId: memberUserId,
              periodStartDate: now,
              periodEndDate,
              tokensUsedInPeriod: 0
            },
            update: {
              periodStartDate: now,
              periodEndDate,
              tokensUsedInPeriod: 0
            }
          });
          // console.log('[APPROVE_SERVICE] Created/updated space token usage:', spaceTokenUsage);
        } else {
          // console.log('[APPROVE_SERVICE] Token plan not found:', space.defaultTokenPlanId);
        }
      } catch (tokenUsageError) {
        console.error('[APPROVE_SERVICE] Failed to create space token usage:', tokenUsageError);
        // Don't fail the approval if token usage creation fails
      }
    } else {
      console.log('[APPROVE_SERVICE] No default token plan to assign');
    }

    return result;
  }

  /**
   * Auto-install space templates for a user
   */
  static async autoInstallTemplates(spaceId: string, userId: string, logPrefix: string = '[TEMPLATE]'): Promise<{ successful: number; failed: number }> {
    try {
      // Get space auto-install templates
      const space = await prisma.spaces.findUnique({
        where: { id: spaceId },
        select: {
          autoInstallTemplates: true,
          name: true
        }
      });

      if (!space || !space.autoInstallTemplates || space.autoInstallTemplates.length === 0) {
        return { successful: 0, failed: 0 };
      }

      // Get templates that exist with full config data
      const templates = await prisma.template.findMany({
        where: {
          id: { in: space.autoInstallTemplates },
          spaceId: spaceId,
        },
        include: {
          config: {
            include: {
              rounds: {
                include: {
                  participants: true,
                  stances: true
                }
              },
              projects: {
                select: {
                  id: true,
                  name: true,
                  description: true
                }
              }
            }
          }
        }
      });

      if (templates.length === 0) {
        return { successful: 0, failed: 0 };
      }
      
      // Install each template
      const results = await Promise.all(
        templates.map(async (template) => {
          try {
            // Copy the template's config to create a space-scoped config for the user
            const { ConfigService } = await import('@/lib/services/ConfigService');
            const newConfig = await ConfigService.copyConfig(
              template.config as any,
              userId,
              {
                appendToTitle: '',
                appendToAgentNames: '',
                spaceId: spaceId // Pass the spaceId to create space-scoped configs
              }
            );

            if (!newConfig) {
              throw new Error('Failed to copy config');
            }

            // Create the template install record with the new config
            await prisma.templateInstall.create({
              data: {
                templateId: template.id,
                userId: userId,
                configId: newConfig.id,
              },
            });

            return { success: true, templateTitle: template.title };
          } catch (error: any) {
            return { success: false, templateTitle: template.title, error: error.message };
          }
        })
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      return { successful, failed };
    } catch (error: any) {
      console.error(`${logPrefix} Error in auto-install templates:`, error.message);
      return { successful: 0, failed: 0 };
    }
  }

  /**
   * Get user's spaces via API
   */
  static async getSpacesViaApi(): Promise<SpaceWithMembers[]> {
    const response = await fetch('/api/spaces');
    if (!response.ok) {
      throw new Error(`Failed to fetch spaces: ${response.statusText}`);
    }
    const data = await response.json();
    return data.spaces || [];
  }

  /**
   * Get space by slug (public - no membership required)
   */
  static async getSpaceBySlugPublic(slug: string) {
    const space = await prisma.spaces.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        type: true,
        ownerId: true,
        badgeIcon: true,
        signupMode: true,
        allowedEmailDomain: true,
        joinInstructions: true,
        _count: {
          select: {
            members: { where: { status: 'active' } }
          }
        }
      }
    });

    if (!space) {
      return null;
    }

    return {
      ...space,
      memberCount: space._count.members
    };
  }

  /**
   * Get space member by user ID
   */
  static async getSpaceMemberByUserId(spaceId: string, userIdOrExternalId: string) {
    // Check if it's a Clerk ID (starts with 'user_') or internal UUID
    const isClerkId = userIdOrExternalId.startsWith('user_');
    
    const user = await prisma.user.findFirst({
      where: isClerkId
        ? { externalId: userIdOrExternalId }
        : { id: userIdOrExternalId }
    });

    if (!user) {
      return null;
    }

    const member = await prisma.spaceMembers.findFirst({
      where: {
        spaceId,
        userId: user.id
      },
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true
      }
    });

    return member;
  }
}