'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, markUserLoggedIn } from './supabaseClient';
import { type SamveraRole } from './auth';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const sessionInitialized = useRef(false);
  const lastRefreshTime = useRef<number>(0);
  const refreshBlocked = useRef<boolean>(false);
  const MIN_REFRESH_INTERVAL = 300000; // 5 minutes minimum between refreshes

  useEffect(() => {
    // Prevent multiple initial session calls
    if (sessionInitialized.current) return;
    sessionInitialized.current = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.expires_at) {
        lastRefreshTime.current = Date.now();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle SIGNED_IN event first - always allow session update
      if (event === 'SIGNED_IN' && session) {
        // Reset refresh tracking on new login
        lastRefreshTime.current = Date.now();
        refreshBlocked.current = false;
        
        // Mark login in supabase client to allow immediate refresh
        markUserLoggedIn();
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle sign in success logic
        try {
          const hasRoles = Array.isArray(session.user.user_metadata?.roles) && session.user.user_metadata?.roles.length > 0;
          if (!hasRoles && typeof window !== 'undefined') {
            const pendingRole = (localStorage.getItem('samvera_pending_role') || '') as SamveraRole | '';
            if (pendingRole) {
              await supabase.auth.updateUser({ data: { roles: [pendingRole], activeRole: pendingRole } });
              localStorage.removeItem('samvera_pending_role');
            }
          }
        } catch (e) {
          // swallow; not critical for redirect
        }

        // Redirect to appropriate dashboard based on user role
        const userRole = session.user.user_metadata?.activeRole || session.user.user_metadata?.roles?.[0];
        if (userRole) {
          const path = getRolePath(userRole);
          if (path && typeof window !== 'undefined') {
            // Only redirect if we're not already on the correct path
            if (window.location.pathname !== path) {
              // Use replace instead of href to avoid adding to history
              window.location.replace(path);
            }
          }
        } else {
          setIsSigningIn(false);
        }
        return; // Don't process further
      } else if (event === 'TOKEN_REFRESHED') {
        // Block TOKEN_REFRESHED events if they're happening too frequently
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime.current;

        // Always allow first refresh or refresh right after login
        if (lastRefreshTime.current === 0 || timeSinceLastRefresh < 60000) {
          // First refresh or within 1 minute (likely after login)
          lastRefreshTime.current = now;
          refreshBlocked.current = false;
          
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
          console.log('🚫 Blocking frequent token refresh (too soon after last refresh)');
          refreshBlocked.current = true;
          return; // Block this refresh
        }

        // Check if token actually needs refresh
        if (session?.expires_at) {
          const expiresAt = session.expires_at * 1000;
          const timeUntilExpiry = expiresAt - now;
          
          // If token is still valid for more than 10 minutes, block the refresh
          if (timeUntilExpiry > 600000) { // 10 minutes
            console.log('🚫 Blocking unnecessary token refresh (token still valid)');
            refreshBlocked.current = true;
            return; // Block this refresh
          }
        }

        // Allow refresh - update timestamp and session
        lastRefreshTime.current = now;
        refreshBlocked.current = false;
        
        // Silently update session without triggering re-renders
        setSession((prevSession) => {
          if (!prevSession || !session) return session;
          // Only update if token actually changed
          if (prevSession.access_token !== session.access_token) {
            return session;
          }
          return prevSession; // No change, keep previous session
        });
        return; // Don't process further
      }

      // For all other events (SIGNED_OUT, etc.), update state normally
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        console.log('🔄 SIGNED_OUT event received');
        setIsSigningIn(false);
        // Immediately redirect to signin to avoid any delay or flicker
        if (typeof window !== 'undefined' && window.location.pathname !== '/signin') {
          window.location.replace('/signin');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
        if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
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
        setTimeout(() => setIsSigningIn(false), 100);
      }
      return { error };
    } catch (err) {
      setIsSigningIn(false);
      const authError = err as AuthError;
      // Check for rate limit errors in catch block
      if (authError.status === 429 || authError.message?.toLowerCase().includes('rate limit')) {
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
      
      let lastError = null;
      
      for (const testEmail of emailVariations) {
        try {
          console.log('Trying email:', testEmail);
          const { data, error } = await supabase.auth.signUp({
            email: testEmail,
            password,
            options: {
              data: {
                roles: [userRole],
                activeRole: userRole,
                full_name: fullName || '',
              },
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
        const hasRoles = Array.isArray(data.user.user_metadata?.roles) && data.user.user_metadata?.roles.length > 0;
        if (!hasRoles && typeof window !== 'undefined') {
          const pendingRole = localStorage.getItem('samvera_pending_role') as SamveraRole | null;
          if (pendingRole) {
            await supabase.auth.updateUser({
              data: {
                roles: [pendingRole],
                activeRole: pendingRole,
              },
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function getRolePath(role: SamveraRole): string {
  const rolePaths = {
    teacher: '/dashboard/teacher',
    principal: '/dashboard/principal',
    parent: '/dashboard/parent',
    admin: '/dashboard/admin',
  };
  return rolePaths[role];
}
