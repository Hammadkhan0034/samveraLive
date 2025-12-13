import type { ComponentType } from 'react';
import type { enText, isText } from '@/lib/translations';

export interface KPICard {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export interface TeacherDashboardContentProps {
  t: typeof enText | typeof isText;
  kpis: KPICard[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export interface TeacherMetrics {
  classesCount: number;
  studentsCount: number;
  attendanceCount: number;
}

