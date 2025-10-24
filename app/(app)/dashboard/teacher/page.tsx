'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';
import TeacherDashboard from '../../../components/TeacherDashboard';
import { useRequireAuth, useAuth } from '../../../../lib/hooks/useAuth';
import ThemeProvider from '../../../components/ThemeProvider';
import ThemeToggle from '../../../components/ThemeToggle';

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user, loading, isSigningIn } = useRequireAuth('teacher');
  const { signOut } = useAuth();
  const [lang, setLang] = useState<'is' | 'en'>('en');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);


  // Set email from user data
  const email = user?.email || '';

  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? (localStorage.getItem('samvera_lang') as 'is' | 'en' | null)
      : null;
    if (saved === 'is' || saved === 'en') setLang(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('samvera_lang', lang);
  }, [lang]);

  async function handleSignOut() {
    await signOut();
    router.replace('/signin');
  }

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

  // Only show loading if we're actually loading and don't have a user yet
  if (loading && !user && isSigningIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading teacher dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-sand-200 bg-sand-50/75 backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <a href="/" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">S</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">Samvera</span>
            </a>
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* Language Dropdown */}
              <div className="relative language-dropdown">
                <button
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="flex items-center gap-2 rounded-md bg-transparent border border-gray-300 text-sm px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">{lang === 'is' ? 'Íslenska' : 'English'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isLangDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-sand-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50">
                    <button
                      onClick={() => {
                        setLang('en');
                        setIsLangDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-sand-100 dark:hover:bg-slate-700 first:rounded-t-lg ${lang === 'en' ? 'bg-sand-100 dark:bg-slate-700 text-gray-700 dark:text-slate-100' : 'text-gray-700 dark:text-slate-300'}`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => {
                        setLang('is');
                        setIsLangDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-sand-100 dark:hover:bg-slate-700 last:rounded-b-lg ${lang === 'is' ? 'bg-sand-100 dark:bg-slate-700 text-gray-700 dark:text-slate-100' : 'text-gray-700 dark:text-slate-300'}`}
                    >
                      Íslenska
                    </button>
                  </div>
                )}
              </div>
              
              {/* <div className="text-sm text-sand-600 dark:text-slate-400">{email}</div> */}
              <button
                onClick={handleSignOut}
                className="rounded-md bg-transparent text-sm border border-gray-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {lang === 'is' ? 'Útskrá' : 'Sign out'}
              </button>
            </div>
          </div>
        </header>


      <TeacherDashboard lang={lang} />
    </div>
    </ThemeProvider>
  );
}