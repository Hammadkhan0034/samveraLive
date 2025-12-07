'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function Accordion({ title, children, defaultOpen = false, icon, className = '' }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-ds-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-ds-md hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-mint-600 dark:text-mint-400">{icon}</span>}
          <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-slate-600 dark:text-slate-400 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-ds-md pb-ds-md border-t border-slate-200 dark:border-slate-700">
          <div className="pt-ds-md">{children}</div>
        </div>
      )}
    </div>
  );
}
