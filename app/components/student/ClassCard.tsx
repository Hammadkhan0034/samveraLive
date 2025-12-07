import React from 'react';
import { School, Calendar, User } from 'lucide-react';
import { Card } from '@/app/components/ui';

interface ClassCreator {
  first_name?: string;
  last_name?: string | null;
}

interface ClassData {
  id: string;
  name: string;
  code?: string | null;
  created_by?: string | null;
  created_at?: string;
  users?: ClassCreator | null;
}

interface ClassCardProps {
  classData: ClassData | null | undefined;
  className?: string;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getCreatorName(creator: ClassCreator | null | undefined): string {
  if (!creator) return 'Unknown';
  if (!creator.last_name) return creator.first_name || 'Unknown';
  return `${creator.first_name} ${creator.last_name}`;
}

export function ClassCard({ classData, className = '' }: ClassCardProps) {
  if (!classData) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-3">
          <School className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          <div>
            <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Class Information
            </h2>
            <p className="text-ds-small text-slate-500 dark:text-slate-400">No class assigned</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-start gap-3 mb-ds-md">
        <div className="p-2 rounded-ds-md bg-mint-100 dark:bg-mint-900/30 text-mint-600 dark:text-mint-400">
          <School className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {classData.name}
          </h2>
          {classData.code && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-ds-small text-slate-600 dark:text-slate-400">
                Code: <span className="font-medium">{classData.code}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-ds-md">
        {classData.users && (
          <div className="flex items-center gap-2 text-ds-small text-slate-600 dark:text-slate-400">
            <User className="h-4 w-4 text-mint-600 dark:text-mint-400" />
            <span>
              Created by: <span className="font-medium">{getCreatorName(classData.users)}</span>
            </span>
          </div>
        )}
        {classData.created_at && (
          <div className="flex items-center gap-2 text-ds-small text-slate-600 dark:text-slate-400">
            <Calendar className="h-4 w-4 text-mint-600 dark:text-mint-400" />
            <span>
              Created: <span className="font-medium">{formatDate(classData.created_at)}</span>
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
