'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Loading from '@/app/components/shared/Loading';

function SignInPageContent() {
  const router = useRouter();
  const qp = useSearchParams();
  const { signIn, user, loading, isSigningIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [invitationMessage, setInvitationMessage] = useState('');

  // Check for invitation acceptance message
  useEffect(() => {
    const message = qp?.get('message');
    if (message === 'invitation_accepted') {
      setInvitationMessage('Invitation accepted! Please sign in with your credentials.');
    }
  }, [qp]);

  // Pre-fill email and password from query params
  useEffect(() => {
    const emailParam = qp?.get('email');
    const passwordParam = qp?.get('password');
    if (emailParam) setEmail(emailParam);
    if (passwordParam) setPassword(passwordParam);
  }, [qp]);

  // Redirect if already authenticated - only check once when loading completes and user exists
  useEffect(() => {
    if (!loading && user) {
      const userRole = user.user_metadata?.activeRole || user.user_metadata?.roles?.[0];
      if (userRole) {
        const path = userRole === 'principal'
          ? '/dashboard/principal'
          : userRole === 'teacher'
          ? '/dashboard/teacher'
          : userRole === 'admin'
          ? '/dashboard/admin'
          : '/dashboard/parent';
        router.replace(path);
      }
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    // Prevent multiple submissions
    if (submitting || isSigningIn) {
      return;
    }

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErr(t.errors.email_required);
      return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setErr(t.errors.email_invalid);
      return;
    }
    if (!password) {
      setErr(t.errors.password_required);
      return;
    }

    setSubmitting(true);

    try {
      console.log('Starting signin process...');
      const { error } = await signIn(trimmed, password);
      if (error) {
        console.error('Signin failed:', error);
        // Check for rate limit errors specifically
        if (error.status === 429 || error.message?.toLowerCase().includes('rate limit') || error.message?.toLowerCase().includes('too many')) {
          setErr(t.errors.rate_limit || 'Too many sign-in attempts. Please wait a few minutes before trying again.');
        } else {
          setErr(error.message || 'Signin failed. Please check your credentials.');
        }
      }
      // Success is handled by the auth context redirect
    } catch (error) {
      console.error('Unexpected error:', error);
      setErr(t.errors.unexpected);
    } finally {
      setSubmitting(false);
    }
  }


  // Show loading state while checking authentication to prevent flash
  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-mint-200 dark:bg-slate-950 rounded-tl-[48px] rounded-br-[48px]">
      <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-slate-800">
        {/* Welcome Section - Left Side (Hidden on mobile) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden md:flex flex-1 flex-col justify-center px-ds-xl py-ds-2xl"
        >
          <div className="max-w-md">
            <h1 className="text-ds-h1 font-bold text-ds-text-primary dark:text-slate-100 mb-ds-lg">
              Welcome to Samvera
            </h1>
            <div className="rounded-ds-xl bg-mint-200 dark:bg-mint-300/30 p-ds-lg">
              <p className="text-ds-body font-bold text-ds-text-primary dark:text-slate-100 mb-ds-sm">
                For principals, teachers & parents
              </p>
              <p className="text-ds-small text-ds-text-muted dark:text-slate-400">
                Use this space for a short value statement or onboarding copy.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Sign In Form - Right Side */}
        <div className="flex-1 flex items-center justify-center px-ds-sm py-ds-xl md:px-ds-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full max-w-md"
          >
            {/* Sign in card */}
            <div className="rounded-ds-xl bg-white dark:bg-slate-800 shadow-ds-card p-ds-lg">
              <div className="mb-ds-md">
                <h1 className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100 mb-ds-xs">
                  Samvera login
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-ds-md" noValidate>
                <div className="space-y-ds-md">
                  <div>
                    <label className="block text-ds-small font-medium text-ds-text-secondary dark:text-slate-300 mb-ds-xs">
                      {t.signin_email}
                    </label>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-12 rounded-ds-xl border border-[#D8EBD8] bg-[#F5FFF7] dark:bg-mint-300/30 px-ds-sm text-ds-body text-ds-text-primary dark:text-slate-100 placeholder-ds-text-muted dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mint-500 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-ds-small font-medium text-ds-text-secondary dark:text-slate-300 mb-ds-xs">
                      {t.signin_password}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full h-12 rounded-ds-xl border border-[#D8EBD8] bg-[#F5FFF7] dark:bg-mint-300/30 px-ds-sm pr-28 text-ds-body text-ds-text-primary dark:text-slate-100 placeholder-ds-text-muted dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mint-500 transition-all"
                        placeholder="••••••••"
                      />
                      <div className="absolute right-ds-sm top-1/2 -translate-y-1/2 flex items-center gap-ds-sm">
                        <button
                          type="button"
                          className="text-ds-small text-ds-text-muted dark:text-slate-400 hover:text-ds-text-primary dark:hover:text-slate-200 transition-colors"
                        >
                          Forgot?
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-ds-text-muted dark:text-slate-400 hover:text-ds-text-primary dark:hover:text-slate-200 transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center gap-ds-xs">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-mint-200 dark:bg-mint-300/30 border-0 text-mint-500 focus:ring-2 focus:ring-mint-500 focus:ring-offset-0 cursor-pointer accent-mint-500"
                  />
                  <label
                    htmlFor="remember-me"
                    className="text-ds-small text-ds-text-secondary dark:text-slate-300 cursor-pointer"
                  >
                    Remember me on this device.
                  </label>
                </div>

                {invitationMessage ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-ds-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-ds-md py-ds-sm text-ds-small text-green-700 dark:text-green-300"
                    role="alert"
                    aria-live="polite"
                  >
                    ✅ {invitationMessage}
                  </motion.div>
                ) : null}

                {err ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-ds-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-ds-md py-ds-sm text-ds-small text-red-700 dark:text-red-300"
                    role="alert"
                    aria-live="polite"
                  >
                    {err}
                  </motion.div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || isSigningIn}
                  className="w-full rounded-ds-md bg-pale-yellow dark:bg-pale-yellow py-ds-sm px-ds-md font-medium text-ds-text-primary dark:text-ds-text-primary shadow-ds-md hover:shadow-ds-lg hover:opacity-90 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex items-center justify-center gap-ds-xs text-ds-body"
                >
                  {submitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-ds-text-primary border-t-transparent"></div>
                      {t.signing_in}
                    </>
                  ) : (
                    <>
                      {t.signin}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div className="text-center">
                  <p className="text-ds-small text-ds-text-muted dark:text-slate-400">
                    No account yet? Edit this text to link to your onboarding flow.
                  </p>
                </div>
              </form>
            </div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-ds-lg text-center"
            >
              <p className="text-ds-small text-ds-text-muted dark:text-slate-400">
                © {new Date().getFullYear()} Samvera. All rights reserved.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <SignInPageContent />
    </Suspense>
  );
}
