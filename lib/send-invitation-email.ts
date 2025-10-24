import { supabaseAdmin } from './supabaseClient';
import { getStaffInvitationEmailHTML, getStaffInvitationEmailText } from './email-templates';
import { Resend } from 'resend';

export async function sendStaffInvitationEmail(params: {
  email: string;
  staffName: string;
  organizationName: string;
  password: string;
  invitationToken: string;
  orgId: string;
  userId: string;
  expiresAt: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    // const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://samvera-live-ni3k.vercel.app';
    const callbackUrl = `${siteUrl}/auth/callback-staff?token=${params.invitationToken}&org_id=${params.orgId}&user_id=${params.userId}`;

    // Generate the HTML and text versions
    const htmlContent = getStaffInvitationEmailHTML({
      staffName: params.staffName,
      organizationName: params.organizationName,
      email: params.email,
      password: params.password,
      magicLink: callbackUrl,
      expiresAt: params.expiresAt
    });

    const textContent = getStaffInvitationEmailText({
      staffName: params.staffName,
      organizationName: params.organizationName,
      email: params.email,
      password: params.password,
      magicLink: callbackUrl,
      expiresAt: params.expiresAt
    });

    console.log('📧 Sending custom invitation email with password...');
    console.log('   To:', params.email);
    console.log('   Password:', params.password);
    console.log('   Callback:', callbackUrl);

    // Try to send via Resend if API key is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        
        console.log('📧 Sending via Resend with custom template...');
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: [params.email],
          subject: 'Welcome to Samvera - Your Staff Invitation',
          html: htmlContent,
          text: textContent,
        });

        if (error) {
          console.error('❌ Resend error:', error);
          throw error;
        }

        console.log('✅ Custom email sent via Resend:', data);
        console.log('📧 Email includes password:', params.password);
        return { success: true };
        
      } catch (resendError: any) {
        console.error('❌ Failed to send via Resend:', resendError);
        console.log('⚠️ Falling back to Supabase magic link...');
        // Fall through to Supabase method
      }
    } else {
      console.log('⚠️ RESEND_API_KEY not configured, using Supabase magic link');
      console.log('💡 To send custom emails with password:');
      console.log('   1. Get API key from https://resend.com');
      console.log('   2. Add to .env.local: RESEND_API_KEY=re_xxx');
      console.log('   3. Add to .env.local: EMAIL_FROM=noreply@yourdomain.com');
    }

    // Fallback: Send magic link with Supabase (default template, no password in email)
    const { error: magicLinkError } = await supabaseAdmin.auth.signInWithOtp({
      email: params.email,
      options: {
        emailRedirectTo: callbackUrl,
        data: {
          invitation_token: params.invitationToken,
          org_id: params.orgId,
          user_id: params.userId,
          role: 'teacher',
          password: params.password,
          organization_name: params.organizationName,
          staff_name: params.staffName
        }
      }
    });

    if (magicLinkError) {
      console.error('❌ Failed to send magic link:', magicLinkError);
      throw magicLinkError;
    }

    console.log('✅ Supabase magic link sent (default template)');
    console.log('⚠️ Password NOT included in Supabase email');
    console.log('💡 Configure Resend to send password in email');
    
    // Log what the email WOULD look like with Resend
    console.log('\n📧 ========== CUSTOM EMAIL PREVIEW ==========');
    console.log('Subject: Welcome to Samvera - Your Staff Invitation');
    console.log('\nThis email would include:');
    console.log('- Staff Name:', params.staffName);
    console.log('- Organization:', params.organizationName);
    console.log('- Email:', params.email);
    console.log('- Password:', params.password, '✅');
    console.log('- Magic Link Button');
    console.log('- Beautiful HTML template');
    console.log('📧 ============================================\n');

    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending invitation email:', error);
    return { success: false, error: error.message };
  }
}

