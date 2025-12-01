'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import type { HealthLogWithRelations } from '@/lib/types/health-logs';

type Lang = 'is' | 'en';

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
  if (typeof window === 'undefined') return '';
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

export default function ParentDiapersPage() {
  const { lang, t } = useLanguage();
  const { user, loading, isSigningIn } = useRequireAuth();
  const { session } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const guardianId = user?.id;

  const [healthLogs, setHealthLogs] = useState<HealthLogWithRelations[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);
  const [selectedFilterType, setSelectedFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Load linked students
  useEffect(() => {
    async function loadLinkedStudents() {
      if (!guardianId) {
        return;
      }

      try {
        const response = await fetch(`/api/guardian-students?guardianId=${guardianId}`);
        
        if (response.ok) {
          const data = await response.json();
          const relationships = data.relationships || [];
          const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
          setLinkedStudentIds(studentIds);
        }
      } catch (error) {
        console.error('Error loading linked students:', error);
      }
    }

    loadLinkedStudents();
  }, [guardianId]);

  // Load health logs data
  useEffect(() => {
    async function loadHealthLogs() {
      if (!orgId || linkedStudentIds.length === 0) {
        setHealthLogs([]);
        return;
      }

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
          // Filter to only show logs for linked students
          const filteredLogs = data.healthLogs.filter((log: HealthLogWithRelations) => 
            log.student_id && linkedStudentIds.includes(log.student_id)
          );
          // Sort by recorded_at descending (most recent first)
          filteredLogs.sort((a: HealthLogWithRelations, b: HealthLogWithRelations) => {
            const dateA = new Date(a.recorded_at || 0).getTime();
            const dateB = new Date(b.recorded_at || 0).getTime();
            return dateB - dateA;
          });
          setHealthLogs(filteredLogs);
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
  }, [orgId, linkedStudentIds, selectedFilterType]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(healthLogs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = healthLogs.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilterType]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-mint-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="mb-6 mt-14">
            <div className="h-10 w-20 animate-pulse bg-mint-200 dark:bg-slate-700 rounded-ds-md"></div>
          </div>
          <LoadingSkeleton type="table" rows={10} />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-mint-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 ml-20">
        {/* Header with Back button and Filter */}
        <div className="mb-ds-md flex items-center gap-ds-sm flex-wrap mt-14">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {t.back || 'Back'}
          </button>
          <h1 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.di_title || 'Diapers & Health Log'}
          </h1>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={selectedFilterType}
              onChange={(e) => {
                setSelectedFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-ds-md border border-slate-300 bg-white px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="all">{lang === 'is' ? 'Allt' : 'All'}</option>
              {Object.entries(HEALTH_LOG_TYPE_LABELS).map(([type, labels]) => (
                <option key={type} value={type}>
                  {lang === 'is' ? labels.is : labels.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            <strong>{t.error || 'Error'}:</strong> {error}
          </div>
        )}

        {/* Debug Info - Show when no data and not loading */}
        {!loadingLogs && healthLogs.length === 0 && !error && linkedStudentIds.length === 0 && (
          <div className="mb-4 rounded-ds-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-ds-small text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
            {t.no_linked_students || 'No students linked to your account. Please contact the school administrator.'}
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
              {linkedStudentIds.length > 0 && (
                <p className="text-ds-small text-slate-500 dark:text-slate-500">
                  {lang === 'is'
                    ? 'Engar heilsuskráningar fundust fyrir tengda nemendur.'
                    : 'No health logs found for your linked students.'}
                </p>
              )}
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
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 disabled:cursor-not-allowed hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {t.prev || 'Prev'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
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
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
      </main>
    </div>
  );
}

