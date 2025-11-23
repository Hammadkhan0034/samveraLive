'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { updateUserTheme } from '@/lib/server-actions';

type ThemeMode = 'light' | 'dark' | 'system';

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

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { user } = useAuth();
  const [mounted] = useState(() => typeof window !== 'undefined');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize theme from localStorage or system preference
  const getInitialTheme = useCallback((): ThemeMode => {
    if (typeof window === "undefined") return 'system';
    const saved = localStorage.getItem("theme") as ThemeMode | null;
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
  }, []);

  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  // Compute isDark based on theme mode
  const getIsDark = useCallback((currentTheme: ThemeMode): boolean => {
    if (currentTheme === 'system') {
      if (typeof window === 'undefined') return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return currentTheme === 'dark';
  }, []);

  const [isDark, setIsDarkState] = useState(() => getIsDark(getInitialTheme()));

  // Fetch theme from database on mount if user is logged in
  useEffect(() => {
    const fetchTheme = async () => {
      if (!user?.id || !mounted) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user-preferences');
        if (response.ok) {
          const data = await response.json();
          const dbTheme = data.theme as ThemeMode;
          
          if (dbTheme && (dbTheme === 'light' || dbTheme === 'dark' || dbTheme === 'system')) {
            setThemeState(dbTheme);
            // Sync localStorage with database
            localStorage.setItem('theme', dbTheme);
            setIsDarkState(getIsDark(dbTheme));
          }
        }
      } catch (error) {
        console.error('Failed to fetch theme preference:', error);
        // Fallback to localStorage
      } finally {
        setIsLoading(false);
      }
    };

    fetchTheme();
  }, [user?.id, mounted, getIsDark]);

  // Listen to system preference changes when theme is 'system'
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkState(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    setIsDarkState(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme, mounted]);

  // Update isDark when theme changes (but not when it's 'system' - that's handled above)
  useEffect(() => {
    if (!mounted || theme === 'system') return;
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
  }, []);

  const setIsDark = useCallback((dark: boolean) => {
    // When manually setting isDark, update theme accordingly
    setThemeState(dark ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    // Cycle through: light → dark → system → light
    setThemeState(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, theme, setTheme, setIsDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

