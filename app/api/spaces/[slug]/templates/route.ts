import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { z } from 'zod'

// Validation schema for space template creation
const createSpaceTemplateSchema = z.object({
  configId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
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

    // Check if user has access to this space
    const isOwner = space.ownerId === userId
    const isMember = space.members.some(m => m.userId === userId && m.status === 'active')

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch templates for this space
    const templates = await prisma.template.findMany({
      where: { spaceId: space.id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        config: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching space templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
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
    const validatedData = createSpaceTemplateSchema.parse(body)
    
    // Validate user has access to the config
    const config = await prisma.config.findUnique({
      where: { id: validatedData.configId },
      select: { userId: true, title: true }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      )
    }

    if (config.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only create templates from your own apps' },
        { status: 403 }
      )
    }

    // Create the space template
    const template = await prisma.template.create({
      data: {
        ...validatedData,
        authorId: userId,
        spaceId: space.id,
        isPublic: false, // Space templates are not public
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        config: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error creating space template:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}