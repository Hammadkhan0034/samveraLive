// Email templates for staff invitations

export function getStaffInvitationEmailHTML(params: {
  staffName: string;
  organizationName: string;
  email: string;
  password: string;
  magicLink: string;
  expiresAt: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Staff Invitation - Samvera</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #0f172a;
    }
    .message {
      margin-bottom: 30px;
      line-height: 1.8;
      color: #475569;
    }
    .credentials-box {
      background: #f1f5f9;
      border-left: 4px solid #0f172a;
      padding: 20px;
      margin: 30px 0;
      border-radius: 8px;
    }
    .credentials-box h3 {
      margin: 0 0 15px;
      color: #0f172a;
      font-size: 16px;
      font-weight: 600;
    }
    .credential-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 12px;
      background: #ffffff;
      border-radius: 6px;
    }
    .credential-label {
      font-weight: 500;
      color: #64748b;
      font-size: 14px;
    }
    .credential-value {
      font-family: 'Courier New', monospace;
      background: #0f172a;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
      transition: all 0.3s ease;
    }
    .button:hover {
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.4);
      transform: translateY(-2px);
    }
    .steps {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 30px 0;
      border-radius: 8px;
    }
    .steps h3 {
      margin: 0 0 15px;
      color: #92400e;
      font-size: 16px;
      font-weight: 600;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
    }
    .steps li {
      margin-bottom: 8px;
      color: #78350f;
    }
    .footer {
      background: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 5px 0;
      color: #64748b;
      font-size: 14px;
    }
    .expiry {
      margin-top: 30px;
      padding: 15px;
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      font-size: 14px;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Welcome to Samvera</h1>
      <p>Your staff invitation is ready</p>
    </div>
    
    <div class="content">
      <div class="greeting">
        Hello ${params.staffName || 'there'}! 👋
      </div>
      
      <div class="message">
        <p>You've been invited to join <strong>${params.organizationName}</strong> as a <strong>teacher/staff member</strong> on the Samvera Education Platform.</p>
        <p>Your account has been created and is ready to use. Below are your login credentials:</p>
      </div>
      
      <div class="credentials-box">
        <h3>🔐 Your Login Credentials</h3>
        <div class="credential-item">
          <span class="credential-label">Email:</span>
          <span class="credential-value">${params.email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Password:</span>
          <span class="credential-value">${params.password}</span>
        </div>
      </div>
      
      <div class="steps">
        <h3>📋 How to Get Started</h3>
        <ol>
          <li><strong>Click the button below</strong> to confirm your email</li>
          <li><strong>Sign in</strong> using the credentials above</li>
          <li><strong>Start using</strong> the Samvera platform</li>
        </ol>
      </div>
      
      <div class="button-container">
        <a href="${params.magicLink}" class="button">
          ✉️ Confirm Email & Get Started
        </a>
      </div>
      
      <div class="message">
        <p><strong>Important:</strong> For security reasons, please change your password after your first login.</p>
        <p>If you have any questions or need assistance, please contact your administrator.</p>
      </div>
      
      <div class="expiry">
        ⏰ This invitation expires on <strong>${new Date(params.expiresAt).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</strong>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Samvera Education Platform</strong></p>
      <p>This is an automated message. Please do not reply to this email.</p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} Samvera. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getStaffInvitationEmailText(params: {
  staffName: string;
  organizationName: string;
  email: string;
  password: string;
  magicLink: string;
  expiresAt: string;
}): string {
  return `
Welcome to Samvera!

Hello ${params.staffName || 'there'}!

You've been invited to join ${params.organizationName} as a teacher/staff member on the Samvera Education Platform.

Your account has been created and is ready to use. Below are your login credentials:

LOGIN CREDENTIALS:
==================
Email:    ${params.email}
Password: ${params.password}


HOW TO GET STARTED:
===================
1. Click the link below to confirm your email
2. Sign in using the credentials above
3. Start using the Samvera platform

Confirmation Link: ${params.magicLink}


IMPORTANT: For security reasons, please change your password after your first login.

This invitation expires on ${new Date(params.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}

If you have any questions or need assistance, please contact your administrator.

---
Samvera Education Platform
© ${new Date().getFullYear()} Samvera. All rights reserved.
This is an automated message. Please do not reply to this email.
  `.trim();
}

