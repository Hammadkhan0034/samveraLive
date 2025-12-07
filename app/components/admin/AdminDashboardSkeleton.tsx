'use client';

import React from 'react';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

/**
 * Skeleton loading component for Admin Dashboard
 * Matches the structure of AdminDashboard layout
 */
export function AdminDashboardSkeleton() {
  const baseSkeletonClass = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded';

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 mt-4 sm:mt-6 lg:mt-10 px-3 sm:px-4">
      {/* Header Skeleton */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-2">
            <div className={`h-8 sm:h-9 lg:h-10 w-48 sm:w-64 ${baseSkeletonClass}`}></div>
            <div className={`h-4 w-64 sm:w-80 ${baseSkeletonClass}`}></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg ${baseSkeletonClass}`}></div>
            <div className="hidden sm:block space-y-1">
              <div className={`h-4 w-24 ${baseSkeletonClass}`}></div>
              <div className={`h-3 w-32 ${baseSkeletonClass}`}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-ds-md mb-4 sm:mb-6 lg:mb-ds-lg">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-ds-lg p-2 sm:p-3 lg:p-ds-md shadow-ds-card h-24 sm:h-28 lg:h-36 bg-white dark:bg-slate-800"
          >
            <div className="flex items-start justify-between h-full">
              <div className="flex-1 min-w-0 space-y-2">
                <div className={`h-3 sm:h-4 w-16 sm:w-20 ${baseSkeletonClass}`}></div>
                <div className={`h-6 sm:h-7 lg:h-8 w-12 sm:w-16 ${baseSkeletonClass}`}></div>
                <div className={`h-3 w-20 ${baseSkeletonClass}`}></div>
              </div>
              <div className={`h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 rounded-ds-md ${baseSkeletonClass}`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Organizations and Principals Sections Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-ds-md">
        <LoadingSkeleton type="table" rows={3} />
        <LoadingSkeleton type="table" rows={3} />
      </div>

      {/* System Status Skeleton */}
      <div className="mt-4 sm:mt-6 lg:mt-8">
        <div className="bg-white dark:bg-slate-800 rounded-ds-md p-3 sm:p-4 lg:p-ds-md shadow-ds-card border border-slate-200 dark:border-slate-700">
          <div className={`h-6 w-32 mb-3 sm:mb-4 ${baseSkeletonClass}`}></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-ds-md">
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-ds-md ${baseSkeletonClass}`}></div>
                <div className="min-w-0 space-y-1 flex-1">
                  <div className={`h-4 w-20 ${baseSkeletonClass}`}></div>
                  <div className={`h-3 w-16 ${baseSkeletonClass}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
