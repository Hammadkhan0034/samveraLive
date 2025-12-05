'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { Menu, Users, School, ChartBar as BarChart3, Utensils, AlertCircle } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useRouter } from 'next/navigation';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import KPICardSkeleton from '@/app/components/loading-skeletons/KPICardSkeleton';
import type { KPICard } from '@/lib/types/dashboard';
import { useAuth } from '@/lib/hooks/useAuth';
import ContactCards, { type Contact } from '@/app/components/ContactCards';

interface PrincipalDashboardContentProps {
  t: any;
  kpis: KPICard[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function PrincipalDashboardContent({
  t,
  kpis,
  isLoading = false,
  error = null,
  onRetry,
}: PrincipalDashboardContentProps) {
  const { sidebarRef } = usePrincipalPageLayout();
  const router = useRouter();

  return (
    <>
      {/* Content Header */}
      <div className="mb-ds-md flex flex-col gap-ds-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-ds-md">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-ds-h1 font-bold tracking-tight text-ds-text-primary dark:text-slate-100">
            {t.title || 'Principal Dashboard'}
          </h1>
        </div>
        <div className="flex items-center gap-ds-md">
          <ProfileSwitcher />
        </div>
      </div>
      {/* Error Message */}
      {error && (
        <div className="mb-ds-sm rounded-ds-md border border-red-200 bg-red-50 p-ds-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-ds-md">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-ds-md bg-red-100 px-3 py-1.5 text-ds-small font-medium text-red-700 hover:bg-red-200 transition-colors dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800/70"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPIs Section */}
      <section className="mb-ds-lg">
        {isLoading ? (
          <KPICardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon }, i) => {
              // Cycle through tinted backgrounds: pale-blue, pale-yellow, pale-peach, pale-green
              const bgColors = [
                'bg-pale-blue dark:bg-slate-800',
                'bg-pale-yellow dark:bg-slate-800',
                'bg-pale-peach dark:bg-slate-800',
                'bg-pale-green dark:bg-slate-800',
              ];
              const bgColor = bgColors[i % 4];

              return (
                <div
                  key={i}
                  className={`rounded-ds-lg ${bgColor} p-ds-md shadow-ds-card`}
                >
                  <div className="text-ds-small text-ds-text-secondary dark:text-slate-400 mb-2">{label}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">{value}</div>
                    <span className="rounded-ds-md bg-white/50 dark:bg-slate-700/50 p-2">
                      <Icon className="h-5 w-5 text-ds-text-primary dark:text-slate-300" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ContactCards
        contacts={[
          {
            id: '1',
            name: 'Mária Jónsdóttir',
            phone: '777-1334',
            email: 'maria@domain.is',
            address: 'Jhress: JJohanna 9',
            gender: 'Female',
            status: 'Active',
            imageUrl: undefined,
            onCall: () => {
              // Handle call action
              console.log('Call Mária Jónsdóttir');
            },
            onMessage: () => {
              // Handle message action
              console.log('Message Mária Jónsdóttir');
            },
            onViewProfile: () => {
              // Handle view profile action
              console.log('View profile Mária Jónsdóttir');
            },
          },
          {
            id: '2',
            name: 'Ólafur Björnsson',
            phone: '661-9988',
            email: 'olafur@domain.is',
            address: 'Reykjavík, Iceland',
            gender: 'Male',
            status: 'Active',
            imageUrl: undefined,
            onCall: () => {
              // Handle call action
              console.log('Call Ólafur Björnsson');
            },
            onMessage: () => {
              // Handle message action
              console.log('Message Ólafur Björnsson');
            },
            onViewProfile: () => {
              // Handle view profile action
              console.log('View profile Ólafur Björnsson');
            },
          },
        ]}
      />
    </>
  );
}

function PrincipalDashboardPageContent() {
  const { t } = useLanguage();
  const { session } = useAuth?.() || {} as any;


  // KPI data states - simplified initialization
  const [studentsCount, setStudentsCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [menusCount, setMenusCount] = useState(0);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Single consolidated function to fetch all metrics
  const fetchMetrics = useCallback(async (signal: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);

      // API gets all data from authenticated session, no query params needed
      const res = await fetch(`/api/principal-dashboard-metrics?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
        credentials: 'include',
      });

      if (signal.aborted) {
        return;
      }

      if (!res.ok) {
        // Try to parse as JSON first, fallback to text
        let errorMessage = `HTTP ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, try text
          try {
            const errorText = await res.text();
            errorMessage = errorText || errorMessage;
          } catch {
            // Use default error message
          }
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (signal.aborted) {
        return;
      }

      // Update all state variables from the response
      setStudentsCount(data.studentsCount || 0);
      setStaffCount(data.staffCount || 0);
      setClassesCount(data.classesCount || 0);
      setMenusCount(data.menusCount || 0);
    } catch (err: unknown) {
      if (signal.aborted) {
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Failed to load dashboard metrics. Please try again.';
      setError(message);
      console.error('Error loading metrics:', err);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Main effect: Load metrics on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    void fetchMetrics(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [session?.user?.id, fetchMetrics]);

  // Retry function
  const handleRetry = useCallback(() => {
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    void fetchMetrics(abortController.signal);
  }, [fetchMetrics]);

  // Stable icon references
  const icons = useMemo(() => ({
    Users,
    School,
    BarChart3,
    Utensils,
  }), []);

  // Memoize KPIs array with stable references
  const kpis = useMemo<KPICard[]>(() => [
    {
      label: t.kpi_students || 'Students',
      value: studentsCount,
      icon: icons.Users,
    },
    {
      label: t.kpi_staff || 'Staff',
      value: staffCount,
      icon: icons.School,
    },
    {
      label: t.kpi_classes || 'Classes',
      value: classesCount,
      icon: icons.BarChart3,
    },
    {
      label: t.kpi_menus || 'Menus',
      value: menusCount,
      icon: icons.Utensils,
    },
  ], [t, studentsCount, staffCount, classesCount, menusCount, icons]);

  return (
    <PrincipalPageLayout>
      <PrincipalDashboardContent 
        t={t} 
        kpis={kpis} 
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
      />
    </PrincipalPageLayout>
  );
}

export default function PrincipalDashboardPage() {
  return (
    <Suspense fallback={
      <PrincipalPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <KPICardSkeleton count={4} />
        </div>
      </PrincipalPageLayout>
    }>
      <PrincipalDashboardPageContent />
    </Suspense>
  );
}
