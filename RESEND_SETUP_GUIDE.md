# 📧 **Resend Email Setup Guide**

## **Problem:**
Currently, Supabase sends magic link emails using its default template, which **does NOT include the password**. 

Staff receives:
- ❌ Magic link only
- ❌ No password visible
- ❌ Basic Supabase template

## **Solution:**
Use **Resend** to send beautiful custom emails that include:
- ✅ Magic link button
- ✅ Password (ahmad123456)
- ✅ Beautiful HTML template
- ✅ Organization name
- ✅ Staff name
- ✅ Instructions

---

## **Step-by-Step Setup:**

### **Step 1: Create Resend Account**

1. Go to https://resend.com
2. Click "Sign Up" (Free tier: 100 emails/day, 3,000 emails/month)
3. Verify your email
4. Login to dashboard

### **Step 2: Get API Key**

1. In Resend Dashboard, click "API Keys" in left sidebar
2. Click "Create API Key"
3. Name: `Samvera Invitations`
4. Permissions: **Full Access** (or at least "Send emails")
5. Click "Create"
6. Copy the API key (starts with `re_`)
   ```
   re_123abc456def789ghi012jkl345mno678
   ```
7. ⚠️ **IMPORTANT**: Save it now! You won't see it again.

### **Step 3: Add to .env.local**

Open your `.env.local` file and add:

```bash
# Resend Configuration
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```

**Example:**
```bash
RESEND_API_KEY=re_123abc456def789ghi012jkl345mno678
EMAIL_FROM=Samvera <noreply@samvera.com>
```

**Notes:**
- Replace `re_your_actual_api_key_here` with your real API key
- For testing, you can use: `onboarding@resend.dev` as EMAIL_FROM
- For production, use your own domain (requires domain verification)

### **Step 4: Verify Domain (Optional, for Production)**

**For Testing (Skip this):**
- Use `onboarding@resend.dev` - works immediately
- Limit: 1 email per 24 hours to same address

**For Production:**
1. In Resend Dashboard → "Domains"
2. Click "Add Domain"
3. Enter your domain: `samvera.com`
4. Add DNS records to your domain registrar:
   ```
   Type: TXT
   Name: @
   Value: [provided by Resend]
   ```
5. Wait for verification (usually 5-15 minutes)
6. Update EMAIL_FROM:
   ```bash
   EMAIL_FROM=Samvera <noreply@samvera.com>
   ```

### **Step 5: Restart Dev Server**

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### **Step 6: Test It!**

1. Login as Principal
2. Go to "Invite Staff"
3. Enter:
   - Name: Test User
   - Email: your-email@gmail.com
4. Click "Invite"
5. Check console logs:
   ```
   📧 Sending via Resend with custom template...
   ✅ Custom email sent via Resend
   📧 Email includes password: ahmad123456
   ```
6. Check your email inbox!

---

## **What You'll See in Email:**

```
┌─────────────────────────────────────────┐
│  🎓 Welcome to Samvera                  │
│  Your staff invitation is ready         │
└─────────────────────────────────────────┘

Hello Test User! 👋

You've been invited to join ABC School as a 
teacher/staff member on the Samvera Platform.

┌─────────────────────────────────────────┐
│  🔐 Your Login Credentials              │
│                                         │
│  Email:    your-email@gmail.com         │
│  Password: ahmad123456                  │
└─────────────────────────────────────────┘

📋 How to Get Started:
1. Click the button below to confirm your email
2. Sign in using the credentials above
3. Start using the Samvera platform

  ┌────────────────────────────────┐
  │  ✉️ Confirm Email & Get Started │
  └────────────────────────────────┘

⚠️ IMPORTANT: Change your password after login

⏰ Expires: October 24, 2025
```

---

## **Current Flow:**

### **Without Resend (Default):**
```
Principal invites staff
↓
Supabase sends magic link email ❌
  - Simple template
  - No password
  - Basic styling
↓
Staff sees only: "Click to confirm"
```

### **With Resend (Configured):**
```
Principal invites staff
↓
Resend sends custom email ✅
  - Beautiful HTML template
  - Password included: ahmad123456
  - Magic link button
  - Organization name
  - Staff name
  - Instructions
↓
Staff sees full credentials!
```

---

## **Console Output Comparison:**

### **Before (Without Resend):**
```bash
⚠️ RESEND_API_KEY not configured, using Supabase magic link
💡 To send custom emails with password:
   1. Get API key from https://resend.com
   2. Add to .env.local: RESEND_API_KEY=re_xxx
   3. Add to .env.local: EMAIL_FROM=noreply@yourdomain.com

✅ Supabase magic link sent (default template)
⚠️ Password NOT included in Supabase email
💡 Configure Resend to send password in email
```

### **After (With Resend):**
```bash
📧 Sending via Resend with custom template...
✅ Custom email sent via Resend: { id: 'abc123...' }
📧 Email includes password: ahmad123456
```

---

## **Troubleshooting:**

### **Issue 1: "RESEND_API_KEY not configured"**
**Solution:**
1. Check `.env.local` file exists
2. Check spelling: `RESEND_API_KEY` (not `RESEND_KEY`)
3. Restart dev server after adding

### **Issue 2: "Error sending via Resend"**
**Solution:**
1. Check API key is correct (starts with `re_`)
2. Check Resend dashboard for errors
3. Verify EMAIL_FROM format: `Name <email@domain.com>`
4. For testing, use: `onboarding@resend.dev`

### **Issue 3: Email not received**
**Solution:**
1. Check spam/junk folder
2. Wait 1-2 minutes
3. Check Resend dashboard → "Logs" for delivery status
4. Try different email address
5. For `onboarding@resend.dev`: Max 1 email per 24h per address

### **Issue 4: "Domain not verified"**
**Solution:**
1. Use `onboarding@resend.dev` for testing
2. Or verify your domain in Resend dashboard
3. Add DNS records provided by Resend
4. Wait 5-15 minutes for propagation

---

## **Free Tier Limits:**

Resend Free Tier:
- ✅ 100 emails per day
- ✅ 3,000 emails per month
- ✅ All features included
- ✅ No credit card required

Perfect for:
- Testing
- Small schools (up to 100 staff invites/day)
- MVP/Demo

For production with more volume:
- Pro Plan: $20/month (50,000 emails)
- Scale as needed

---

## **Quick Start (TL;DR):**

```bash
# 1. Get API key from https://resend.com

# 2. Add to .env.local:
RESEND_API_KEY=re_your_actual_key
EMAIL_FROM=onboarding@resend.dev

# 3. Restart server:
npm run dev

# 4. Test invitation:
# Login → Invite Staff → Check email!

# ✅ Done! Email will include password!
```

---

## **Environment Variables Summary:**

```bash
# Required for Resend to work:
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=onboarding@resend.dev

# Optional (already configured):
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## **Support:**

- Resend Docs: https://resend.com/docs
- Resend Dashboard: https://resend.com/dashboard
- Resend Discord: https://discord.gg/resend

---

**That's it! Ab email mein password show hoga! 🚀**

