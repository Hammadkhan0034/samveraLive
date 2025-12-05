'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import GuardianPageLayout, { useGuardianPageLayout } from '@/app/components/shared/GuardianPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import type { HealthLogWithRelations } from '@/lib/types/health-logs';

const HEALTH_LOG_TYPE_LABELS: Record<string, { en: string; is: string }> = {
  diaper_wet: { en: 'Diaper - Wet', is: 'Bleyja - Vot' },
  diaper_dirty: { en: 'Diaper - Dirty', is: 'Bleyja - Skítug' },
  diaper_mixed: { en: 'Diaper - Mixed', is: 'Bleyja - Blanda' },
  temperature: { en: 'Temperature', is: 'Hitastig' },
  medication: { en: 'Medication', is: 'Lyf' },
  nap: { en: 'Nap', is: 'Svefn' },
  symptom: { en: 'Symptom', is: 'Einkenni' },
  injury: { en: 'Injury', is: 'Meiðsli' },
  meal: { en: 'Meal', is: 'Máltíð' },
  other: { en: 'Other', is: 'Annað' },
};

function formatHealthLogDate(dateString: string | undefined, lang: 'is' | 'en'): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const locale = lang === 'is' ? 'is-IS' : 'en-US';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStudentName(log: HealthLogWithRelations): string {
  const student = log.students;
  if (!student) return 'Unknown Student';
  const firstName = student.users?.first_name || student.first_name || '';
  const lastName = student.users?.last_name || student.last_name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown Student';
}

function GuardianDiapersContent() {
  const { lang, t } = useLanguage();
  const { sidebarRef } = useGuardianPageLayout();

  const [healthLogs, setHealthLogs] = useState<HealthLogWithRelations[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilterType, setSelectedFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load health logs data
  useEffect(() => {
    async function loadHealthLogs() {
      setLoadingLogs(true);
      setError(null);

      try {
        // Build URL with type filter if provided and not 'all'
        const url = selectedFilterType && selectedFilterType !== 'all'
          ? `/api/health-logs?type=${encodeURIComponent(selectedFilterType)}&t=${Date.now()}`
          : `/api/health-logs?t=${Date.now()}`;
        
        const response = await fetch(url, { cache: 'no-store' });
        const data = await response.json();
        
        if (response.ok && data.healthLogs) {
          // Sort by recorded_at descending (most recent first)
          const sortedLogs = [...data.healthLogs].sort((a: HealthLogWithRelations, b: HealthLogWithRelations) => {
            const dateA = new Date(a.recorded_at || 0).getTime();
            const dateB = new Date(b.recorded_at || 0).getTime();
            return dateB - dateA;
          });
          setHealthLogs(sortedLogs);
        } else {
          setError(data.error || 'Failed to load health logs');
          setHealthLogs([]);
        }
      } catch (error: any) {
        console.error('Error loading health logs:', error);
        setError('Failed to load health logs');
        setHealthLogs([]);
      } finally {
        setLoadingLogs(false);
      }
    }

    loadHealthLogs();
  }, [selectedFilterType]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilterType]);

  // Memoized pagination calculations
  const { totalPages, paginatedLogs } = useMemo(() => {
    const total = Math.max(1, Math.ceil(healthLogs.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = healthLogs.slice(startIndex, endIndex);
    return { totalPages: total, paginatedLogs: paginated };
  }, [healthLogs, currentPage, itemsPerPage]);

  // Filter change handler
  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFilterType(e.target.value);
    setCurrentPage(1);
  }, []);

  // Pagination handlers
  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const handlePageClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return (
    <>
      <PageHeader
        title={t.di_title || 'Diapers & Health Log'}
        subtitle={t.di_hint || 'View health logs for your children'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <select
            value={selectedFilterType}
            onChange={handleFilterChange}
            className="rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="all">{lang === 'is' ? 'Allt' : 'All'}</option>
            {Object.entries(HEALTH_LOG_TYPE_LABELS).map(([type, labels]) => (
              <option key={type} value={type}>
                {lang === 'is' ? labels.is : labels.en}
              </option>
            ))}
          </select>
        }
      />

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <strong>{t.error || 'Error'}:</strong> {error}
        </div>
      )}

      {/* Health Logs Table */}
      <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        {loadingLogs ? (
          <LoadingSkeleton type="table" rows={10} className="border-0 p-0" />
        ) : healthLogs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              {selectedFilterType === 'all'
                ? (lang === 'is'
                    ? 'Engar heilsuskráningar fundust.'
                    : 'No health logs found.')
                : (lang === 'is'
                    ? 'Engar heilsuskráningar fundust fyrir valda gerð.'
                    : 'No health logs found for the selected type.')}
            </p>
            <p className="text-ds-small text-slate-500 dark:text-slate-500">
              {lang === 'is'
                ? 'Engar heilsuskráningar fundust fyrir tengda nemendur.'
                : 'No health logs found for your linked students.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-ds-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-mint-500 sticky top-0 z-10">
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-lg">
                      {lang === 'is' ? 'Dagsetning/Tími' : 'Date/Time'}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                      {t.child || 'Child'}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                      {t.di_type || 'Type'}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-lg">
                      {t.notes || 'Notes'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => {
                    return (
                      <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="text-left py-2 px-4 text-ds-small text-slate-900 dark:text-slate-100">
                          <span suppressHydrationWarning>
                            {formatHealthLogDate(log.recorded_at, lang)}
                          </span>
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small text-slate-900 dark:text-slate-100">
                          {getStudentName(log)}
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                          {HEALTH_LOG_TYPE_LABELS[log.type]?.[lang] || log.type}
                          {log.temperature_celsius && (
                            <span className="ml-2 text-ds-tiny text-slate-500 dark:text-slate-400">
                              ({log.temperature_celsius}°C)
                            </span>
                          )}
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                          {log.notes ? (
                            <span className="line-clamp-2" title={log.notes}>
                              {log.notes}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {healthLogs.length >= 1 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 disabled:cursor-not-allowed hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {t.prev || 'Prev'}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page)}
                      className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${
                        currentPage === page
                          ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                          : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200 hover:bg-mint-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 disabled:cursor-not-allowed hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {t.next || 'Next'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function GuardianDiapersPageContent() {
  return (
    <GuardianPageLayout>
      <GuardianDiapersContent />
    </GuardianPageLayout>
  );
}

export default function GuardianDiapersPage() {
  return (
    <Suspense fallback={
      <GuardianPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSkeleton type="table" rows={10} />
        </div>
      </GuardianPageLayout>
    }>
      <GuardianDiapersPageContent />
    </Suspense>
  );
}
