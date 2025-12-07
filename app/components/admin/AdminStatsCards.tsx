'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  GraduationCap,
  BookOpen,
  Activity,
  UserPlus,
} from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

interface AdminStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalParents: number;
  activeUsers: number;
  newRegistrations: number;
}

interface AdminStatsCardsProps {
  stats: AdminStats;
}

export function AdminStatsCards({ stats }: AdminStatsCardsProps) {
  const { t } = useLanguage();

  // Tinted backgrounds for stat cards
  const statCardBgColors = [
    'bg-pale-blue dark:bg-slate-800',
    'bg-pale-yellow dark:bg-slate-800',
    'bg-pale-peach dark:bg-slate-800',
    'bg-mint-100 dark:bg-slate-800',
  ];

  const StatCard = ({ title, value, icon: Icon, trend, onClick, index = 0 }: {
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    color: string;
    trend?: string;
    onClick?: () => void;
    index?: number;
  }) => {
    const bgColor = statCardBgColors[index % statCardBgColors.length];
    return (
      <div
        className={`rounded-ds-lg p-2 sm:p-3 lg:p-ds-md shadow-ds-card h-24 sm:h-28 lg:h-36 ${bgColor} ${onClick ? 'cursor-pointer hover:shadow-ds-lg transition-all duration-200' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : -1}
      >
        <div className="flex items-start justify-between h-full">
          <div className="flex-1 min-w-0">
            <p className="text-ds-tiny sm:text-ds-small font-medium text-slate-600 dark:text-slate-400 mb-0.5 sm:mb-1 truncate">{title}</p>
            <p className="text-lg sm:text-xl lg:text-ds-h2 font-bold text-slate-900 dark:text-slate-100 mb-0.5 sm:mb-1">{value.toLocaleString()}</p>
            <div className="h-3 sm:h-4">
              {trend && (
                <p className="text-ds-tiny text-mint-600 dark:text-green-400 truncate">{trend}</p>
              )}
            </div>
          </div>
          <div className="rounded-ds-md bg-white/50 dark:bg-slate-700 p-1.5 sm:p-2 lg:p-3 flex-shrink-0">
            <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-slate-700 dark:text-slate-300" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0 }}
      className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-ds-md mb-4 sm:mb-6 lg:mb-ds-lg"
    >
      <StatCard
        title={t.totalUsers}
        value={stats.totalUsers}
        icon={Users}
        color="bg-blue-500"
        trend={`+12% ${t.thisMonth}`}
        index={0}
      />
      <StatCard
        title={t.teachers}
        value={stats.totalTeachers}
        icon={GraduationCap}
        color="bg-green-500"
        index={1}
      />
      <StatCard
        title={t.students}
        value={stats.totalStudents ?? 0}
        icon={BookOpen}
        color="bg-purple-500"
        index={2}
      />
      <StatCard
        title={t.parents}
        value={stats.totalParents}
        icon={Users}
        color="bg-orange-500"
        index={3}
      />
      <StatCard
        title={t.activeUsers}
        value={stats.activeUsers}
        icon={Activity}
        color="bg-emerald-500"
        trend={`+8% ${t.thisWeek}`}
        index={0}
      />
      <StatCard
        title={t.newThisWeek}
        value={stats.newRegistrations}
        icon={UserPlus}
        color="bg-pink-500"
        index={1}
      />
    </motion.div>
  );
}
