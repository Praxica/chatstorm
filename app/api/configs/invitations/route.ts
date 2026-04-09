import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { isAfter } from 'date-fns'

// GET - List invitations where the current user is the sender
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    
    // Get all invitations where the current user is the sender
    const invitations = await prisma.configShareInvitation.findMany({
      where: {
        senderUserId: userId
      },
      include: {
        config: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Check for expired invitations on-the-fly
    const now = new Date()
    const processedInvitations = invitations.map(invitation => {
      // If the invitation is pending and has expired, mark it as expired in the response
      // but don't update the database
      const effectiveStatus = 
        invitation.status === 'pending' && isAfter(now, new Date(invitation.expiresAt))
          ? 'expired'
          : invitation.status
      
      return {
        id: invitation.id,
        configId: invitation.configId,
        configTitle: invitation.config.title,
        recipientEmail: invitation.recipientEmail,
        status: effectiveStatus,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt
      }
    })
    
    return NextResponse.json(processedInvitations)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
} 