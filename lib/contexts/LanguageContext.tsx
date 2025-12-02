'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { enText, isText } from '@/lib/translations';
import { useAuth } from '@/lib/hooks/useAuth';
import { updateUserLanguage } from '@/lib/server-actions';

type Lang = 'is' | 'en';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof enText | typeof isText;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

// Default language: 'is'
const DEFAULT_LANG: Lang = 'is';

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const { user } = useAuth();
  const [mounted] = useState(() => typeof window !== 'undefined');
  const [isLoading, setIsLoading] = useState(true);

  // Always start with default to prevent hydration mismatch
  // Server and client both start with 'is'
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Initialize from localStorage after mount (if not logged in)
  // Or fetch from database (if logged in)
  useEffect(() => {
    if (!mounted) return;

    const initializeLanguage = async () => {
      // If user is logged in, fetch from database
      if (user?.id) {
        try {
          const response = await fetch('/api/user-preferences');
          if (response.ok) {
            const data = await response.json();
            const dbLanguage = data.language as Lang;
            
            if (dbLanguage && (dbLanguage === 'is' || dbLanguage === 'en')) {
              setLangState(dbLanguage);
              // Sync localStorage with database
              localStorage.setItem('samvera_lang', dbLanguage);
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('Failed to fetch language preference:', error);
          // Fallback to localStorage
        }
      }

      // If not logged in or fetch failed, use localStorage
      const saved = localStorage.getItem('samvera_lang') as Lang | null;
      if (saved && (saved === 'is' || saved === 'en')) {
        setLangState(saved);
      } else {
        // No localStorage, use default and save it
        setLangState(DEFAULT_LANG);
        localStorage.setItem('samvera_lang', DEFAULT_LANG);
      }
      
      setIsLoading(false);
    };

    initializeLanguage();
  }, [user?.id, mounted]);

  // Save language preference to localStorage when it changes
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem('samvera_lang', lang);
      // Update document lang attribute
      document.documentElement.setAttribute('lang', lang);
    }
  }, [lang, mounted]);

  // Save to database when language changes (if user is logged in)
  useEffect(() => {
    if (!user?.id || !mounted || isLoading) return;

    const saveLanguage = async () => {
      try {
        await updateUserLanguage(lang);
        // Ensure localStorage is in sync
        localStorage.setItem('samvera_lang', lang);
      } catch (error) {
        console.error('Failed to save language preference:', error);
        // Continue with localStorage fallback
      }
    };

    // Debounce database updates to avoid too many calls
    const timeoutId = setTimeout(saveLanguage, 500);
    return () => clearTimeout(timeoutId);
  }, [lang, user?.id, mounted, isLoading]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    // Immediately update localStorage
    if (mounted) {
      localStorage.setItem('samvera_lang', newLang);
    }
  }, [mounted]);

  const t = lang === 'is' ? isText : enText;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
