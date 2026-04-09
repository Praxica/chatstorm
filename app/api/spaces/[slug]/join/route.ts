import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/utils/auth'
import { logError } from '@/lib/utils/error'
import { sendSpaceJoinRequestNotification, sendSpaceMemberJoinedNotification } from '@/lib/email'

export async function POST(
  request: Request, 
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId()
    const { slug } = await params

    console.log('[JOIN] userId:', userId)
    
    // Get the space
    const space = await prisma.spaces.findUnique({
      where: { slug },
      include: { members: true }
    })

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 })
    }

    // Check if user is already a member
    const existingMember = space.members.find(m => m.userId === userId)
    if (existingMember) {
      // If they have a pending request, return a specific message
      if (existingMember.status === 'pending') {
        return NextResponse.json(
          { 
            error: 'Your request to join this space is already pending approval',
            status: 'pending',
            member: existingMember
          },
          { status: 400 }
        )
      }
      // If they're already an active member
      return NextResponse.json(
        { 
          error: 'You are already a member of this space',
          status: existingMember.status,
          member: existingMember
        },
        { status: 400 }
      )
    }

    // Check signup mode
    if (space.signupMode === 'closed') {
      return NextResponse.json(
        { error: 'Registration for this space is closed' },
        { status: 403 }
      )
    }

    // Get user info to check email domain restriction (optional, supports comma-separated list)
    const allowedDomains = typeof space.allowedEmailDomain === 'string'
      ? space.allowedEmailDomain
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d.length > 0)
      : []
    if (allowedDomains.length > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })

      if (user?.email) {
        const emailLower = user.email.toLowerCase()
        const isAllowed = allowedDomains.some((domain) => emailLower.endsWith(`@${domain}`))
        if (!isAllowed) {
          return NextResponse.json(
            { error: `Only users with @${allowedDomains.join(', @')} email addresses can join this space` },
            { status: 403 }
          )
        }
      }
    }

    // Determine status based on signup mode
    const status = space.signupMode === 'open' ? 'active' : 'pending'
    const role = 'member'

    // Create space member
    const newMember = await prisma.spaceMembers.create({
      data: {
        spaceId: space.id,
        userId,
        role,
        status,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    // If open signup and has auto-install templates, create template installs
    if (space.signupMode === 'open' && space.autoInstallTemplates.length > 0) {
      try {
        const { SpaceService } = await import('@/lib/services/SpaceService');
        await SpaceService.autoInstallTemplates(space.id, userId, '[JOIN]');
      } catch (error) {
        console.error('Error installing templates for new member:', error);
        // Don't fail the join if template installation fails
      }
    }

    // Send email notifications to space owners/admins
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        email: true
      }
    });

    if (user) {

      try {
        if (space.signupMode === 'open') {
          // Send notification for immediate join
          console.log('[JOIN] Sending space member joined notification', {
            spaceId: space.id,
            spaceName: space.name,
            spaceSlug: space.slug,
            userEmail: user.email,
          })
          await sendSpaceMemberJoinedNotification({
            spaceId: space.id,
            spaceName: space.name,
            spaceSlug: space.slug,
            userEmail: user.email,
          });
        } else if (space.signupMode === 'approval') {
          // Send notification for join request
          console.log('[JOIN] Sending space join request notification', {
            spaceId: space.id,
            spaceName: space.name,
            spaceSlug: space.slug,
            userEmail: user.email,
            hasJoinInstructions: !!space.joinInstructions
          })
          await sendSpaceJoinRequestNotification({
            spaceId: space.id,
            spaceName: space.name,
            spaceSlug: space.slug,
            userEmail: user.email,
            joinInstructions: space.joinInstructions ?? undefined
          });
        }
      } catch (emailError) {
        // Log email error but don't fail the join process
        logError('Sending space notification email', emailError);
      }
    }

    const responseMessage = space.signupMode === 'open'
      ? 'Successfully joined space'
      : 'Join request submitted for approval'

    return NextResponse.json({
      message: responseMessage,
      member: newMember,
      status,
    })
  } catch (error) {
    logError('POST /api/spaces/[slug]/join', error)
    return NextResponse.json(
      { error: 'Failed to join space' },
      { status: 500 }
    )
  }
}