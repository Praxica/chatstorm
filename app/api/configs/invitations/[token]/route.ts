import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { isAfter } from 'date-fns'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    // Get the current user ID
    await getAuthenticatedUserId()
    
    // Find the invitation by token
    const invitation = await prisma.configShareInvitation.findUnique({
      where: { token },
      include: {
        config: {
          select: {
            title: true,
            rounds: {
              select: {
                type: true
              },
              take: 1
            }
          }
        },
        sender: {
          select: {
            email: true
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
    
    const now = new Date()
    const isExpired = invitation.status === 'expired' || isAfter(now, new Date(invitation.expiresAt))
    
    // Check if the invitation has expired
    if (isExpired) {
      return NextResponse.json(
        { error: 'This invitation has expired', status: 'expired' },
        { status: 400 }
      )
    }
    
    // Check if the invitation has already been accepted
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { error: 'This invitation has already been accepted', status: 'accepted' },
        { status: 400 }
      )
    }
    
    // Return invitation details
    return NextResponse.json({
      id: invitation.id,
      configId: invitation.configId,
      configTitle: invitation.config.title,
      firstRoundType: invitation.config.rounds[0]?.type,
      senderEmail: invitation.sender.email,
      recipientEmail: invitation.recipientEmail,
      status: isExpired ? 'expired' : invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt
    })
  } catch (error) {
    console.error('Error fetching invitation:', error)
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    )
  }
} 