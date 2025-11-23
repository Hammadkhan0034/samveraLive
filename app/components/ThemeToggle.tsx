'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/contexts/ThemeContext';

export default function ThemeToggle() {
  const { isDark, theme, toggleTheme } = useTheme();

  return (
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
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-500 transition-all duration-200"
    >
      {theme === 'light' ? (
        <Sun size={16} className="text-amber-500" />
      ) : theme === 'dark' ? (
        <Moon size={16} className="text-slate-600 dark:text-slate-300" />
      ) : (
        <Monitor size={16} className="text-slate-600 dark:text-slate-300" />
      )}
      {/* <span className="hidden sm:inline">
        {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}
      </span> */}
    </button>
  );
}
