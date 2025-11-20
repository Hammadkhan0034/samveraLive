'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export interface LoadingProps {
  /**
   * If true, renders full-screen loading with gradient background
   * If false, renders inline loading spinner
   */
  fullScreen?: boolean;
  /**
   * Optional loading text. If not provided, uses translation or default "Loading..."
   */
  text?: string;
  /**
   * Background gradient variant for full-screen mode
   */
  variant?: 'default' | 'sand';
  /**
   * Additional className for inline variant
   */
  className?: string;
}

/**
 * Shared Loading component for consistent loading states across the application
 * 
 * @example
 * ```tsx
 * // Full-screen loading
 * <Loading fullScreen text="Loading dashboard..." />
 * 
 * // Inline loading
 * <Loading text="Loading data..." />
 * 
 * // Suspense fallback
 * <Suspense fallback={<Loading fullScreen />}>
 *   <Component />
 * </Suspense>
 * ```
 */
export default function Loading({
  fullScreen = false,
  text,
  variant = 'default',
  className = '',
}: LoadingProps) {
  const { t } = useLanguage();
  
  // Use provided text, translation, or default
  const loadingText = text || t.loading || 'Loading...';

  // Spinner component
  const spinner = (
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
  );

  // Loading content
  const content = (
    <div className="text-center">
      {spinner}
      <p className="text-slate-600 dark:text-slate-400">{loadingText}</p>
    </div>
  );

  // Full-screen variant
  if (fullScreen) {
    const backgroundClass = variant === 'sand'
      ? 'min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900'
      : 'min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950';

    return (
      <div className={backgroundClass}>
        <div className="flex items-center justify-center min-h-screen">
          {content}
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {content}
    </div>
  );
}

