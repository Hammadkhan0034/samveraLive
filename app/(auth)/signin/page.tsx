'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Sun, Moon, Globe, ChevronDown, ArrowRight } from 'lucide-react';
import { type SamveraRole } from '@/lib/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { useLanguage } from '@/lib/contexts/LanguageContext';

type Lang = 'is' | 'en';

function SignInPageContent() {
  const router = useRouter();
  const qp = useSearchParams();
  const { signIn, signUp, signInWithOtp, verifyEmailOtp, user, loading, isSigningIn } = useAuth();
  const { isDark, toggleTheme } = useTheme();

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
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [invitationMessage, setInvitationMessage] = useState('');

  // Check for invitation acceptance message
  useEffect(() => {
    const message = qp?.get('message');
    if (message === 'invitation_accepted') {
      setInvitationMessage('Invitation accepted! Please sign in with your credentials.');
    }
  }, [qp]);

  // Pre-fill email and password from query params (for magic link flow)
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
    if (!useOtp) {
      if (!password) {
        setErr(t.errors.password_required);
        return;
      }
    }
    
    if (isSignUp && !fullName.trim()) {
      setErr(t.errors.fullname_required);
      return;
    }

    setSubmitting(true);

    try {
      if (useOtp) {
        const { error } = await signInWithOtp(trimmed, initialRole);
        if (error) {
          setErr(error.message || 'Failed to send magic link.');
        } else {
          setOtpSent(true);
          setErr(t.success.magic_link_sent);
        }
      } else if (isSignUp) {
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


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">    
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Header with theme and language controls */}
          <div className="mb-10 flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-xl blur-sm"></div>
                <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold shadow-lg">
                  S
                </span>
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Samvera
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Education Platform</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                aria-label={isDark ? "Activate light mode" : "Activate dark mode"}
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              
              <div className="relative language-dropdown">
                <button
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  <span>{lang === 'is' ? 'Íslenska' : 'English'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isLangDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50">
                    <button
                      onClick={() => {
                        setLang('en');
                        setIsLangDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 first:rounded-t-lg ${lang === 'en' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => {
                        setLang('is');
                        setIsLangDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 last:rounded-b-lg ${lang === 'is' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      Íslenska
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Sign in card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-xl p-8"
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {isSignUp ? t.title_signup : t.signin_title}
              </h1>
              <p className="text-slate-600 dark:text-slate-200">
                {isSignUp ? t.sub_signup : t.signin_sub}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      {t.fullname}
                    </label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignUp}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent transition-all"
                      placeholder={t.fullname_placeholder}
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    {t.signin_email}
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent transition-all"
                    placeholder="you@school.is"
                  />
                </div>

                {!useOtp && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {t.signin_password}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={!useOtp}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 pr-12 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                )}

                {useOtp && otpSent && (
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                          Magic link sent!
                        </h3>
                        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                          {t.otp_instructions}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Role info */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 px-4 py-3 text-sm">
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium">
                    {isSignUp 
                      ? t.signup_role.replace('{role}', roleLabel(initialRole, lang))
                      : t.signin_role.replace('{role}', roleLabel(initialRole, lang))
                    }
                  </span>
                </p>
              </div>

              {invitationMessage ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300" 
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
                  className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300" 
                  role="alert" 
                  aria-live="polite"
                >
                  {err}
                </motion.div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || isSigningIn}
                className="w-full rounded-md bg-slate-900 dark:bg-slate-600 py-2 px-4 font-medium text-white dark:text-slate-100 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    {useOtp ? t.signin_sending : isSignUp ? t.signing_up : t.signing_in}
                  </>
                ) : (
                  <>
                    {useOtp ? t.send_magic_link : isSignUp ? t.signup : t.signin}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="text-center space-x-4">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  {isSignUp ? t.already_have_account : t.need_account}
                </button>
                <button
                  type="button"
                  onClick={() => { setUseOtp(v => !v); setOtpSent(false); setErr(''); }}
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  {useOtp ? t.use_password : t.use_magic_link}
                </button>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
            className="mt-8 text-center"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
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
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  );
}
