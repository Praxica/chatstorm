import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { z } from 'zod'

// Validation schema for category creation
const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function GET() {
  try {
    const categories = await prisma.templateCategory.findMany({
      include: {
        _count: {
          select: {
            templates: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching template categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await getAuthenticatedUserId()
    
    // Parse and validate the request body
    const body = await request.json()
    const validatedData = createCategorySchema.parse(body)
    
    // Create the category
    const category = await prisma.templateCategory.create({
      data: validatedData,
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error creating template category:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create template category' },
      { status: 500 }
    )
  }
} 