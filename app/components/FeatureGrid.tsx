'use client';
import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export type FeatureItem = {
  href: string;
  title: string;
  desc?: string;
  Icon?: LucideIcon;
  badge?: string | number;   // ✅ allow both numbers and strings
};

export default function FeatureGrid({ items }: { items: FeatureItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ href, title, desc, Icon, badge }, idx) => (
        <Link
          key={idx}
          href={href}
          className="block rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 hover:shadow-ds-lg transition-shadow"
        >
          <div className="mb-4 flex items-center gap-3">
            {Icon ? (
              <span className="inline-flex rounded-ds-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700">
                <Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </span>
            ) : null}
            <div className="flex-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </div>
              {badge !== undefined ? (
                <span className="ml-auto rounded-ds-full border border-slate-200 bg-slate-100 px-2 py-1 text-ds-tiny font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {badge}
                </span>
              ) : null}
            </div>
          </div>
          {desc ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {desc}
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
