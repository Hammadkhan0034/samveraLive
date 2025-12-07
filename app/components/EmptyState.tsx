'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  className?: string;
};

export default function EmptyState({ 
  icon: Icon,
  title,
  description,
  className = '' 
}: EmptyStateProps) {
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

