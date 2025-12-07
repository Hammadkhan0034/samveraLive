'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, markUserLoggedIn } from './supabaseClient';
import { type SamveraRole, type UserMetadata } from './auth';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSigningIn: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, userRole: SamveraRole, fullName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { roles?: SamveraRole[]; activeRole?: SamveraRole }) => Promise<{ error: AuthError | null }>;
  signInWithOtp: (email: string, preferredRole?: SamveraRole) => Promise<{ error: AuthError | null }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_REFRESH_INTERVAL = 300000; // 5 minutes minimum between refreshes
const RATE_LIMIT_WINDOW = 5000; // 5 seconds
const TOKEN_VALIDITY_THRESHOLD = 600000; // 10 minutes
const SESSION_VALIDITY_THRESHOLD = 60000; // 1 minute
const RETRY_DELAY = 2000; // 2 seconds
const SIGNIN_RESET_DELAY = 100; // 100ms
const FIRST_REFRESH_WINDOW = 60000; // 1 minute

const CACHE_KEYS_TO_REMOVE = [
  'menus_list',
  'menus_list_time',
  'classes_cache',
  'class_student_counts_cache',
  'teacher_menus_cache',
  'teacher_classes_cache',
  'parent_linked_students',
  'parent_linked_students_time',
  'menus_count_cache',
  'stories_count_cache',
  'announcements_count_cache',
  'messages_count_cache',
  'photos_count_cache',
  'classes_count_cache',
  'staff_count_cache',
  'guardians_count_cache',
  'guardians_cache',
  'students_count_cache',
  'students_cache',
  'calendar_events_cache',
  'menu_data_updated',
  'students_data_changed',
  'stories_data_updated',
  'classes_data_updated',
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an error is a network/retryable error
 */
function isNetworkError(error: any): boolean {
  return (
    error?.name === 'AuthRetryableFetchError' ||
    error?.message?.includes('fetch failed') ||
    error?.status === 0
  );
}

/**
 * Check if an error is a rate limit error
 */
function isRateLimitError(error: any): boolean {
  return (
    error?.status === 429 ||
    error?.message?.toLowerCase().includes('rate limit') ||
    error?.message?.includes('Too Many Requests') ||
    error?.code === 'rate_limit_exceeded'
  );
}

/**
 * Extract user role from session metadata
 */
function getUserRole(session: Session | null): SamveraRole | null {
  if (!session?.user) return null;
  const metadata = session.user.user_metadata as UserMetadata | undefined;
  return (metadata?.activeRole || metadata?.roles?.[0]) ?? null;
}

/**
 * Determine if redirect to role path is needed
 * Returns true if current path doesn't start with the role path
 */
function shouldRedirectToRolePath(currentPath: string, rolePath: string): boolean {
  return !currentPath.startsWith(rolePath);
}

/**
 * Get the dashboard path for a given role
 * TODO: Consider moving this to lib/auth.ts as a shared utility to avoid duplication
 * with lib/hooks/useAuth.ts
 */
function getRolePath(role: SamveraRole): string {
  const rolePaths: Record<string, string> = {
    teacher: '/dashboard/teacher',
    principal: '/dashboard/principal',
    guardian: '/dashboard/guardian',
    admin: '/dashboard/admin',
    parent: '/dashboard/guardian', // Handle legacy/alternate role name
  };
  return rolePaths[role];
}

/**
 * Update user metadata with pending role from localStorage
 */
async function updateUserMetadataWithPendingRole(session: Session): Promise<void> {
  const hasRoles = Array.isArray(session.user.user_metadata?.roles) && 
                   session.user.user_metadata?.roles.length > 0;
  
  if (!hasRoles && typeof window !== 'undefined') {
    const pendingRole = (localStorage.getItem('samvera_pending_role') || '') as SamveraRole | '';
    if (pendingRole) {
      const existingMetadata = session.user.user_metadata as Partial<UserMetadata> | undefined;
      const orgId = existingMetadata?.org_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';
      if (!orgId) {
        console.warn('org_id not found in metadata, skipping role update');
        return;
      }
      const userMetadata: UserMetadata = {
        roles: [pendingRole],
        activeRole: pendingRole,
        org_id: orgId,
      };
      await supabase.auth.updateUser({ data: userMetadata });
      localStorage.removeItem('samvera_pending_role');
    }
  }
}

/**
 * Clear application cache from localStorage
 */
function clearApplicationCache(): void {
  if (typeof window === 'undefined') return;

  // Clear predefined cache keys
  CACHE_KEYS_TO_REMOVE.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore errors
    }
  });

  // Clear any parent_menus_* keys (with orgId)
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('parent_menus_')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore errors
    }
  });

  console.log('✅ Application cache cleared from localStorage');
}

// ============================================================================
// AuthProvider Component
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const sessionInitialized = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const refreshBlocked = useRef<boolean>(false);

  /**
   * Update auth state (session and user) atomically
   */
  const updateAuthState = React.useCallback((newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
  }, []);

  /**
   * Handle SIGNED_IN event
   */
  const handleSignedInEvent = React.useCallback(async (
    session: Session,
    lastRefreshTimeRef: React.MutableRefObject<number>,
    refreshBlockedRef: React.MutableRefObject<boolean>
  ) => {
    // Reset refresh tracking on new login
    lastRefreshTimeRef.current = Date.now();
    refreshBlockedRef.current = false;

    // Mark login in supabase client to allow immediate refresh
    markUserLoggedIn();

    updateAuthState(session);
    setLoading(false);

    // Handle sign in success logic
    try {
      await updateUserMetadataWithPendingRole(session);
    } catch (e) {
      // swallow; not critical for redirect
    }

    // Redirect to appropriate dashboard based on user role
    const userRole = getUserRole(session);
    if (userRole) {
      const path = getRolePath(userRole);
      if (path && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        // Only redirect if we're not already on the correct path or a sub-route
        if (shouldRedirectToRolePath(currentPath, path)) {
          // Use replace instead of href to avoid adding to history
          window.location.replace(path);
        }
      } else {
        console.warn(`⚠️ No path found for role: ${userRole}`);
      }
    } else {
      setIsSigningIn(false);
    }
  }, [updateAuthState]);

  /**
   * Handle TOKEN_REFRESHED event
   */
  const handleTokenRefreshedEvent = React.useCallback((
    session: Session | null,
    now: number,
    lastRefreshTimeRef: React.MutableRefObject<number>,
    refreshBlockedRef: React.MutableRefObject<boolean>
  ) => {
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

    // Always allow first refresh or refresh right after login
    if (lastRefreshTimeRef.current === 0 || timeSinceLastRefresh < FIRST_REFRESH_WINDOW) {
      // First refresh or within 1 minute (likely after login)
      lastRefreshTimeRef.current = now;
      refreshBlockedRef.current = false;

      setSession((prevSession) => {
        if (!prevSession || !session) return session;
        if (prevSession.access_token !== session.access_token) {
          return session;
        }
        return prevSession;
      });
      return;
    }

    // Block refresh if it happened too recently (within 5 minutes)
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      refreshBlockedRef.current = true;
      return; // Block this refresh
    }

    // Check if token actually needs refresh
    if (session?.expires_at) {
      const expiresAt = session.expires_at * 1000;
      const timeUntilExpiry = expiresAt - now;

      // If token is still valid for more than 10 minutes, block the refresh
      if (timeUntilExpiry > TOKEN_VALIDITY_THRESHOLD) {
        refreshBlockedRef.current = true;
        return; // Block this refresh
      }
    }

    // Allow refresh - update timestamp and session
    lastRefreshTimeRef.current = now;
    refreshBlockedRef.current = false;

    // Silently update session without triggering re-renders
    setSession((prevSession) => {
      if (!prevSession || !session) return session;
      // Only update if token actually changed
      if (prevSession.access_token !== session.access_token) {
        return session;
      }
      return prevSession; // No change, keep previous session
    });
  }, []);

  /**
   * Handle SIGNED_OUT event
   */
  const handleSignedOutEvent = React.useCallback(async (
    setSession: React.Dispatch<React.SetStateAction<Session | null>>,
    setUser: React.Dispatch<React.SetStateAction<User | null>>,
    setIsSigningIn: React.Dispatch<React.SetStateAction<boolean>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    console.log('🔄 SIGNED_OUT event received');

    // Check if this is an explicit signout (user clicked signout button)
    const explicitSignout = typeof window !== 'undefined'
      ? sessionStorage.getItem('explicit_signout')
      : null;

    // If this is an explicit signout, clear the flag and proceed with signout
    if (explicitSignout) {
      sessionStorage.removeItem('explicit_signout');
      sessionStorage.removeItem('supabase_rate_limit_error'); // Also clear rate limit flag
      setIsSigningIn(false);
      setSession(null);
      setUser(null);
      setLoading(false);
      // Only redirect if we're not already on signin page and not on parent dashboard
      if (typeof window !== 'undefined' && 
          window.location.pathname !== '/signin' && 
          !window.location.pathname.startsWith('/dashboard/guardian')) {
        window.location.replace('/signin');
      }
      return;
    }

    // Check if this might be due to a rate limit error (only if not explicit signout)
    const rateLimitErrorTime = typeof window !== 'undefined'
      ? sessionStorage.getItem('supabase_rate_limit_error')
      : null;

    // If we had a recent rate limit error (within last 5 seconds), check if session is still valid
    if (rateLimitErrorTime && typeof window !== 'undefined') {
      const errorTime = parseInt(rateLimitErrorTime, 10);
      const timeSinceError = Date.now() - errorTime;

      // If rate limit error was recent (within 5 seconds), try to keep the session
      if (timeSinceError < RATE_LIMIT_WINDOW) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession && currentSession.expires_at) {
            const expiresAt = currentSession.expires_at * 1000;
            const now = Date.now();
            // If session is still valid (has more than 1 minute left), keep it
            if (expiresAt - now > SESSION_VALIDITY_THRESHOLD) {
              console.warn('⚠️ SIGNED_OUT event after rate limit - session still valid, keeping it');
              // Keep the existing session instead of clearing it
              setSession(currentSession);
              setUser(currentSession.user);
              setLoading(false);
              setIsSigningIn(false);
              // Clear the rate limit flag
              sessionStorage.removeItem('supabase_rate_limit_error');
              return; // Don't redirect
            }
          }
        } catch (e) {
          console.debug('Could not check session after rate limit error:', e);
        }
      }
    }

    setIsSigningIn(false);
    // Clear session state
    setSession(null);
    setUser(null);
    setLoading(false);

    // Only redirect if we're not already on signin page and not on parent dashboard
    if (typeof window !== 'undefined' && 
        window.location.pathname !== '/signin' && 
        !window.location.pathname.startsWith('/dashboard/parent')) {
      window.location.replace('/signin');
    }
  }, []);

  /**
   * Handle auth state change errors
   */
  const handleAuthStateChangeError = React.useCallback((error: any) => {
    // Handle refresh token errors gracefully
    if (error?.code === 'refresh_token_already_used' || 
        error?.message?.includes('refresh_token_already_used')) {
      // This is a non-critical error - Supabase will handle it automatically
      // Just log it at debug level and continue
      console.debug('🔄 Refresh token already used (non-critical, Supabase will handle)');
      return;
    }

    // Handle rate limit errors - don't clear session
    if (isRateLimitError(error)) {
      console.warn('⚠️ Rate limit error in auth state change - keeping existing session');
      // Try to get the current session and keep it
      try {
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
          if (currentSession) {
            updateAuthState(currentSession);
            setLoading(false);
          }
        });
      } catch (e) {
        // If we can't get session, just log and continue
        console.debug('Could not retrieve session after rate limit error');
      }
      return;
    }

    // For other errors, log them but don't break the app
    console.error('❌ Auth state change error:', error);
  }, [updateAuthState]);

  // Initialize session on mount
  useEffect(() => {
    // Prevent multiple initial session calls
    if (sessionInitialized.current) return;
    sessionInitialized.current = true;

    // Get initial session with network error handling
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        // Handle network errors gracefully
        if (error) {
          if (isNetworkError(error)) {
            console.warn('⚠️ Network error during initial session load - will retry. Error:', error.message);
            // Don't set loading to false immediately - allow retry
            // Try to get session from localStorage as fallback
            if (typeof window !== 'undefined') {
              try {
                const cachedSession = sessionStorage.getItem('supabase.auth.token');
                if (cachedSession) {
                  // Session might still be valid, just network is down
                  setLoading(false);
                  return;
                }
              } catch (e) {
                // Ignore cache errors
              }
            }
            // Retry after a delay
            setTimeout(() => {
              supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
                updateAuthState(retrySession);
                setLoading(false);
                if (retrySession?.expires_at) {
                  lastRefreshTime.current = Date.now();
                }
              }).catch(() => {
                // If retry also fails, just set loading to false
                setLoading(false);
              });
            }, RETRY_DELAY);
            return;
          }
        }

        updateAuthState(session);
        setLoading(false);
        if (session?.expires_at) {
          lastRefreshTime.current = Date.now();
        }
      })
      .catch((error) => {
        // Handle any other errors
        if (isNetworkError(error)) {
          console.warn('⚠️ Network error during session initialization:', error.message);
        } else {
          console.error('❌ Error getting initial session:', error);
        }
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle errors gracefully - catch refresh token errors
      try {
        // Handle SIGNED_IN event first - always allow session update
        if (event === 'SIGNED_IN' && session) {
          await handleSignedInEvent(session, lastRefreshTime, refreshBlocked);
          return; // Don't process further
        } else if (event === 'TOKEN_REFRESHED') {
          handleTokenRefreshedEvent(session, Date.now(), lastRefreshTime, refreshBlocked);
          return; // Don't process further
        }

        // For all other events (SIGNED_OUT, etc.), update state normally
        if (event === 'SIGNED_OUT') {
          await handleSignedOutEvent(setSession, setUser, setIsSigningIn, setLoading);
        } else {
          // For other events, update state normally
          updateAuthState(session);
          setLoading(false);
        }
      } catch (error: any) {
        handleAuthStateChangeError(error);
      }
    });

    return () => subscription.unsubscribe();
  }, [handleSignedInEvent, handleTokenRefreshedEvent, handleSignedOutEvent, handleAuthStateChangeError, updateAuthState]);

  const signIn = async (email: string, password: string) => {
    // Prevent concurrent sign-in attempts
    if (isSigningIn) {
      return { error: { message: 'Sign in already in progress. Please wait...', status: 429 } as AuthError };
    }

    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsSigningIn(false);
        // Check for rate limit errors
        if (isRateLimitError(error)) {
          return {
            error: {
              ...error,
              message: 'Too many sign-in attempts. Please wait a few minutes before trying again.'
            } as AuthError
          };
        }
      } else {
        // Reset isSigningIn immediately after successful sign in
        // The redirect will happen in onAuthStateChange
        setTimeout(() => setIsSigningIn(false), SIGNIN_RESET_DELAY);
      }
      return { error };
    } catch (err) {
      setIsSigningIn(false);
      const authError = err as AuthError;
      // Check for rate limit errors in catch block
      if (isRateLimitError(authError)) {
        return {
          error: {
            ...authError,
            message: 'Too many sign-in attempts. Please wait a few minutes before trying again.'
          } as AuthError
        };
      }
      return { error: authError };
    }
  };

  const signUp = async (email: string, password: string, userRole: SamveraRole, fullName?: string) => {
    try {
      console.log('Attempting signup with:', { email, userRole });

      // Try different email formats if the first one fails
      const emailVariations = [
        email, // Original email
        email.replace('@', '+test@'), // Add +test to bypass some filters
        email.toLowerCase().replace(/[^a-z0-9@.]/g, ''), // Clean email
      ];

      let lastError: AuthError | null = null;

      for (const testEmail of emailVariations) {
        try {
          console.log('Trying email:', testEmail);
          const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';
          if (!orgId) {
            throw new Error('NEXT_PUBLIC_DEFAULT_ORG_ID is required but not configured');
          }
          const userMetadata: UserMetadata = {
            roles: [userRole],
            activeRole: userRole,
            org_id: orgId,
          };

          const { data, error } = await supabase.auth.signUp({
            email: testEmail,
            password,
            options: {
              data: userMetadata,
            },
          });

          if (error) {
            console.error('Signup error for', testEmail, ':', error);
            lastError = error;
            continue; // Try next email variation
          }

          console.log('Signup successful with:', testEmail, data);
          return { error: null };
        } catch (err) {
          console.error('Signup exception for', testEmail, ':', err);
          lastError = err as AuthError;
          continue;
        }
      }

      // If all variations failed, return the last error
      return { error: lastError };
    } catch (err) {
      console.error('Signup exception:', err);
      return { error: err as AuthError };
    }
  };

  const signOut = async () => {
    console.log('🔄 Auth context signOut called...');

    // Set flag to indicate explicit signout (prevents SIGNED_OUT handler from restoring session)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('explicit_signout', Date.now().toString());
    }

    // Clear local state first
    setSession(null);
    setUser(null);
    setLoading(false);

    // Try to sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ Supabase signOut error:', error);
      // Even if Supabase signOut fails, we still want to clear local state
    } else {
      console.log('✅ Supabase signOut successful');
    }

    // Clear any local auth cookies
    if (typeof document !== 'undefined') {
      document.cookie = `samvera_email=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `samvera_roles=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `samvera_active_role=; Path=/; Max-Age=0; SameSite=Lax`;
      console.log('✅ Local cookies cleared');
    }

    // Clear application cache
    clearApplicationCache();
  };

  const updateProfile = async (updates: { roles?: SamveraRole[]; activeRole?: SamveraRole }) => {
    const { error } = await supabase.auth.updateUser({
      data: updates,
    });
    return { error };
  };

  const signInWithOtp = async (email: string, preferredRole?: SamveraRole) => {
    try {
      // Store preferred role for first-login metadata update if needed
      if (preferredRole && typeof window !== 'undefined') {
        localStorage.setItem('samvera_pending_role', preferredRole);
      }

      // Send OTP - Supabase will send either magic link or 6-digit code
      // depending on your project's email settings in the dashboard
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      return { error };
    } catch (err) {
      return { error: err as AuthError };
    }
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (data?.user) {
        // Check if user has roles set, if not set from pending role
        const hasRoles = Array.isArray(data.user.user_metadata?.roles) && 
                         data.user.user_metadata?.roles.length > 0;
        if (!hasRoles && typeof window !== 'undefined') {
          const pendingRole = localStorage.getItem('samvera_pending_role') as SamveraRole | null;
          if (pendingRole) {
            const existingMetadata = data.user.user_metadata as Partial<UserMetadata> | undefined;
            const orgId = existingMetadata?.org_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';
            if (!orgId) {
              console.warn('org_id not found in metadata, skipping role update');
              return { error: null };
            }
            const userMetadata: UserMetadata = {
              roles: [pendingRole],
              activeRole: pendingRole,
              org_id: orgId,
            };
            await supabase.auth.updateUser({
              data: userMetadata,
            });
            localStorage.removeItem('samvera_pending_role');
          }
        }
      }

      return { error };
    } catch (err) {
      return { error: err as AuthError };
    }
  };

  const value = {
    user,
    session,
    loading,
    isSigningIn,
    signIn,
    signUp,
    signOut,
    updateProfile,
    signInWithOtp,
    verifyEmailOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// useAuth Hook
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
