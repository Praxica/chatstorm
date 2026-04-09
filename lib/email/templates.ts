/**
 * Email templates for the application
 */

/**
 * Welcome email template
 */
export function getWelcomeEmailTemplate(name: string, appUrl: string) {
  return `
    <!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Chatstorm</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        color: #333333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 40px 20px;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .logo {
        font-size: 24px;
        font-weight: bold;
        color: #000000;
        text-decoration: none;
      }
      h1 {
        color: #000000;
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 20px;
      }
      h2 {
        color: #000000;
        font-size: 18px;
        font-weight: 600;
        margin-top: 30px;
        margin-bottom: 15px;
      }
      p {
        margin-bottom: 20px;
        font-size: 16px;
      }
      .button {
        display: inline-block;
        background-color: #000000;
        color: #ffffff !important;
        text-decoration: none;
        padding: 12px 30px;
        border-radius: 4px;
        font-weight: 500;
        margin: 20px 0;
      }
      .discord-link {
        color: #5865F2;
        text-decoration: none;
        font-weight: 500;
      }
      .footer {
        margin-top: 40px;
        text-align: center;
        font-size: 14px;
        color: #666666;
      }
      ul {
        margin-bottom: 20px;
      }
      li {
        margin-bottom: 8px;
        font-size: 16px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <a href="${appUrl}" class="logo">Chatstorm</a>
      </div>
      
      <h1>Welcome to Chatstorm!</h1>
      
      <p>You've just joined a platform that's rethinking what AI conversations can be. Instead of talking to a single chatbot, you can now orchestrate entire cohorts of AI agents—each with their own personality and expertise—to collaborate, debate, and build together.</p>
      
      <h2>Getting Started</h2>
      
      <p>The best way to learn is to dive in. Here are a few ideas to spark your first chat:</p>
      
      <ul>
        <li>Browse some <a href="https://chatstorm.io/templates">Templates</a> to see what's possible and see how different chats are built</li>
        <li>Create your first <strong>Chat Agent</strong> and give it a unique personality</li>
        <li>Design a simple <strong>Chat</strong> with a couple rounds—maybe a brainstorm followed by a critique</li>
      </ul>
      
      <p>Don't worry if it feels complex at first. The power of Chatstorm comes from experimentation.</p>
      
      <h2>Join the Conversation</h2>
      
      <p>We're building a community around Artificial Social Intelligence (ASI)—the idea that for AIs to become more intelligent, they must become more social. Join our <a href="https://discord.gg/yPecqWqUrC" class="discord-link">Discord community</a> to connect with other users, share research, and explore the future of social AI.</p>
      
      <h2>Not Sure If This Will Work for Your Idea?</h2>
      
      <p>That's totally normal! Chatstorm is a different kind of tool, and sometimes the best way forward is just to talk it through. <strong>Reply to this email</strong> or reach out anytime—we'd love to hear what you're trying to accomplish and help you figure out if (and how) Chatstorm can help.</p>
      
      <div style="text-align: center;">
        <a href="${appUrl}" class="button">Log in to Chatstorm</a>
      </div>
      
      <p>Welcome aboard,<br>The Chatstorm Team</p>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Chatstorm. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
  `;
}

/**
 * Admin notification template for new user signup
 */
export function getAdminNewUserNotificationTemplate(userData: {
  email: string;
  id: string;
  signupDate: string;
  adminDashboardUrl?: string;
}) {
  const { email, id, signupDate } = userData;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New User Signup: ${email}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          color: #333333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        h1 {
          color: #000000;
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .card {
          background-color: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .user-detail {
          margin-bottom: 8px;
        }
        .label {
          font-weight: 600;
          display: inline-block;
          min-width: 120px;
        }
        .button {
          display: inline-block;
          background-color: #000000;
          color: #ffffff !important;
          text-decoration: none;
          padding: 10px 24px;
          border-radius: 4px;
          font-weight: 500;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          font-size: 14px;
          color: #666666;
          border-top: 1px solid #eeeeee;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎉 New User Registration</h1>
        
        <div class="card">
          <div class="user-detail">
            <span class="label">Email:</span> ${email}
          </div>
          <div class="user-detail">
            <span class="label">User ID:</span> ${id}
          </div>
          <div class="user-detail">
            <span class="label">Signed up:</span> ${signupDate}
          </div>
        </div>
        
        <p>A new user has signed up for Chatstorm. You may want to review their account or reach out to welcome them.</p>
        
        <div class="footer">
          <p>This is an automated message from the Chatstorm platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Invitation email template
 */
export function getInvitationEmailTemplate({
  recipientEmail: _recipientEmail,
  configTitle,
  sender,
  invitationUrl,
  expirationDate,
  appUrl
}: {
  recipientEmail: string;
  configTitle: string;
  sender: string;
  invitationUrl: string;
  expirationDate: string;
  appUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Design Invitation from ${sender}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          color: #333333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #000000;
          text-decoration: none;
        }
        h1 {
          color: #000000;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 20px;
          font-size: 16px;
        }
        .button {
          display: inline-block;
          background-color: #000000;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 30px;
          border-radius: 4px;
          font-weight: 500;
          margin: 20px 0;
        }
        .card {
          background-color: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 20px;
          margin-bottom: 25px;
        }
        .detail {
          margin-bottom: 10px;
        }
        .label {
          font-weight: 600;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 14px;
          color: #666666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="${appUrl}" class="logo">Chatstorm</a>
        </div>
        
        <h1>You've Been Invited!</h1>
        
        <p>${sender} has invited you to view a design in Chatstorm.</p>
        
        <div class="card">
          <div class="detail">
            <div class="label">Design:</div>
            ${configTitle}
          </div>
          <div class="detail">
            <div class="label">From:</div>
            ${sender}
          </div>
          <div class="detail">
            <div class="label">Expires:</div>
            ${expirationDate}
          </div>
        </div>
        
        <p>Click the button below to view the design:</p>
        
        <div style="text-align: center;">
          <a href="${invitationUrl}" class="button">View Design</a>
        </div>
        
        <p><strong>Note:</strong> This invitation link will expire on ${expirationDate}.</p>
        
        <p>If you don't have a Chatstorm account yet, you'll be able to create one after accepting the invitation.</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Chatstorm. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Space join request notification template for space owners/admins
 */
export function getSpaceJoinRequestNotificationTemplate({
  spaceName,
  spaceSlug,
  userEmail,
  userName,
  joinInstructions,
  spaceSettingsUrl,
  appUrl
}: {
  spaceName: string;
  spaceSlug: string;
  userEmail: string;
  userName?: string;
  joinInstructions?: string;
  spaceSettingsUrl?: string;
  appUrl: string;
}) {
  const displayName = userName || userEmail.split('@')[0];
  const settingsUrl = spaceSettingsUrl || `${appUrl}/spaces/${spaceSlug}/admin/members`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Join Request: ${spaceName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          color: #333333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #000000;
          text-decoration: none;
        }
        h1 {
          color: #000000;
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 20px;
          font-size: 16px;
        }
        .card {
          background-color: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }
        .detail {
          margin-bottom: 12px;
        }
        .label {
          font-weight: 600;
          display: inline-block;
          min-width: 100px;
        }
        .button {
          display: inline-block;
          background-color: #000000;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .instructions {
          background-color: #f0f9ff;
          border-left: 4px solid #3b82f6;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 14px;
          color: #666666;
          border-top: 1px solid #eeeeee;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="${appUrl}" class="logo">Chatstorm</a>
        </div>
        
        <h1>🔔 New Join Request</h1>
        
        <p>Someone has requested to join your space: <strong>${spaceName}</strong></p>
        
        <div class="card">
          <div class="detail">
            <span class="label">User:</span> ${displayName}
          </div>
          <div class="detail">
            <span class="label">Email:</span> ${userEmail}
          </div>
          <div class="detail">
            <span class="label">Space:</span> ${spaceName}
          </div>
        </div>
        
        ${joinInstructions ? `
        <div class="instructions">
          <strong>Join Instructions:</strong>
          <p style="margin: 8px 0 0 0; font-size: 14px;">${joinInstructions.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
        
        <p>You can approve or reject this request by going to your space settings:</p>
        
        <div style="text-align: center;">
          <a href="${settingsUrl}" class="button">Manage Space Members</a>
        </div>
        
        <p><small><strong>Note:</strong> The user will be notified once you approve or reject their request.</small></p>
        
        <div class="footer">
          <p>This is an automated notification from Chatstorm.</p>
          <p>© ${new Date().getFullYear()} Chatstorm. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Space member joined notification template for space owners/admins
 */
export function getSpaceMemberJoinedNotificationTemplate({
  spaceName,
  spaceSlug,
  userEmail,
  spaceSettingsUrl,
  appUrl
}: {
  spaceName: string;
  spaceSlug: string;
  userEmail: string;
  spaceSettingsUrl?: string;
  appUrl: string;
}) {
  const settingsUrl = spaceSettingsUrl || `${appUrl}/spaces/${spaceSlug}/admin/members`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Member Joined: ${spaceName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          color: #333333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #000000;
          text-decoration: none;
        }
        h1 {
          color: #000000;
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 20px;
          font-size: 16px;
        }
        .card {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }
        .detail {
          margin-bottom: 12px;
        }
        .label {
          font-weight: 600;
          display: inline-block;
          min-width: 100px;
        }
        .button {
          display: inline-block;
          background-color: #000000;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 14px;
          color: #666666;
          border-top: 1px solid #eeeeee;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="${appUrl}" class="logo">Chatstorm</a>
        </div>
        
        <h1>🎉 New Member Joined</h1>
        
        <p>A new member has joined your space: <strong>${spaceName}</strong></p>
        
        <div class="card">
          <div class="detail">
            <span class="label">Email:</span> ${userEmail}
          </div>
          <div class="detail">
            <span class="label">Space:</span> ${spaceName}
          </div>
          <div class="detail">
            <span class="label">Joined:</span> ${new Date().toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}
          </div>
        </div>
        
        <p>You can view all members and manage permissions in your space settings:</p>
        
        <div style="text-align: center;">
          <a href="${settingsUrl}" class="button">View Space Members</a>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Chatstorm.</p>
          <p>© ${new Date().getFullYear()} Chatstorm. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Space member approved notification template for the user
 */
export function getSpaceMemberApprovedNotificationTemplate({
  spaceName,
  spaceSlug,
  spaceUrl,
  joinInstructions,
  appUrl
}: {
  spaceName: string;
  spaceSlug: string;
  spaceUrl?: string;
  joinInstructions?: string;
  appUrl: string;
}) {
  const spaceLink = spaceUrl || `${appUrl}/spaces/${spaceSlug}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${spaceName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          color: #333333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #000000;
          text-decoration: none;
        }
        h1 {
          color: #000000;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 20px;
          font-size: 16px;
        }
        .card {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }
        .instructions {
          background-color: #f0f9ff;
          border-left: 4px solid #3b82f6;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .button {
          display: inline-block;
          background-color: #000000;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 14px;
          color: #666666;
          border-top: 1px solid #eeeeee;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="${appUrl}" class="logo">Chatstorm</a>
        </div>
        
        <h1>🎉 Welcome to ${spaceName}!</h1>
        
        <div class="card">
          <p><strong>Great news!</strong> Your request to join <strong>${spaceName}</strong> has been approved.</p>
          <p>You now have full access to the space and all its features. You can start collaborating with other members right away.</p>
        </div>
        
        ${joinInstructions ? `
        <div class="instructions">
          <strong>Space Guidelines:</strong>
          <p style="margin: 8px 0 0 0; font-size: 14px;">${joinInstructions.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
        
        <p>Click the button below to access your space:</p>
        
        <div style="text-align: center;">
          <a href="${spaceLink}" class="button">Access Space</a>
        </div>
        
        <p>If you have any questions or need help getting started, feel free to reach out to the space administrators.</p>
        
        <div class="footer">
          <p>This is an automated notification from Chatstorm.</p>
          <p>© ${new Date().getFullYear()} Chatstorm. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Space member rejected notification template for the user
 */
export function getSpaceMemberRejectedNotificationTemplate({
  spaceName,
  rejectionReason,
  contactEmail,
  appUrl
}: {
  spaceName: string;
  rejectionReason?: string;
  contactEmail?: string;
  appUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Space Access Request Update</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          color: #333333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #000000;
          text-decoration: none;
        }
        h1 {
          color: #000000;
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 20px;
          font-size: 16px;
        }
        .card {
          background-color: #fef3f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }
        .reason {
          background-color: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 16px;
          margin: 20px 0;
          font-style: italic;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 14px;
          color: #666666;
          border-top: 1px solid #eeeeee;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="${appUrl}" class="logo">Chatstorm</a>
        </div>
        
        <h1>Space Access Request Update</h1>
        
        <div class="card">
          <p>We've reviewed your request to join <strong>${spaceName}</strong>.</p>
          <p>Unfortunately, we're unable to approve your request at this time.</p>
        </div>
        
        ${rejectionReason ? `
        <div class="reason">
          <strong>Reason:</strong> ${rejectionReason}
        </div>
        ` : ''}
        
        <p>If you believe this was an error or would like to discuss this decision, please ${contactEmail ? `contact us at ${contactEmail}` : 'reach out to the space administrators'}.</p>
        
        <p>Thank you for your interest in joining our space.</p>
        
        <div class="footer">
          <p>This is an automated notification from Chatstorm.</p>
          <p>© ${new Date().getFullYear()} Chatstorm. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
} 