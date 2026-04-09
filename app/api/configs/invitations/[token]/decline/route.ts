import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAfter } from 'date-fns'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    // Find the invitation by token
    const invitation = await prisma.configShareInvitation.findUnique({
      where: { token }
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
    
    // Check if the invitation has already been processed
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      )
    }
    
    if (invitation.status === 'declined') {
      return NextResponse.json(
        { error: 'This invitation has already been declined' },
        { status: 400 }
      )
    }
    
    // Mark the invitation as declined - this is the only status update we need to persist
    await prisma.configShareInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'declined'
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Invitation declined successfully'
    })
  } catch (error) {
    console.error('Error declining invitation:', error)
    
    return NextResponse.json(
      { error: 'Failed to decline invitation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 