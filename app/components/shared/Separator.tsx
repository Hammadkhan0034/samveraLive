import React from 'react';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Separator({ orientation = 'horizontal', className = '' }: SeparatorProps) {
  if (orientation === 'vertical') {
    return (
      <div className={`w-px h-full bg-slate-200 dark:bg-slate-700 ${className}`} aria-orientation="vertical" />
    );
  }

  return (
    <div className={`h-px w-full bg-slate-200 dark:bg-slate-700 ${className}`} aria-orientation="horizontal" />
  );
}
