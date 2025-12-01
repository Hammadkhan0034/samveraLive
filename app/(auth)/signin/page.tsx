'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Sun, Moon, Globe, ChevronDown, ArrowRight, Monitor } from 'lucide-react';
import { type SamveraRole } from '@/lib/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import Loading from '@/app/components/shared/Loading';

type Lang = 'is' | 'en';

function SignInPageContent() {
  const router = useRouter();
  const qp = useSearchParams();
  const { signIn, signUp, user, loading, isSigningIn } = useAuth();
  const { isDark, theme, toggleTheme } = useTheme();

  // Allow ?role=teacher|principal|parent|admin to pick the demo role for signup
  const queryRole = qp?.get('role');
  const initialRole: SamveraRole =
    queryRole === 'teacher' || queryRole === 'principal' || queryRole === 'parent' || queryRole === 'admin'
      ? (queryRole as SamveraRole)
      : 'parent'; // default demo role

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { lang, setLang, t } = useLanguage();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [invitationMessage, setInvitationMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering theme-dependent content
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isLangDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('.language-dropdown')) {
          setIsLangDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLangDropdownOpen]);

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
    
    if (isSignUp && !fullName.trim()) {
      setErr(t.errors.fullname_required);
      return;
    }

    setSubmitting(true);

    try {
      if (isSignUp) {
        console.log('Starting signup process...');
        const { error } = await signUp(trimmed, password, initialRole, fullName.trim());
        if (error) {
          console.error('Signup failed:', error);
          setErr(error.message || 'Signup failed. Please check your email and password.');
        } else {
          console.log('Signup successful, showing success message');
          setErr(t.success.check_email);
        }
      } else {
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
      }
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
    <div className="min-h-screen bg-mint-200 dark:bg-slate-950">    
      <div className="relative flex min-h-screen items-center justify-center px-ds-sm py-ds-xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Header with theme and language controls */}
        
          {/* Sign in card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-ds-xl bg-white dark:bg-slate-800 shadow-ds-card p-ds-lg"
          >
            <div className="text-center mb-ds-md">
              <h1 className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100 mb-ds-xs">
                {isSignUp ? t.title_signup : t.signin_title}
              </h1>
              <p className="text-ds-body text-ds-text-secondary dark:text-slate-200">
                {isSignUp ? t.sub_signup : t.signin_sub}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-ds-md" noValidate>
              <div className="space-y-ds-md">
                {isSignUp && (
                  <div>
                    <label className="block text-ds-small font-medium text-ds-text-secondary dark:text-slate-300 mb-ds-xs">
                      {t.fullname}
                    </label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignUp}
                      className="w-full h-12 rounded-ds-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-ds-sm text-ds-body text-ds-text-primary dark:text-slate-100 placeholder-ds-text-muted dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all"
                      placeholder={t.fullname_placeholder}
                    />
                  </div>
                )}
                
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
                    className="w-full h-12 rounded-ds-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-ds-sm text-ds-body text-ds-text-primary dark:text-slate-100 placeholder-ds-text-muted dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all"
                    placeholder="you@school.is"
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
                      className="w-full h-12 rounded-ds-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-ds-sm pr-12 text-ds-body text-ds-text-primary dark:text-slate-100 placeholder-ds-text-muted dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-ds-sm top-1/2 -translate-y-1/2 text-ds-text-muted dark:text-slate-400 hover:text-ds-text-primary dark:hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
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
                className="w-full rounded-ds-md bg-mint-500 py-ds-sm px-ds-md font-medium text-white shadow-ds-md hover:shadow-ds-lg hover:bg-mint-600 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex items-center justify-center gap-ds-xs text-ds-body"
              >
                {submitting ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    {isSignUp ? t.signing_up : t.signing_in}
                  </>
                ) : (
                  <>
                    {isSignUp ? t.signup : t.signin}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-ds-small text-ds-text-secondary dark:text-slate-400 hover:text-ds-text-primary dark:hover:text-slate-200 transition-colors"
                >
                  {isSignUp ? t.already_have_account : t.need_account}
                </button>
              </div>

              <div className="text-center">
                <p className="text-ds-tiny text-ds-text-muted dark:text-slate-400 leading-relaxed">
                  {t.auth_hint}
                </p>
              </div>
            </form>
          </motion.div>

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
  );
}

function roleLabel(r: SamveraRole, lang: Lang) {
  if (lang === 'is') return r === 'teacher' ? 'kennari' : r === 'principal' ? 'stjórnandi' : r === 'admin' ? 'stjórnandi' : 'foreldri';
  return r === 'teacher' ? 'teacher' : r === 'principal' ? 'principal' : r === 'admin' ? 'admin' : 'parent';
}

// Translations removed - using centralized translations from @/lib/translations

export default function SignInPage() {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <SignInPageContent />
    </Suspense>
  );
}
