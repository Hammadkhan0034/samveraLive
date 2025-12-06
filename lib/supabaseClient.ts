import { createBrowserClient } from '@supabase/ssr'
import { createClient } from "@supabase/supabase-js"

// Load .env.local on server only
if (typeof window === 'undefined') {
  const { config } = require('dotenv');
  const path = require('path');
  config({ path: path.resolve(process.cwd(), '.env') });
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

// ----------------------------
// Global Refresh Lock/Queue
// ----------------------------
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (value: Response) => void;
  reject: (error: any) => void;
  args: Parameters<typeof fetch>;
}> = [];
let lastRefreshAttempt = 0;
const MIN_REFRESH_ATTEMPT_INTERVAL = 10000; // 10 seconds minimum between refresh attempts
const RATE_LIMIT_WAIT_INTERVAL = 30000; // 30 seconds wait after rate limit error

// Mark login from auth-context
export function markUserLoggedIn() {
  isInitialLogin = true;
  loginTimestamp = Date.now();
  lastRefreshApiCall = 0;
  lastRefreshAttempt = 0;

  setTimeout(() => {
    isInitialLogin = false;
  }, LOGIN_GRACE_PERIOD);
}

// Store original fetch before we override it
let originalFetch: typeof fetch | null = null;

// Process refresh queue
async function processRefreshQueue() {
  if (isRefreshing || refreshQueue.length === 0 || !originalFetch) {
    return;
  }

  const now = Date.now();
  const timeSinceLastAttempt = now - lastRefreshAttempt;

  // Check if we have a recent rate limit error
  const rateLimitErrorTime = typeof window !== 'undefined' 
    ? sessionStorage.getItem('supabase_rate_limit_error') 
    : null;
  const hasRecentRateLimit = rateLimitErrorTime && (now - parseInt(rateLimitErrorTime, 10)) < 60000; // Within last minute
  
  // Use longer wait interval if we recently hit a rate limit
  const waitInterval = hasRecentRateLimit ? RATE_LIMIT_WAIT_INTERVAL : MIN_REFRESH_ATTEMPT_INTERVAL;

  // If we tried to refresh too recently, wait a bit
  if (timeSinceLastAttempt < waitInterval && !isInitialLogin) {
    // Wait and retry
    setTimeout(() => processRefreshQueue(), waitInterval - timeSinceLastAttempt);
    return;
  }

  isRefreshing = true;
  lastRefreshAttempt = now;

  // Process all queued requests with the same fetch call
  const batch = [...refreshQueue];
  refreshQueue = [];

  try {
    const response = await originalFetch!(...batch[0].args);
    
    // Handle rate limit errors - if we get a 429, we should wait longer before next attempt
    if (!response.ok) {
      const clonedResponse = response.clone();
      try {
        const errorData = await clonedResponse.json();
        if (response.status === 429 || errorData?.error === 'rate_limit_exceeded' || errorData?.message?.includes('rate limit') || errorData?.message?.includes('Too Many Requests')) {
          // Wait longer before allowing next refresh after rate limit (30 seconds)
          lastRefreshAttempt = Date.now();
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('supabase_rate_limit_error', Date.now().toString());
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    // Resolve all queued requests with the same response (cloned)
    for (let i = 0; i < batch.length; i++) {
      if (i === 0) {
        batch[i].resolve(response);
      } else {
        // Clone response for other requests
        batch[i].resolve(response.clone());
      }
    }
  } catch (error) {
    // Reject all queued requests
    batch.forEach(({ reject }) => reject(error));
  } finally {
    isRefreshing = false;
    lastRefreshApiCall = now;
    
    // Process any new requests that came in while we were refreshing
    // But wait a bit longer if we just hit a rate limit
    const waitTime = refreshQueue.length > 0 ? 100 : 0;
    if (waitTime > 0) {
      setTimeout(() => processRefreshQueue(), waitTime);
    }
  }
}

// ----------------------------
// Fetch Interceptor
// ----------------------------
if (typeof window !== 'undefined') {
  originalFetch = window.fetch;

  window.fetch = async function (...args) {
    let url = '';

    if (typeof args[0] === 'string') url = args[0];
    else if (args[0] instanceof URL) url = args[0].toString();
    else if (args[0] instanceof Request) url = args[0].url;

    // Check if this is a refresh token request
    const isRefreshRequest = url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token');

    if (isRefreshRequest) {
      const now = Date.now();
      const timeSinceLastCall = now - lastRefreshApiCall;

      // Check if we have a recent rate limit error
      const rateLimitErrorTime = typeof window !== 'undefined' 
        ? sessionStorage.getItem('supabase_rate_limit_error') 
        : null;
      const hasRecentRateLimit = rateLimitErrorTime && (now - parseInt(rateLimitErrorTime, 10)) < 60000; // Within last minute
      
      // Check if we have a recent network error
      const networkErrorTime = typeof window !== 'undefined' 
        ? sessionStorage.getItem('supabase_network_error') 
        : null;
      const hasRecentNetworkError = networkErrorTime && (now - parseInt(networkErrorTime, 10)) < 30000; // Within last 30 seconds
      
      // Use longer wait interval if we recently hit a rate limit or network error
      const waitInterval = hasRecentRateLimit ? RATE_LIMIT_WAIT_INTERVAL : 
                          hasRecentNetworkError ? 10000 : // 10 seconds for network errors
                          MIN_REFRESH_ATTEMPT_INTERVAL;

      // If we're already refreshing or just refreshed recently, queue this request
      if (isRefreshing || (timeSinceLastCall < waitInterval && !isInitialLogin)) {
        return new Promise<Response>((resolve, reject) => {
          refreshQueue.push({ resolve, reject, args });
          processRefreshQueue();
        });
      }

      // Mark that we're about to refresh
      isRefreshing = true;
      lastRefreshAttempt = now;
    }

    try {
      const response = await originalFetch!(...args);
      
      // Handle refresh token errors gracefully
      if (isRefreshRequest) {
        isRefreshing = false;
        lastRefreshApiCall = Date.now();

        if (!response.ok) {
          const clonedResponse = response.clone();
          try {
            const errorData = await clonedResponse.json();
            
            // Handle rate limit errors (429) - log but let it pass through
            // The auth-context will handle keeping the session
            if (response.status === 429 || errorData?.error === 'rate_limit_exceeded' || errorData?.message?.includes('rate limit') || errorData?.message?.includes('Too Many Requests')) {
              console.warn('⚠️ Rate limit reached on token refresh - session may still be valid');
              // Store a flag to indicate rate limit error
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('supabase_rate_limit_error', Date.now().toString());
              }
              // Wait longer before allowing next refresh after rate limit
              lastRefreshAttempt = Date.now();
            }
            
            if (errorData?.error === 'refresh_token_already_used' || errorData?.code === 'refresh_token_already_used') {
              // This is a non-critical error - Supabase will handle it on next request
              return response;
            }
          } catch (e) {
            // If we can't parse the error, just return the original response
            return response;
          }
        } else {
          // Clear rate limit and network error flags on successful refresh
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('supabase_rate_limit_error');
            sessionStorage.removeItem('supabase_network_error');
          }
        }

        // Process any queued refresh requests
        if (refreshQueue.length > 0) {
          setTimeout(() => processRefreshQueue(), 100);
        }
      }
      
      return response;
    } catch (error: any) {
      // Handle network errors gracefully
      const isNetworkError = error?.name === 'AuthRetryableFetchError' || 
                            error?.message?.includes('fetch failed') ||
                            error?.status === 0 ||
                            error?.code === 'ECONNREFUSED' ||
                            error?.code === 'ETIMEDOUT';
      
      if (isNetworkError && isRefreshRequest) {
        isRefreshing = false;
        // For network errors during refresh, don't throw - let the session remain valid
        // The user might still be authenticated, just network is temporarily down
        console.warn('⚠️ Network error during token refresh - session may still be valid. Error:', error.message || error);
        
        // Store network error timestamp to prevent rapid retries
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('supabase_network_error', Date.now().toString());
        }
        
        // Process any queued refresh requests even on error
        if (refreshQueue.length > 0) {
          setTimeout(() => processRefreshQueue(), 5000); // Wait 5 seconds before retrying
        }
        
        // Return a mock response to prevent Supabase from clearing the session
        // This allows the app to continue working with cached session data
        return new Response(JSON.stringify({ error: 'Network error' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (isRefreshRequest) {
        isRefreshing = false;
        // Process any queued refresh requests even on error
        if (refreshQueue.length > 0) {
          setTimeout(() => processRefreshQueue(), 100);
        }
      }
      
      // For non-network errors or non-refresh requests, re-throw
      throw error;
    }
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
    await supabase.auth.refreshSession();
  }
}
