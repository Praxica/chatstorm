import type { SpaceModelSettings } from '@/lib/schemas/prisma-typed';

export type SpaceType = 'class' | 'company' | 'team' | 'community';
export type SpaceRole = 'owner' | 'admin' | 'member';
export type SpaceMemberStatus = 'pending' | 'active' | 'suspended';

export interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: SpaceType;
  ownerId: string;
  settings: Record<string, unknown>;
  modelSettings?: SpaceModelSettings | null;
  badgeIcon?: string | null;
  signupMode?: string;
  joinInstructions?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpaceMember {
  id: string;
  spaceId: string;
  userId: string;
  role: SpaceRole;
  status: SpaceMemberStatus;
  joinedAt: Date;
}

// Note: We use existing Template model with spaceId field instead of SpaceConfig
// Note: We use existing Chat model, potentially with spaceId field instead of SpaceChat

// Settings schemas for different space types
export interface ClassSpaceSettings {
  allowSelfSignup: boolean;
  requireApproval: boolean;
  signupForm: {
    requiredFields: string[];
    customFields: Array<{
      name: string;
      type: 'text' | 'email' | 'select';
      required: boolean;
      options?: string[];
    }>;
  };
  modelRestrictions: {
    allowedModels: string[];
    defaultModel?: string;
  };
}

export interface CompanySpaceSettings {
  domains: string[]; // Email domains for auto-approval
  ssoEnabled: boolean;
  dataRetention: number; // days
  auditLogs: boolean;
}