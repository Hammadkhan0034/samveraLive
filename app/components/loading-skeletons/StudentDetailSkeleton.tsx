import React from 'react';
import { Card } from '@/app/components/ui';

export function StudentDetailSkeleton() {
  return (
    <div className="space-y-ds-md animate-pulse">
      {/* Header Skeleton */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-ds-md">
          <div className="flex items-center justify-center md:justify-start">
            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="md:col-span-2 space-y-3">
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
          </div>
        </div>
      </Card>

      {/* Info Card Skeleton */}
      <Card>
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-ds-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-ds-md">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </Card>

      {/* Class Card Skeleton */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-ds-md" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </Card>

      {/* Guardian List Skeleton */}
      <Card>
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-ds-md" />
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-ds-md bg-slate-50 dark:bg-slate-700/30">
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
