import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { ConfigService } from '@/lib/services/ConfigService'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId()
    const { templateId } = await params
    
    // Get spaceId from request body if provided (for space installations)
    const body = await request.json().catch(() => ({}))
    const spaceId = body.spaceId || null

    // Find the template
    const template = await prisma.template.findUnique({
      where: { id: templateId },
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
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Check if user has already installed this template
    const existingInstalls = await prisma.templateInstall.findMany({
      where: {
        templateId: template.id,
        userId
      },
      include: {
        config: {
          select: {
            title: true
          }
        }
      }
    })

    // If user has existing installs, add a number suffix to the title
    const appendToTitle = existingInstalls.length > 0 ? ` (${existingInstalls.length + 1})` : ''

    // Copy the config using the ConfigService
    const newConfig = await ConfigService.copyConfig(
      template.config as any,
      userId,
      {
        appendToTitle,
        appendToAgentNames: '',
        spaceId // Pass spaceId for space installations
      }
    )

    // Upsert template install record to respect unique constraint (templateId, userId)
    // Only increment the template's overall install count the first time this user installs it.

    // Determine if this is the first install by this user
    const isFirstInstall = existingInstalls.length === 0;

    await prisma.$transaction([
      prisma.templateInstall.upsert({
        where: {
          templateId_userId: {
            templateId: template.id,
            userId
          }
        },
        create: {
          templateId: template.id,
          userId,
          configId: newConfig!.id
        },
        update: {
          configId: newConfig!.id,
          installedAt: new Date()
        }
      }),
      ...(isFirstInstall
        ? [
            prisma.template.update({
              where: { id: template.id },
              data: {
                installs: {
                  increment: 1
                }
              }
            })
          ]
        : [])
    ])

    return NextResponse.json({
      success: true,
      configId: newConfig!.id
    })
  } catch (error) {
    console.error('Error installing template:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to install template' },
      { status: 500 }
    )
  }
} 