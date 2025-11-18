import { createBrowserClient } from '@supabase/ssr'
import { createClient } from "@supabase/supabase-js"

// Load .env.local on server only
if (typeof window === 'undefined') {
  const { config } = require('dotenv');
  const path = require('path');
  config({ path: path.resolve(process.cwd(), '.env.local') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

// ----------------------------
// Refresh Debugger Variables
// ----------------------------
let lastRefreshApiCall = 0;
let isInitialLogin = false;
let loginTimestamp = 0;

const MIN_REFRESH_API_INTERVAL = 300000; // 5 minutes
const LOGIN_GRACE_PERIOD = 120000;       // 2 minutes

// Mark login from auth-context
export function markUserLoggedIn() {
  isInitialLogin = true;
  loginTimestamp = Date.now();
  lastRefreshApiCall = 0;

  setTimeout(() => {
    isInitialLogin = false;
  }, LOGIN_GRACE_PERIOD);
}

// ----------------------------
// Fetch Interceptor (Debug Only)
// ----------------------------
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    let url = '';

    if (typeof args[0] === 'string') url = args[0];
    else if (args[0] instanceof URL) url = args[0].toString();
    else if (args[0] instanceof Request) url = args[0].url;

    if (url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')) {
      const now = Date.now();
      const timeSinceLastCall = now - lastRefreshApiCall;
      const timeSinceLogin = now - loginTimestamp;

      if (isInitialLogin || timeSinceLogin < LOGIN_GRACE_PERIOD) {
        console.log("🔄 Refresh token API call (after login)");
      } else if (timeSinceLastCall < MIN_REFRESH_API_INTERVAL) {
        console.warn("⚠️ Frequent refresh token API call detected");
      } else {
        console.log("🔄 Refresh token API call");
      }

      lastRefreshApiCall = now;
    }

    return originalFetch.apply(this, args);
  };
}

// ----------------------------
// Browser Supabase Client
// ----------------------------
export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);

// Note: Auto-refresh is handled via fetch interceptor above and auth-context throttling
// We cannot access private properties (_autoRefreshToken, etc.) as they don't exist on the public API

// ----------------------------
// Server Admin Client
// ----------------------------
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// ----------------------------
// Manual Refresh Function
// ----------------------------
export async function refreshIfNeeded() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session || !session.expires_at) return;

  const expiresAt = session.expires_at * 1000;
  const now = Date.now();

  if (expiresAt - now < 10_000) {
    console.log("🔄 Manually refreshing token...");
    await supabase.auth.refreshSession();
  }
}
