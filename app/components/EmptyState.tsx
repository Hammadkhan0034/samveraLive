'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

type Lang = 'en' | 'is';

type EmptyStateProps = {
  lang?: Lang;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  message?: string; // Deprecated: kept for backward compatibility
  className?: string;
};

const TEXTS = {
  en: {
    defaultMessage: 'Start searching to find results',
  },
  is: {
    defaultMessage: 'Byrjaðu að leita til að finna niðurstöður',
  },
} as const;

export default function EmptyState({ 
  lang = 'en', 
  icon: Icon,
  title,
  description,
  message,
  className = '' 
}: EmptyStateProps) {
  const t = TEXTS[lang] || TEXTS.en;
  
  // If new props are provided, use them; otherwise fall back to message
  const hasNewProps = Icon || title || description;
  const displayMessage = message || t.defaultMessage;

  // If using new props structure
  if (hasNewProps) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
        {Icon && (
          <div className="mb-4">
            <Icon className="h-12 w-12 text-slate-400 dark:text-slate-500" />
          </div>
        )}
        {title && (
          <h3 className="mb-2 text-base font-semibold text-slate-700 dark:text-slate-300">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
    );
  }

  // Fallback to old message-based display
  return (
    <div className={`flex justify-start py-3 text-center ${className}`}>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {displayMessage}
      </div>
    </div>
  );
  
}

