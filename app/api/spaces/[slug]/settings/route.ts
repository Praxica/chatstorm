import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { z } from 'zod'

// Validation schema for space settings update
const updateSpaceSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['class', 'company', 'team', 'community']).optional(),
  signupMode: z.enum(['closed', 'open', 'approval']).optional(),
  allowedEmailDomain: z.string().optional(),
  autoInstallTemplates: z.array(z.string().uuid()).optional(),
  joinInstructions: z.string().optional(),
  badgeIcon: z.string().optional(),
  defaultTokenPlanId: z.string().uuid().optional().or(z.literal('')),
})

export async function PUT(
  request: Request, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId()
    const { slug } = await params
    
    // Get the space and verify permissions
    const space = await prisma.spaces.findUnique({
      where: { slug },
      include: { members: true }
    })

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 })
    }

    // Check if user is owner or admin
    const isOwner = space.ownerId === userId
    const memberRecord = space.members.find(m => m.userId === userId)
    const isAdmin = memberRecord?.role === 'admin'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }
    
    // Parse and validate the request body
    const body = await request.json()
    const validatedData = updateSpaceSettingsSchema.parse(body)

    // Update the space
    const updatedSpace = await prisma.spaces.update({
      where: { id: space.id },
      data: {
        ...validatedData,
        // Normalize allowedEmailDomain: split by comma, trim tokens, lowercase, drop empties, join
        allowedEmailDomain: typeof validatedData.allowedEmailDomain === 'string'
          ? (() => {
              const tokens = validatedData.allowedEmailDomain
                .split(',')
                .map((d) => d.trim().toLowerCase())
                .filter((d) => d.length > 0)
              return tokens.length === 0 ? null : tokens.join(',')
            })()
          : validatedData.allowedEmailDomain,
        joinInstructions: typeof validatedData.joinInstructions === 'string'
          ? (validatedData.joinInstructions.trim() === ''
              ? null
              : validatedData.joinInstructions.trim())
          : validatedData.joinInstructions,
        badgeIcon: typeof validatedData.badgeIcon === 'string'
          ? (validatedData.badgeIcon.trim() === ''
              ? null
              : validatedData.badgeIcon.trim())
          : validatedData.badgeIcon,
        defaultTokenPlanId: typeof validatedData.defaultTokenPlanId === 'string'
          ? (validatedData.defaultTokenPlanId.trim() === ''
              ? null
              : validatedData.defaultTokenPlanId.trim())
          : validatedData.defaultTokenPlanId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedSpace)
  } catch (error) {
    console.error('Error updating space settings:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update space settings' },
      { status: 500 }
    )
  }
}