import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { isAfter } from 'date-fns'
import { ConfigService } from '@/lib/services/ConfigService'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    // Get the current user ID
    const userId = await getAuthenticatedUserId()
    
    // Find the invitation by token
    const invitation = await prisma.configShareInvitation.findUnique({
      where: { token },
      include: {
        config: {
          include: {
            rounds: {
              include: {
                participants: true,
                stances: true
              }
            },
            projects: true
          }
        }
      }
    })
    
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }
    
    // Check if the invitation has expired
    const now = new Date()
    const isExpired = invitation.status === 'expired' || isAfter(now, new Date(invitation.expiresAt))
    
    if (isExpired) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      )
    }
    
    // Check if the invitation has already been accepted
    if (invitation.status === 'accepted') {
      // Instead of returning an error, return a success response with info about the original acceptance
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        message: 'This invitation has already been accepted.',
        // Try to find the previously created config if possible
        configId: invitation.configId
      }, { status: 200 })
    }
    
    // Copy the config using the ConfigService server method
    const newConfig = await ConfigService.copyConfig(
      invitation.config,
      userId,
      {
        appendToTitle: ' (Shared)',
        appendToAgentNames: ' (Shared)',
        reuseAgents: false, // Create new agents for different user account
        reuseProjects: true // For now, reuse projects (might want to make this configurable)
      }
    )

    if (!newConfig) {
      throw new Error('Failed to create config copy')
    }
    
    // Mark the invitation as accepted
    await prisma.configShareInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date()
      }
    })
    
    // Return the new config
    return NextResponse.json({
      success: true,
      message: 'Design copied successfully',
      configId: newConfig.id
    })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to accept invitation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 