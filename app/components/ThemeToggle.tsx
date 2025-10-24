'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDark(shouldUseDark);
    const root = document.documentElement;
    if (shouldUseDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    // Persist and apply theme
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <button
      type="button"
      aria-label={isDark ? "Activate light mode" : "Activate dark mode"}
      onClick={() => setIsDark(v => !v)}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-500 transition-all duration-200"
    >
      {isDark ? (
        <Sun size={16} className="text-amber-500" />
      ) : (
        <Moon size={16} className="text-slate-600 dark:text-slate-300" />
      )}
      {/* <span className="hidden sm:inline">
        {isDark ? 'Light' : 'Dark'}
      </span> */}
    </button>
  );
}
