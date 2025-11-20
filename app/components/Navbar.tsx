"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Globe, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/contexts/LanguageContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { NotificationDropdown } from "@/app/components/shared/NotificationDropdown";
import { useUserRole } from "@/lib/hooks/useAuth";

export default function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const { lang, setLang, t } = useLanguage();
  const { signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userRole = useUserRole();
  
  // Hide notification bell for Admin role
  const showNotifications = userRole !== 'admin';

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

  return (
    <nav className="fixed top-0 left-0 w-full z-50 border-b border-sand-200 bg-slate-900 backdrop-blur supports-[backdrop-filter]:bg-sand-50/80 dark:border-slate-700 dark:bg-slate-900 dark:supports-[backdrop-filter]:bg-slate-900/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
          <span className="inline-block rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-0.5 px-2.5">S</span>
          <span>Samvera</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isDark ? "Activate light mode" : "Activate dark mode"}
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            suppressHydrationWarning
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {/* <span className="hidden sm:inline">{isDark ? t.light : t.dark}</span> */}
          </button>
          
          {showNotifications && <NotificationDropdown />}
          
          <div className="relative language-dropdown">
            <button
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              className="flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'is' ? 'Íslenska' : 'English'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isLangDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50">
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

          {/* Sign out (visible on admin routes or always if you prefer) */}
          <button
            onClick={async () => {
              await signOut();
              // Don't redirect to signin if we're on parent dashboard
              if (!pathname?.startsWith('/dashboard/parent')) {
                router.replace('/signin');
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {lang === 'is' ? 'Útskrá' : 'Sign out'}
          </button>
        </div>
      </div>
    </nav>
  );
}


