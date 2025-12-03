'use client';

import { useState, useMemo } from 'react';
import { Users, School, ChartBar as BarChart3, Utensils } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import AnnouncementList from './AnnouncementList';
import { useRouter } from 'next/navigation';
import StoryColumn from './shared/StoryColumn';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export default function PrincipalDashboard() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  
  const [classesCount, setClassesCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('classes_count_cache');
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
 

  // KPI data states (simplified for counts only) - initialize from cache
  const [studentsCount, setStudentsCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('students_count_cache');
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [staffCount, setStaffCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('staff_count_cache');
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });
  const [menusCount, setMenusCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('menus_count_cache');
      return cached ? parseInt(cached) : 0;
    }
    return 0;
  });

  // Counts are initialized lazily from localStorage above, so no effect is needed here.

  // Memoize activity items to ensure they update when language changes
  const activityItems = useMemo(
    () => [
      t.act_added_class.replace('{name}', 'Rauðkjarni'),
      t.act_invited.replace('{name}', 'Margrét Jónsdóttir'),
      t.act_visibility_off.replace('{name}', 'Rauðkjarni'),
      t.act_export,
    ],
    [t],
  );

  // Memoize KPIs to ensure they update when language changes
  const kpis = useMemo(
    () => [
      {
        label: t.kpi_students,
        value: studentsCount,
        icon: Users,
        onClick: () => router.push('/dashboard/principal/students'),
      },
      {
        label: t.kpi_staff,
        value: staffCount,
        icon: School,
        onClick: () => router.push('/dashboard/principal/staff'),
      },
      {
        label: t.kpi_classes,
        value: classesCount,
        icon: BarChart3,
        onClick: () => router.push('/dashboard/principal/classes'),
      },
      {
        label: t.kpi_menus,
        value: menusCount,
        icon: Utensils,
        onClick: () => router.push('/dashboard/menus-list'),
      },
    ],
    [t, studentsCount, staffCount, classesCount, menusCount, router],
  );




  return (
    <main className="mx-auto max-w-7xl px-4 py-ds-lg md:px-6">
      {/* Header */}
      <div className="mb-ds-md mt-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">{t.subtitle}</p>
        </div>

        {/* Profile switcher + actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center justify-end">
            <ProfileSwitcher /> {/* ← shows only if user has multiple roles */}
          </div>
        </div>
      </div>

      {/* Stories Column */}
      <StoryColumn
        lang={lang}
        userRole="principal"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, onClick }, i) => {
          // Cycle through tinted backgrounds: pale-blue, pale-yellow, pale-peach
          const bgColors = [
            'bg-pale-blue dark:bg-slate-800',
            'bg-pale-yellow dark:bg-slate-800',
            'bg-pale-peach dark:bg-slate-800',
          ];
          const bgColor = bgColors[i % 3];

          return (
            <div
              key={i}
              className={`rounded-ds-lg p-ds-md shadow-ds-card ${bgColor} ${
                onClick !== undefined
                  ? 'cursor-pointer transition-all duration-200 hover:shadow-ds-lg'
                  : ''
              }`}
              onClick={onClick}
            >
              <div className="flex items-center justify-between">
                <div className="text-ds-small text-slate-600 dark:text-slate-400">{label}</div>
                <span className="rounded-ds-md bg-white/50 p-2 dark:bg-slate-700">
                  <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                </span>
              </div>
              <div className="mt-3 text-ds-h2 font-semibold text-slate-900 dark:text-slate-100">
                {value}
              </div>
            </div>
          );
        })}
      </div>

      {/* School Announcements Section */}
      <div className="mt-ds-md">
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          <div className="mb-4">
            <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">{t.announcements_list}</h3>
          </div>
      <AnnouncementList
        userRole="principal"
        showAuthor={true}
        limit={5}
        lang={lang}
      />
        </div>
      </div>

      {/* Activity feed */}
      <div className="mt-ds-md grid grid-cols-1 gap-ds-md lg:grid-cols-2">
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">{t.recent_activity}</h3>
          <ul className="mt-3 space-y-3 text-ds-small">
            {activityItems.map((txt, i) => (
              <li key={i} className="rounded-ds-md bg-mint-100 dark:bg-slate-700 p-3 text-slate-700 dark:text-slate-300">
                {txt}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          <h3 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">{t.quick_tips}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ds-small text-slate-700 dark:text-slate-300">
            <li>{t.tip_roles}</li>
            <li>{t.tip_visibility}</li>
            <li>{t.tip_exports}</li>
          </ul>
        </div>
      </div>


    </main>
  );
}
