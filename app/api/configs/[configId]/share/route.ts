import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId, validateUserAccess } from '@/lib/utils/auth'
import { z } from 'zod'
import crypto from 'crypto'
import { addDays } from 'date-fns'
import { sendInvitationEmail } from '@/lib/email'

// Validation schema for share invitation
const shareInvitationSchema = z.object({
  recipientEmail: z.string().email('Invalid email address'),
})

export async function POST(
  request: Request,
  { params }: { params: { configId: string } }
) {
  try {
    const { configId } = params
    
    // Get the current user ID
    const userId = await getAuthenticatedUserId()
    
    // Get the config to validate user access
    const config = await prisma.config.findUnique({
      where: { id: configId },
      select: { userId: true, title: true }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      )
    }

    // Validate user access (only the owner can share)
    await validateUserAccess(config.userId)
    
    // Parse and validate the request body
    const body = await request.json()
    const validatedData = shareInvitationSchema.parse(body)
    
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex')
    
    // Set expiration to 24 hours from now
    const expiresAt = addDays(new Date(), 1)
    
    // Get the sender's information
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    })

    if (!sender) {
      return NextResponse.json(
        { error: 'Sender information not found' },
        { status: 500 }
      )
    }
    
    // Create the share invitation
    const invitation = await prisma.configShareInvitation.create({
      data: {
        configId,
        senderUserId: userId,
        recipientEmail: validatedData.recipientEmail,
        token,
        expiresAt,
      }
    })

    // Generate the invitation URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatstorm.io'
    const invitationUrl = `${appUrl}/invitations/${token}`
    
    // Send the invitation email
    try {
      await sendInvitationEmail({
        recipientEmail: validatedData.recipientEmail,
        configTitle: config.title,
        senderEmail: sender.email,
        invitationUrl,
        expiresAt
      })
      
      console.log(`Sent invitation email to: ${validatedData.recipientEmail}`)
    } catch (emailError) {
      // Log the error but don't fail the request
      console.error('Failed to send invitation email:', emailError)
    }
    
    // Return the invitation (without the token for security)
    return NextResponse.json({
      id: invitation.id,
      configId: invitation.configId,
      recipientEmail: invitation.recipientEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error('Error creating share invitation:', error)
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    // Handle unauthorized errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Failed to create share invitation' },
      { status: 500 }
    )
  }
} 