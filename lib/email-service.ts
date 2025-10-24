/**
 * Email Service for Staff Invitations
 * Supports both Resend and Nodemailer
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface InvitationEmailData {
  recipientEmail: string;
  recipientName: string;
  inviterName: string;
  invitationLink: string;
  expiresAt: string;
  organizationName?: string;
}

/**
 * Generate HTML email template for staff invitation
 */
function generateInvitationEmailHTML(data: InvitationEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Staff Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
    .message { font-size: 16px; color: #555; line-height: 1.6; margin-bottom: 30px; }
    .button-container { text-align: center; margin: 40px 0; }
    .button { display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .button:hover { background: #5568d3; }
    .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 30px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 14px; }
    .details-label { color: #666; font-weight: 500; }
    .details-value { color: #333; font-weight: 600; }
    .footer { padding: 30px; text-align: center; color: #999; font-size: 13px; border-top: 1px solid #eee; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; font-size: 14px; color: #856404; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Staff Invitation</h1>
    </div>
    
    <div class="content">
      <div class="greeting">
        Hello ${data.recipientName || 'there'},
      </div>
      
      <div class="message">
        <strong>${data.inviterName}</strong> has invited you to join ${data.organizationName || 'their organization'} as a <strong>teacher/staff member</strong> on Samvera.
      </div>
      
      <div class="details">
        <div class="details-row">
          <span class="details-label">Invited by:</span>
          <span class="details-value">${data.inviterName}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Role:</span>
          <span class="details-value">Teacher/Staff</span>
        </div>
        <div class="details-row">
          <span class="details-label">Expires:</span>
          <span class="details-value">${new Date(data.expiresAt).toLocaleDateString()}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="${data.invitationLink}" class="button">Accept Invitation</a>
      </div>
      
      <div class="warning">
        ⏰ This invitation will expire on <strong>${new Date(data.expiresAt).toLocaleDateString()}</strong>. Please accept it before then.
      </div>
      
      <div class="message" style="font-size: 14px; color: #666;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${data.invitationLink}" style="color: #667eea; word-break: break-all;">${data.invitationLink}</a>
      </div>
    </div>
    
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
      <p>© ${new Date().getFullYear()} Samvera. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text version of invitation email
 */
function generateInvitationEmailText(data: InvitationEmailData): string {
  return `
Staff Invitation - Samvera

Hello ${data.recipientName || 'there'},

${data.inviterName} has invited you to join ${data.organizationName || 'their organization'} as a teacher/staff member on Samvera.

Invitation Details:
- Invited by: ${data.inviterName}
- Role: Teacher/Staff
- Expires: ${new Date(data.expiresAt).toLocaleDateString()}

To accept this invitation, please visit:
${data.invitationLink}

This invitation will expire on ${new Date(data.expiresAt).toLocaleDateString()}.

---
This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} Samvera. All rights reserved.
  `;
}

/**
 * Send email using Resend
 */
async function sendEmailWithResend(options: EmailOptions): Promise<boolean> {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not configured');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Samvera <onboarding@resend.dev>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Resend API error:', error);
      return false;
    }

    const data = await response.json();
    console.log('✅ Email sent via Resend:', data.id);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email via Resend:', error);
    return false;
  }
}

/**
 * Send email using Nodemailer (SMTP)
 */
async function sendEmailWithNodemailer(options: EmailOptions): Promise<boolean> {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log('✅ Email sent via SMTP:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email via SMTP:', error);
    return false;
  }
}

/**
 * Main function to send staff invitation email
 */
export async function sendStaffInvitationEmail(data: InvitationEmailData): Promise<boolean> {
  const html = generateInvitationEmailHTML(data);
  const text = generateInvitationEmailText(data);

  const emailOptions: EmailOptions = {
    to: data.recipientEmail,
    subject: `You're invited to join ${data.organizationName || 'Samvera'} as a Staff Member`,
    html,
    text,
  };

  console.log('\n📧 Sending staff invitation email to:', data.recipientEmail);
  console.log('📋 Invitation link:', data.invitationLink);

  // Try Resend first, fallback to Nodemailer
  const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';

  if (EMAIL_PROVIDER === 'resend') {
    const success = await sendEmailWithResend(emailOptions);
    if (success) return true;
  }

  if (EMAIL_PROVIDER === 'smtp' || EMAIL_PROVIDER === 'nodemailer') {
    const success = await sendEmailWithNodemailer(emailOptions);
    if (success) return true;
  }

  // Fallback: Just log to console (for development)
  console.log('\n📧 ===== INVITATION EMAIL (Console Mode) =====');
  console.log('To:', data.recipientEmail);
  console.log('Subject:', emailOptions.subject);
  console.log('Invitation Link:', data.invitationLink);
  console.log('Expires:', data.expiresAt);
  console.log('\nℹ️  Email not sent. Configure EMAIL_PROVIDER in .env.local:');
  console.log('   - EMAIL_PROVIDER=resend (requires RESEND_API_KEY)');
  console.log('   - EMAIL_PROVIDER=smtp (requires SMTP_* variables)');
  console.log('============================================\n');

  return true; // Return true for console mode (development)
}

