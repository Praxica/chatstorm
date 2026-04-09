import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { sendWelcomeEmail, sendNewUserAdminNotification } from '@/lib/email'

type DbUser = {
  id: string;
  email: string;
  externalId: string;
}

export async function POST(req: Request) {
  // Log the start of webhook processing with timestamp
  const startTime = new Date();
  console.log('==================== WEBHOOK START ====================');
  console.log('Webhook received at:', startTime.toISOString());
  
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('Error: WEBHOOK_SECRET is not set');
    throw new Error('Error: Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // Log all headers for debugging
  console.log('Webhook Headers:', {
    'svix-id': svix_id,
    'svix-timestamp': svix_timestamp,
    'svix-signature': svix_signature?.substring(0, 10) + '...' // Only log part of the signature
  });

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Error: Missing Svix headers');
    return new Response('Error: Missing Svix headers', {
      status: 400,
    })
  }

  // Get body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create new Svix instance with secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error: Could not verify webhook:', err)
    return new Response('Error: Verification error', {
      status: 400,
    })
  }

  // Log webhook details
  console.log(`Webhook Type: ${evt.type}`);
  console.log('Webhook Data:', JSON.stringify(evt.data, null, 2));
  
  // Handle the webhook
  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const { id, email_addresses } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address;

    console.log('Processing user data:', {
      clerkUserId: id,
      primaryEmail,
      emailAddresses: email_addresses
    });

    if (!primaryEmail) {
      console.error('Error: No email found for user:', id);
      return new Response('Error: No email found', { status: 400 });
    }

    try {
      // Find existing user by externalId index
      console.log('Checking for existing user with externalId:', id);
      const existingUsers = await prisma.$queryRaw<DbUser[]>`
        SELECT * FROM "User" WHERE "externalId" = ${id} LIMIT 1
      `;

      if (existingUsers[0]) {
        console.log('Found existing user:', existingUsers[0]);
        // Update existing user
        const user = await prisma.user.update({
          where: { id: existingUsers[0].id },
          data: {
            email: primaryEmail,
          }
        });
        console.log('Updated user:', user);
        return new Response(JSON.stringify({ user }), { status: 200 });
      } else {
        console.log('No existing user found, creating new user');
        // Create new user with capabilities
        const newUserId = randomUUID();
        console.log('Generated new UUID:', newUserId);
        
        const user = await prisma.user.create({
          data: {
            id: newUserId,
            email: primaryEmail,
            externalId: id,
            capabilities: {
              create: {
                isBuilder: false,
                isChatUser: true,
              }
            }
          },
          include: {
            capabilities: true
          }
        });
        console.log('Created new user with full details:', user);

        // Send welcome email
        try {
          console.log('Sending welcome email to:', primaryEmail);
          const emailResult = await sendWelcomeEmail(primaryEmail);
          console.log('Welcome email sent result:', emailResult);
          
          // Send admin notification
          console.log('Sending admin notification for new user');
          const adminNotificationResult = await sendNewUserAdminNotification({
            id: user.id,
            email: user.email,
            createdAt: new Date()
          });
          console.log('Admin notification sent result:', adminNotificationResult);
        } catch (emailError) {
          console.error('Failed to send emails:', emailError);
          // Continue execution even if email fails
        }

        return new Response(JSON.stringify({ user }), { status: 200 });
      }
    } catch (error) {
      console.error('Database Error:', error);
      console.error('Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
      return new Response('Error: Database operation failed', { status: 500 });
    }
  }

  if (evt.type === 'user.deleted') {
    try {
      console.log('Processing user deletion for Clerk ID:', evt.data.id);
      // Find user by externalId using raw query
      const users = await prisma.$queryRaw<DbUser[]>`
        SELECT id FROM "User" WHERE "externalId" = ${evt.data.id} LIMIT 1
      `;

      if (users[0]) {
        console.log('Found user to delete:', users[0].id);
        await prisma.user.delete({
          where: { id: users[0].id }
        });
        console.log('Successfully deleted user:', users[0].id);
      } else {
        console.log('No user found to delete for Clerk ID:', evt.data.id);
      }

      return new Response('User deleted', { status: 200 });
    } catch (error) {
      console.error('Deletion Error:', error);
      console.error('Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
      return new Response('Error: Failed to delete user', { status: 500 });
    }
  }

  // Return 200 for unhandled event types
  console.log('Unhandled webhook type:', evt.type);
  console.log('==================== WEBHOOK END ====================');
  return new Response('Webhook received', { status: 200 });
} 