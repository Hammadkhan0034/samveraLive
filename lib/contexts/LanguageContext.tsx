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

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const { user } = useAuth();
  // Always start with 'en' to match server-side rendering
  // This prevents hydration mismatches
  // Use lazy initialization to avoid setState in effect
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('samvera_lang') as Lang | null;
    return (saved === 'is' || saved === 'en') ? saved : 'en';
  });
  const [mounted] = useState(() => typeof window !== 'undefined');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch language from database on mount if user is logged in
  useEffect(() => {
    const fetchLanguage = async () => {
      if (!user?.id || !mounted) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user-preferences');
        if (response.ok) {
          const data = await response.json();
          const dbLanguage = data.language as Lang;
          
          if (dbLanguage && (dbLanguage === 'is' || dbLanguage === 'en')) {
            setLangState(dbLanguage);
            // Sync localStorage with database
            localStorage.setItem('samvera_lang', dbLanguage);
          }
        }
      } catch (error) {
        console.error('Failed to fetch language preference:', error);
        // Fallback to localStorage
      } finally {
        setIsLoading(false);
      }
    };

    fetchLanguage();
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
  }, []);

  const t = lang === 'is' ? isText : enText;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
