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
      <div className={`rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
        {/* Table header skeleton */}
        <div className="mb-4 flex items-center justify-between">
          <div className={`h-6 w-32 ${baseSkeletonClass}`}></div>
          <div className={`h-10 w-24 ${baseSkeletonClass}`}></div>
        </div>

        {/* Search bar skeleton */}
        <div className="mb-4">
          <div className={`h-10 w-full max-w-md ${baseSkeletonClass}`}></div>
        </div>

        {/* Table skeleton */}
        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {[1, 2, 3, 4].map((i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <div className={`h-4 w-20 ${baseSkeletonClass}`}></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100 dark:border-slate-700">
                  {[1, 2, 3, 4].map((colIndex) => (
                    <td key={colIndex} className="px-4 py-4">
                      <div className={`h-4 ${colIndex === 1 ? 'w-32' : colIndex === 2 ? 'w-24' : colIndex === 3 ? 'w-20' : 'w-16'} ${baseSkeletonClass}`}></div>
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
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={`rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800`}
          >
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 flex-shrink-0 ${baseSkeletonClass}`}></div>
              <div className="flex-1 space-y-2">
                <div className={`h-5 w-3/4 ${baseSkeletonClass}`}></div>
                <div className={`h-4 w-full ${baseSkeletonClass}`}></div>
                <div className={`h-4 w-5/6 ${baseSkeletonClass}`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className={`rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
              <div className={`h-10 w-10 flex-shrink-0 rounded-full ${baseSkeletonClass}`}></div>
              <div className="flex-1 space-y-2">
                <div className={`h-4 w-1/3 ${baseSkeletonClass}`}></div>
                <div className={`h-3 w-1/2 ${baseSkeletonClass}`}></div>
              </div>
              <div className={`h-8 w-16 ${baseSkeletonClass}`}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default skeleton
  return (
    <div className={`rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className={`h-4 w-3/4 ${baseSkeletonClass}`}></div>
            <div className={`h-4 w-full ${baseSkeletonClass}`}></div>
            <div className={`h-4 w-5/6 ${baseSkeletonClass}`}></div>
          </div>
        ))}
      </div>
    </div>
  );
}

