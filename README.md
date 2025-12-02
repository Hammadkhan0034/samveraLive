## Samvera

Samvera is a role‑based school communication and administration dashboard built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase**, and **Firebase Cloud Messaging**.  
It supports multiple roles (`teacher`, `principal`, `guardian`, `admin`) with separate dashboards, announcements, attendance, menus, notifications, and push messaging.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components by default)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **Auth & Data**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Push Notifications**: Firebase Admin + Web FCM
- **Email**: Resend API or SMTP via Nodemailer
- **Validation**: Zod

---

## Getting Started

### Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **Package manager**: `npm` or `pnpm`
- A **Supabase** project
- (Optional but recommended) **Firebase** project for push notifications

### 1. Install dependencies

```bash
# using npm
npm install

# or using pnpm
pnpm install
```

### 2. Configure environment

Create a `.env.local` file in the project root and add the variables described in **Environment Variables** below.

### 3. Run the development server

```bash
npm run dev
# or
pnpm dev
```

The app runs on `http://localhost:3001` by default.

### 4. Build & production

```bash
# Production build
npm run build

# Start production server
npm run serve
```

---

## Scripts

- **`npm run dev`**: Start dev server on port `3001`
- **`npm run build`**: Production build
- **`npm run serve`**: Start production server on port `3001`
- **`npm run lint`**: Run Next.js/ESLint
- **`npm run create:admin`**: Create an initial admin user (`lib/createAdminUser.ts`)
- **`npm run create:user`**: Create a user via helper script (expects CLI arguments; see script source)
- **`npm run create:test:all`**: Seed test users (teachers, principals, guardians) for development
- **`npm run test:otp`**: Test Supabase OTP email sending
- **`npm run fix:principal-org`**: Fix principal org mapping in data
- **`npm run test:invitation`**: Test invitation acceptance flow
- **`npm run test:firebase`**: Test Firebase push notification setup

Some of these scripts rely on additional TypeScript files under `lib/` and/or `scripts/` and expect a correctly configured `.env.local`.

---

## Environment Variables

All variables go into `.env.local` (not committed to git).

### Supabase

Required for auth and data access:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: used for privileged server operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional defaults / fallbacks
NEXT_PUBLIC_DEFAULT_ORG_ID=your-default-org-id
NEXT_PUBLIC_SYSTEM_AUTHOR_ID=system-user-id-for-announcements
SYSTEM_AUTHOR_ID=system-user-id-for-fallback
```

### Firebase Push Notifications

To enable Firebase Cloud Messaging (FCM) push notifications, configure both **server-side** and **client-side** Firebase credentials.

#### Server-Side (Firebase Admin SDK – sending notifications)

```env
FIREBASE_ENABLED=true
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
```

#### Client-Side (Web app – receiving notifications)

```env
NEXT_PUBLIC_FIREBASE_ENABLED=true
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

**How to obtain these values:**

1. Go to `https://console.firebase.google.com` and select/create your project.
2. **Server-side (Admin SDK)**  
   - Project Settings → **Service accounts** → “Generate new private key”  
   - From the JSON file:
     - `project_id` → `FIREBASE_PROJECT_ID`
     - `private_key` → `FIREBASE_PRIVATE_KEY` (keep `\n` characters)
     - `client_email` → `FIREBASE_CLIENT_EMAIL`
3. **Client-side (Web App config)**  
   - Project Settings → **General** → Your apps → Web (`</>`)  
   - From the Firebase config object:
     - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`
   - For `NEXT_PUBLIC_FIREBASE_VAPID_KEY`:
     - Project Settings → **Cloud Messaging** → Web Push certificates → generate/copy key

**Notes**

- If `FIREBASE_ENABLED` is not `true` or required Firebase variables are missing, push notifications are disabled gracefully.
- Client-side push notifications require explicit browser notification permission.
- Device tokens are registered via hooks in `lib/hooks` when a user logs in and grants permission.

### Email (Invitations and notifications)

Samvera supports sending staff invitations via Resend or SMTP.

```env
# Choose email provider: 'resend', 'smtp', or 'console'
EMAIL_PROVIDER=resend

# Common
EMAIL_FROM="Samvera <no-reply@your-domain.com>"

# Resend
RESEND_API_KEY=your-resend-api-key

# SMTP (if using smtp/nodemailer)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

If `EMAIL_PROVIDER=console` or unset, emails are logged to the console only (development friendly).

---

## Database & Migrations

Database schema and RLS policies are in the `db/` directory:

- `db/schema.sql` – core tables
- `db/rls_policies.sql` – row-level security policies
- `db/migrations/*.sql` – additional migrations
- `db/storage/*.sql` – Supabase storage bucket setup

Apply these SQL files to your Supabase project (or compatible Postgres) in order:

1. `schema.sql`
2. `stories.sql` (if separate)
3. Migrations under `db/migrations/`
4. RLS and storage SQL files

Make sure RLS and policies line up with the expectations in `lib/services`, `lib/server-actions.ts`, and the API routes under `app/api/`.

---

## Roles & Dashboards

Samvera is role-based, aligned with `SamveraRole` from `lib/auth.ts`:

- **teacher** → `/dashboard/teacher`
- **principal** → `/dashboard/principal`
- **guardian** → `/dashboard/guardian`
- **admin** → `/dashboard/admin`

User metadata in Supabase is expected to include:

```ts
{
  roles: ('teacher' | 'principal' | 'guardian' | 'admin')[];
  activeRole: 'teacher' | 'principal' | 'guardian' | 'admin';
  org_id: string;
}
```

Server-side guards and server actions in `lib/supabaseServer.ts` and `lib/server-actions.ts` enforce these roles and organization/class scoping.

---

## Push Notifications Overview

- Server-side push sending is handled via **Firebase Admin** in `lib/firebase/admin.ts` and notification services in `lib/services/pushNotifications.ts` / `lib/services/notifications.ts`.
- Client-side registration of FCM tokens and message handling is done in `lib/firebase/client.ts` and hooks such as `useDeviceToken` and `useFirebasePushNotifications`.
- The service worker is exposed via `app/api/firebase-messaging-sw.js/route.ts` and mapped by `next.config.js`.

Ensure both Supabase and Firebase are configured before enabling push notifications in production.

---

## Deployment

You can deploy Samvera to any platform that supports Next.js 16 (e.g. Vercel, Render, Fly.io).  
For Vercel:

- Set all `.env.local` variables as project environment variables.
- Ensure the database (Supabase) and Firebase projects are reachable from the deployment region.
- Use `npm run build` as the build command, and `npm run serve` or the default Next.js start for the runtime.

Refer to the official Next.js deployment docs for more details: `https://nextjs.org/docs/deployment`.


