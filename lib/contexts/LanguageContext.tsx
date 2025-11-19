'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { enText, isText } from '@/lib/translations';

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
  // Always start with 'en' to match server-side rendering
  // This prevents hydration mismatches
  // Use lazy initialization to avoid setState in effect
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('samvera_lang') as Lang | null;
    return (saved === 'is' || saved === 'en') ? saved : 'en';
  });
  const [mounted] = useState(() => typeof window !== 'undefined');

  // Save language preference to localStorage when it changes
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem('samvera_lang', lang);
    }
  }, [lang, mounted]);

  const t = lang === 'is' ? isText : enText;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
