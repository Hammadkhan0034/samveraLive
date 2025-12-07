'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { updateUserTheme } from '@/lib/server-actions';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  isDark: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  setIsDark: (isDark: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

// Default theme: 'light' (not 'system')
const DEFAULT_THEME: ThemeMode = 'light';

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { user } = useAuth();
  const [mounted] = useState(() => typeof window !== 'undefined');
  const [isLoading, setIsLoading] = useState(true);

  // Always start with default to prevent hydration mismatch
  // Server and client both start with 'light'
  const [theme, setThemeState] = useState<ThemeMode>(DEFAULT_THEME);
  const [isDark, setIsDarkState] = useState(false); // Default to light

  // Initialize from localStorage after mount (if not logged in)
  // Or fetch from database (if logged in)
  useEffect(() => {
    if (!mounted) return;

    const initializeTheme = async () => {
      // If user is logged in, fetch from database
      if (user?.id) {
        try {
          const response = await fetch('/api/user-preferences');
          if (response.ok) {
            const data = await response.json();
            const dbTheme = data.theme as ThemeMode;
            
            if (dbTheme && (dbTheme === 'light' || dbTheme === 'dark')) {
              setThemeState(dbTheme);
              setIsDarkState(dbTheme === 'dark');
              // Sync localStorage with database
              localStorage.setItem('theme', dbTheme);
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('Failed to fetch theme preference:', error);
          // Fallback to localStorage
        }
      }

      // If not logged in or fetch failed, use localStorage
      const saved = localStorage.getItem("theme") as ThemeMode | null;
      if (saved && (saved === 'light' || saved === 'dark')) {
        setThemeState(saved);
        setIsDarkState(saved === 'dark');
      } else {
        // No localStorage, use default (light) and save it
        setThemeState(DEFAULT_THEME);
        setIsDarkState(false);
        localStorage.setItem('theme', DEFAULT_THEME);
      }
      
      setIsLoading(false);
    };

    initializeTheme();
  }, [user?.id, mounted]);

  // Update isDark when theme changes
  useEffect(() => {
    if (!mounted) return;
    setIsDarkState(theme === 'dark');
  }, [theme, mounted]);

  // Apply theme to document when it changes
  useEffect(() => {
    if (!mounted || isLoading) return;
    
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    // Always save current theme mode to localStorage
    localStorage.setItem("theme", theme);
  }, [isDark, theme, mounted, isLoading]);

  // Save to database when theme changes (if user is logged in)
  useEffect(() => {
    if (!user?.id || !mounted || isLoading) return;

    const saveTheme = async () => {
      try {
        await updateUserTheme(theme);
        // Ensure localStorage is in sync
        localStorage.setItem("theme", theme);
      } catch (error) {
        console.error('Failed to save theme preference:', error);
        // Continue with localStorage fallback
      }
    };

    // Debounce database updates to avoid too many calls
    const timeoutId = setTimeout(saveTheme, 500);
    return () => clearTimeout(timeoutId);
  }, [theme, user?.id, mounted, isLoading]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    // Immediately update localStorage
    if (mounted) {
      localStorage.setItem("theme", newTheme);
    }
  }, [mounted]);

  const setIsDark = useCallback((dark: boolean) => {
    const newTheme = dark ? 'dark' : 'light';
    setThemeState(newTheme);
    if (mounted) {
      localStorage.setItem("theme", newTheme);
    }
  }, [mounted]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      if (mounted) {
        localStorage.setItem("theme", newTheme);
      }
      return newTheme;
    });
  }, [mounted]);

  return (
    <ThemeContext.Provider value={{ isDark, theme, setTheme, setIsDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

