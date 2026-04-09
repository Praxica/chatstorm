import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: body.name,
        description: body.description,
      }
    })

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error('Error updating project:', error)
    return new NextResponse('Error updating project', { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    // Delete project
    await prisma.project.delete({
      where: { id: projectId }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting project:', error)
    return new NextResponse('Error deleting project', { status: 500 })
  }
} 