import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { z } from 'zod'

// Validation schema for template update
const updateTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function PUT(
  request: Request, 
  { params }: { params: Promise<{ slug: string; templateId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId()
    const { slug, templateId } = await params
    
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

    // Verify template exists and belongs to this space
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: templateId,
        spaceId: space.id,
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }
    
    // Parse and validate the request body
    const body = await request.json()
    const validatedData = updateTemplateSchema.parse(body)

    // Update the template
    const updatedTemplate = await prisma.template.update({
      where: { id: templateId },
      data: validatedData,
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

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error('Error updating space template:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request, 
  { params }: { params: Promise<{ slug: string; templateId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId()
    const { slug, templateId } = await params
    
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

    // Verify template exists and belongs to this space
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: templateId,
        spaceId: space.id,
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Delete the template
    await prisma.template.delete({
      where: { id: templateId },
    })

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Error deleting space template:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}