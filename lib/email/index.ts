import { Resend } from 'resend';
import { 
  getWelcomeEmailTemplate, 
  getAdminNewUserNotificationTemplate, 
  getInvitationEmailTemplate,
  getSpaceJoinRequestNotificationTemplate,
  getSpaceMemberJoinedNotificationTemplate,
  getSpaceMemberApprovedNotificationTemplate,
  getSpaceMemberRejectedNotificationTemplate
} from './templates';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Sends an email using Resend
 */
export async function sendEmail({ to, subject, html, from = 'Chatstorm <hello@praxica.com>' }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}

/**
 * Sends a welcome email to a new user
 */
export async function sendWelcomeEmail(email: string, username?: string) {
  const name = username || email.split('@')[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatstorm.io';
  
  const html = getWelcomeEmailTemplate(name, appUrl);

  return sendEmail({
    to: email,
    subject: 'Welcome to Chatstorm',
    html,
  });
}

/**
 * Sends an internal notification to administrators about a new user signup
 */
export async function sendNewUserAdminNotification(user: {
  id: string;
  email: string;
  createdAt?: Date;
}) {
  // Get admin emails from environment variable (comma-separated list)
  const adminEmails = process.env.ADMIN_NOTIFICATION_EMAILS;
  if (!adminEmails) {
    console.warn('No admin notification emails configured. Skipping admin notification.');
    return { success: false, error: 'No admin emails configured' };
  }
  
  const recipients = adminEmails.split(',').map(email => email.trim());
  
  // Format user data for the template
  const userData = {
    id: user.id,
    email: user.email,
    signupDate: (user.createdAt || new Date()).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  };
  
  const html = getAdminNewUserNotificationTemplate(userData);
  
  return sendEmail({
    from: process.env.EMAIL_FROM_ADDRESS,
    to: recipients.join(','),
    subject: `New User Signup: ${user.email}`,
    html, 
  });
}

/**
 * Sends an invitation email to a recipient
 */
export async function sendInvitationEmail({
  recipientEmail,
  configTitle,
  senderName,
  senderEmail,
  invitationUrl,
  expiresAt
}: {
  recipientEmail: string;
  configTitle: string;
  senderName?: string;
  senderEmail: string;
  invitationUrl: string;
  expiresAt: Date;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatstorm.io';
  const sender = senderName || senderEmail.split('@')[0];
  
  // Format expiration date
  const expirationDate = expiresAt.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short'
  });
  
  const html = getInvitationEmailTemplate({
    recipientEmail,
    configTitle,
    sender,
    invitationUrl,
    expirationDate,
    appUrl
  });

  return sendEmail({
    to: recipientEmail,
    subject: `${sender} has invited you to view a Chatstorm design`,
    html,
  });
}

/**
 * Sends a notification email to space owners/admins when someone requests to join
 */
export async function sendSpaceJoinRequestNotification({
  spaceId,
  spaceName,
  spaceSlug,
  userEmail,
  joinInstructions
}: {
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
  userEmail: string;
  joinInstructions?: string;
}) {
  try {
    // Get space owners and admins from database
    const { prisma } = await import('@/lib/prisma');
    
    const spaceMembers = await prisma.spaceMembers.findMany({
      where: {
        spaceId: spaceId,
        role: { in: ['owner', 'admin'] },
        status: 'active'
      },
      include: {
        user: {
          select: {
            email: true,
          }
        }
      }
    });

    if (spaceMembers.length === 0) {
      console.warn(`No owners/admins found for space ${spaceId}. Skipping join request notification.`);
      return { success: false, error: 'No owners or admins found' };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatstorm.io';
    
    const html = getSpaceJoinRequestNotificationTemplate({
      spaceName,
      spaceSlug,
      userEmail,
      joinInstructions,
      appUrl
    });

    const recipients = spaceMembers.map(member => member.user.email);
    
    return sendEmail({
      to: recipients.join(','),
      subject: `New join request for ${spaceName}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send space join request notification:', error);
    return { success: false, error };
  }
}

/**
 * Sends a notification email to space owners/admins when someone joins (open signup)
 */
export async function sendSpaceMemberJoinedNotification({
  spaceId,
  spaceName,
  spaceSlug,
  userEmail,
  userName: _userName
}: {
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
  userEmail: string;
  userName?: string;
}) {
  try {
    // Get space owners and admins from database
    const { prisma } = await import('@/lib/prisma');
    
    const spaceMembers = await prisma.spaceMembers.findMany({
      where: {
        spaceId: spaceId,
        role: { in: ['owner', 'admin'] },
        status: 'active'
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (spaceMembers.length === 0) {
      console.warn(`No owners/admins found for space ${spaceId}. Skipping member joined notification.`);
      return { success: false, error: 'No owners or admins found' };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatstorm.io';
    
    const html = getSpaceMemberJoinedNotificationTemplate({
      spaceName,
      spaceSlug,
      userEmail,
      appUrl
    });

    const recipients = spaceMembers.map(member => member.user.email);
    
    return sendEmail({
      to: recipients.join(','),
      subject: `New member joined ${spaceName}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send space member joined notification:', error);
    return { success: false, error };
  }
}

/**
 * Sends approval notification email to the user
 */
export async function sendSpaceMemberApprovedEmail({
  userEmail,
  userName: _userName,
  spaceName,
  spaceSlug,
  joinInstructions
}: {
  userEmail: string;
  userName?: string;
  spaceName: string;
  spaceSlug: string;
  joinInstructions?: string;
}) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatstorm.io';
    
    const html = getSpaceMemberApprovedNotificationTemplate({
      spaceName,
      spaceSlug,
      joinInstructions,
      appUrl
    });

    return sendEmail({
      to: userEmail,
      subject: `Welcome to ${spaceName}! Your request has been approved`,
      html,
    });
  } catch (error) {
    console.error('Failed to send space member approved email:', error);
    return { success: false, error };
  }
}

/**
 * Sends rejection notification email to the user
 */
export async function sendSpaceMemberRejectedEmail({
  userEmail,
  userName: _userName,
  spaceName,
  rejectionReason,
  contactEmail
}: {
  userEmail: string;
  userName?: string;
  spaceName: string;
  rejectionReason?: string;
  contactEmail?: string;
}) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatstorm.io';
    
    const html = getSpaceMemberRejectedNotificationTemplate({
      spaceName,
      rejectionReason,
      contactEmail,
      appUrl
    });

    return sendEmail({
      to: userEmail,
      subject: `Space access request update for ${spaceName}`,
      html,
    });
  } catch (error) {
    console.error('Failed to send space member rejected email:', error);
    return { success: false, error };
  }
} 