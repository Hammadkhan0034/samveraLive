'use client';

import React from 'react';

/**
 * Skeleton component for the school information section in the principal dashboard.
 * Matches the exact structure of the school information section with header, action buttons,
 * hero card, and stat badge cards.
 */
export default function SchoolInfoSkeleton() {
  const baseSkeletonClass = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded';

  return (
    <section className="mb-ds-lg space-y-6">
      {/* Header Section Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* School Information Skeleton */}
        <div>
          {/* School Name Skeleton */}
          <div className={`h-8 w-64 ${baseSkeletonClass} mb-2`}></div>
          {/* Address/Metadata Row Skeleton */}
          <div className="flex flex-wrap items-center gap-4 mt-1">
            <div className={`h-4 w-48 ${baseSkeletonClass}`}></div>
            <div className="hidden md:inline h-4 w-1 bg-slate-300 dark:bg-slate-600"></div>
            <div className={`h-4 w-32 ${baseSkeletonClass}`}></div>
            <div className="hidden md:inline h-4 w-1 bg-slate-300 dark:bg-slate-600"></div>
            <div className={`h-5 w-20 rounded-full ${baseSkeletonClass}`}></div>
          </div>
        </div>
        
        {/* Action Buttons Skeleton */}
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-10 w-28 rounded-lg ${baseSkeletonClass}`}
            ></div>
          ))}
        </div>
      </div>

      {/* Data Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Students / Enrollment Hero Card Skeleton (col-span-2) */}
        <div className="col-span-1 md:col-span-2 rounded-ds-lg bg-white dark:bg-slate-800 p-6 flex flex-col justify-center shadow-ds-card">
          <div className="flex justify-between items-end mb-2">
            <div className="flex-1">
              {/* Icon and Label Row */}
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-5 w-5 rounded-md ${baseSkeletonClass}`}></div>
                <div className={`h-4 w-32 ${baseSkeletonClass}`}></div>
              </div>
              {/* Value Row */}
              <div className="flex items-baseline gap-2 mt-1">
                <div className={`h-9 w-16 ${baseSkeletonClass}`}></div>
                <div className={`h-5 w-24 ${baseSkeletonClass}`}></div>
              </div>
            </div>
            {/* Percentage Badge Skeleton */}
            <div className={`h-7 w-20 rounded-full ${baseSkeletonClass}`}></div>
          </div>
          {/* Progress Bar Skeleton */}
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 mt-3 overflow-hidden">
            <div className={`h-3 rounded-full w-3/4 ${baseSkeletonClass}`}></div>
          </div>
        </div>

        {/* StatBadge Cards Skeleton - Show 6 cards to match potential maximum */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-ds-lg bg-white dark:bg-slate-800 p-4 shadow-ds-card"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* Icon Container Skeleton */}
                <div className={`h-5 w-5 rounded-md ${baseSkeletonClass}`}></div>
                {/* Label Skeleton */}
                <div className={`h-4 w-20 ${baseSkeletonClass}`}></div>
              </div>
            </div>
            {/* Value Skeleton */}
            <div className={`h-8 w-16 mb-1 ${baseSkeletonClass}`}></div>
            {/* Subtext Skeleton */}
            <div className={`h-3 w-32 ${baseSkeletonClass}`}></div>
          </div>
        ))}
      </div>
    </section>
  );
}

