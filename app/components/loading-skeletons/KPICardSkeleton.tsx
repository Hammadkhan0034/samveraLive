'use client';

import React from 'react';

export interface KPICardSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton component for KPI cards in the teacher dashboard.
 * Matches the exact structure of the actual KPI cards.
 * 
 * @example
 * ```tsx
 * <KPICardSkeleton count={6} />
 * ```
 */
export default function KPICardSkeleton({ 
  count = 6,
  className = '' 
}: KPICardSkeletonProps) {
  const baseSkeletonClass = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded';

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          {/* Top row: Label and Icon container */}
          <div className="flex items-center justify-between">
            {/* Label skeleton */}
            <div className={`h-4 w-20 ${baseSkeletonClass}`}></div>
            {/* Icon container skeleton */}
            <div className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-600">
              <div className={`h-full w-full ${baseSkeletonClass}`}></div>
            </div>
          </div>
          {/* Value skeleton */}
          <div className={`mt-3 h-8 w-16 ${baseSkeletonClass}`}></div>
        </div>
      ))}
    </div>
  );
}

