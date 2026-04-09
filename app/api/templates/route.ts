import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, validateUserAccess } from '@/lib/utils/auth'
import { z } from 'zod'

// Validation schema for template creation
const createTemplateSchema = z.object({
  configId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categoryId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
  previewChatId: z.string().uuid().optional(),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const tags = searchParams.get('tags')?.split(',')
    const spaceId = searchParams.get('spaceId')
    
    // Build the where clause
    // If spaceId is provided, filter by spaceId; otherwise filter by isPublic
    const where = {
      ...(spaceId ? { spaceId } : { isPublic: true }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(tags && tags.length > 0 && {
        tags: {
          hasSome: tags,
        },
      }),
    }

    const templates = await prisma.template.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        category: true,
      },
      orderBy: {
        installs: 'desc',
      },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId()
    
    // Parse and validate the request body
    const body = await request.json()
    const validatedData = createTemplateSchema.parse(body)
    
    // Validate user has access to the config
    const config = await prisma.config.findUnique({
      where: { id: validatedData.configId },
      select: { userId: true }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      )
    }

    await validateUserAccess(config.userId)

    // Create the template
    const template = await prisma.template.create({
      data: {
        ...validatedData,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        category: true,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error creating template:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
} 