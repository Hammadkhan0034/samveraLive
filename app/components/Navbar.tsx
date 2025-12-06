"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sun, Moon, Globe, ChevronDown, Monitor } from "lucide-react";
import { useLanguage } from "@/lib/contexts/LanguageContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { NotificationDropdown } from "@/app/components/shared/NotificationDropdown";
import { useUserRole } from "@/lib/hooks/useAuth";

interface NavbarProps {
  variant?: 'fixed' | 'static';
}

export default function Navbar({ variant = 'fixed' }: NavbarProps) {
  const { isDark, theme, toggleTheme } = useTheme();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { lang, setLang, t } = useLanguage();
  const { signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userRole = useUserRole();
  
  const showNotifications = userRole !== 'admin';

  // Ensure component is mounted before rendering theme-dependent content
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

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

  const positionClass = variant === 'fixed' ? 'fixed top-0 left-0 w-full' : 'relative w-full';

  return (
    <nav className={`${positionClass} z-50 bg-white dark:bg-slate-900 shadow-ds-sm backdrop-blur dark:supports-[backdrop-filter]:bg-slate-900/80`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 h-12 sm:h-14 flex items-center justify-between">
        {variant === 'fixed' && (
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <div className="relative w-24 sm:w-32 h-8 sm:h-10 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Samvera Logo"
                fill
                className="object-contain rounded-lg"
                priority
              />
            </div>
          </div>
        )}
        {variant === 'static' && <div />}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label={
              theme === 'light'
                ? "Switch to dark mode"
                : theme === 'dark'
                ? "Switch to system mode"
                : "Switch to light mode"
            }
            onClick={toggleTheme}
            className="inline-flex items-center gap-1 sm:gap-2 rounded-ds-md border border-slate-200 dark:border-slate-700 px-2 sm:px-3 py-1.5 sm:py-2 text-ds-tiny sm:text-ds-small text-slate-700 hover:bg-mint-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors duration-200"
            suppressHydrationWarning
          >
            {!mounted ? (
              <Sun size={14} className="sm:w-4 sm:h-4" />
            ) : theme === 'light' ? (
              <Sun size={14} className="sm:w-4 sm:h-4" />
            ) : theme === 'dark' ? (
              <Moon size={14} className="sm:w-4 sm:h-4" />
            ) : (
              <Monitor size={14} className="sm:w-4 sm:h-4" />
            )}
            {/* <span className="hidden sm:inline">{isDark ? t.light : t.dark}</span> */}
          </button>

          {showNotifications && <NotificationDropdown />}

          <div className="relative language-dropdown">
            <button
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              className="flex items-center gap-1 sm:gap-2 rounded-ds-md border border-slate-200 dark:border-slate-700 px-2 sm:px-3 py-1.5 text-ds-tiny sm:text-ds-small text-slate-700 hover:bg-mint-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors duration-200"
            >
              <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{lang === 'is' ? 'Íslenska' : 'English'}</span>
              <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLangDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 sm:w-40 rounded-ds-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-ds-md z-50">
                <button
                  onClick={() => {
                    setLang('en');
                    setIsLangDropdownOpen(false);
                  }}
                  className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-ds-tiny sm:text-ds-small text-left hover:bg-mint-100 dark:hover:bg-slate-700 first:rounded-t-ds-md ${lang === 'en' ? 'bg-mint-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  English
                </button>
                <button
                  onClick={() => {
                    setLang('is');
                    setIsLangDropdownOpen(false);
                  }}
                  className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-ds-tiny sm:text-ds-small text-left hover:bg-mint-100 dark:hover:bg-slate-700 last:rounded-b-ds-md ${lang === 'is' ? 'bg-mint-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  Íslenska
                </button>
              </div>
            )}
          </div>

          {/* Sign out (visible on admin routes or always if you prefer) */}
          <button
            onClick={async () => {
              await signOut();
              // Don't redirect to signin if we're on parent dashboard
              if (!pathname?.startsWith('/dashboard/guardian')) {
                router.replace('/signin');
              }
            }}
            className="inline-flex items-center gap-1 sm:gap-2 rounded-ds-md bg-mint-500 text-white px-2 sm:px-3 py-1.5 text-ds-tiny sm:text-ds-small hover:bg-mint-600 transition-colors duration-200"
          >
            <span className="hidden sm:inline">{lang === 'is' ? 'Útskrá' : 'Sign out'}</span>
            <span className="sm:hidden">{lang === 'is' ? 'Út' : 'Out'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}


