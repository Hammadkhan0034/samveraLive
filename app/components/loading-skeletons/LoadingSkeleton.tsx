'use client';

import React from 'react';

export type LoadingSkeletonType = 'table' | 'cards' | 'list' | 'default';

export interface LoadingSkeletonProps {
  type?: LoadingSkeletonType;
  rows?: number;
  className?: string;
}

export default function LoadingSkeleton({ 
  type = 'default', 
  rows = 5,
  className = '' 
}: LoadingSkeletonProps) {
  const baseSkeletonClass = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded';

  if (type === 'table') {
    return (
      <div className={`rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
        {/* Table header skeleton */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <div className={`h-5 sm:h-6 w-24 sm:w-32 ${baseSkeletonClass}`}></div>
          <div className={`h-8 sm:h-10 w-20 sm:w-24 ${baseSkeletonClass}`}></div>
        </div>

        {/* Search bar skeleton */}
        <div className="mb-3 sm:mb-4">
          <div className={`h-8 sm:h-10 w-full max-w-md ${baseSkeletonClass}`}></div>
        </div>

        {/* Table skeleton */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {[1, 2, 3, 4].map((i) => (
                  <th key={i} className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                    <div className={`h-3 sm:h-4 w-16 sm:w-20 ${baseSkeletonClass}`}></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100 dark:border-slate-700">
                  {[1, 2, 3, 4].map((colIndex) => (
                    <td key={colIndex} className="px-2 sm:px-4 py-3 sm:py-4">
                      <div className={`h-3 sm:h-4 ${colIndex === 1 ? 'w-24 sm:w-32' : colIndex === 2 ? 'w-20 sm:w-24' : colIndex === 3 ? 'w-16 sm:w-20' : 'w-12 sm:w-16'} ${baseSkeletonClass}`}></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className={`space-y-3 sm:space-y-4 ${className}`}>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={`rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800`}
          >
            <div className="flex items-start gap-2 sm:gap-4">
              <div className={`h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 ${baseSkeletonClass}`}></div>
              <div className="flex-1 space-y-1.5 sm:space-y-2">
                <div className={`h-4 sm:h-5 w-3/4 ${baseSkeletonClass}`}></div>
                <div className={`h-3 sm:h-4 w-full ${baseSkeletonClass}`}></div>
                <div className={`h-3 sm:h-4 w-5/6 ${baseSkeletonClass}`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className={`rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
        <div className="space-y-2 sm:space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-2 sm:gap-3 py-2 sm:py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
              <div className={`h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 rounded-full ${baseSkeletonClass}`}></div>
              <div className="flex-1 space-y-1.5 sm:space-y-2">
                <div className={`h-3 sm:h-4 w-1/3 ${baseSkeletonClass}`}></div>
                <div className={`h-2.5 sm:h-3 w-1/2 ${baseSkeletonClass}`}></div>
              </div>
              <div className={`h-7 w-12 sm:h-8 sm:w-16 ${baseSkeletonClass}`}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default skeleton
  return (
    <div className={`rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      <div className="space-y-3 sm:space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-1.5 sm:space-y-2">
            <div className={`h-3 sm:h-4 w-3/4 ${baseSkeletonClass}`}></div>
            <div className={`h-3 sm:h-4 w-full ${baseSkeletonClass}`}></div>
            <div className={`h-3 sm:h-4 w-5/6 ${baseSkeletonClass}`}></div>
          </div>
        ))}
      </div>
    </div>
  );
}

