'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Calendar, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import GuardianPageLayout, { useGuardianPageLayout } from '@/app/components/shared/GuardianPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import EmptyState from '@/app/components/EmptyState';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  notes?: string | null;
  students?: {
    id: string;
    users?: {
      first_name: string;
      last_name: string;
    };
    classes?: {
      name: string;
    };
  };
}

// Helper functions outside component
function getStatusLabel(status: string, t: any): string {
  switch (status) {
    case 'absent':
      return t.attendance_absent || 'Absent';
    case 'late':
      return t.attendance_late || 'Late';
    case 'excused':
      return t.attendance_excused || 'Excused';
    default:
      return t.attendance_not_recorded || 'Not Recorded';
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'absent':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'late':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'excused':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  }
}

function formatDate(dateString: string, lang: 'is' | 'en'): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function GuardianAttendanceContent() {
  const { lang, t } = useLanguage();
  const { sidebarRef } = useGuardianPageLayout();
  const { user } = useAuth();

  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const guardianId = user?.id;

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
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
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to load linked students:', response.status, errorData);
        }
      } catch (error) {
        console.error('Error loading linked students:', error);
      }
    }

    loadLinkedStudents();
  }, [guardianId]);

  // Load attendance data
  useEffect(() => {
    async function loadAttendance() {
      if (!orgId) {
        setAttendance([]);
        return;
      }

      if (linkedStudentIds.length === 0) {
        setAttendance([]);
        return;
      }

      setLoadingAttendance(true);
      setError(null);

      try {
        // Fetch attendance for all linked students
        const attendancePromises = linkedStudentIds.map(async (studentId) => {
          try {
            const url = `/api/attendance?orgId=${orgId}&studentId=${studentId}${selectedDate ? `&date=${selectedDate}` : ''}&t=${Date.now()}`;
            const response = await fetch(url, { cache: 'no-store' });
            
            if (response.ok) {
              const data = await response.json();
              
              // Validate data structure
              if (data.attendance && Array.isArray(data.attendance)) {
                return data.attendance;
              } else {
                return [];
              }
            } else {
              return [];
            }
          } catch (error) {
            console.error(`Error fetching attendance for student ${studentId}:`, error);
            return [];
          }
        });

        const results = await Promise.all(attendancePromises);

        // Flatten and sort by date (most recent first)
        const allAttendance = results.flat().sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });

        setAttendance(allAttendance);
      } catch (error: any) {
        console.error('Error loading attendance:', error);
        setError(error.message || 'Failed to load attendance data');
        setAttendance([]);
      } finally {
        setLoadingAttendance(false);
      }
    }

    loadAttendance();
  }, [orgId, linkedStudentIds, selectedDate]);

  // Reset to page 1 when date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  // Memoized pagination calculations
  const { totalPages, paginatedAttendance } = useMemo(() => {
    const total = Math.max(1, Math.ceil(attendance.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = attendance.slice(startIndex, endIndex);
    return { totalPages: total, paginatedAttendance: paginated };
  }, [attendance, currentPage, itemsPerPage]);

  // Date filter handlers
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleClearFilter = useCallback(() => {
    setSelectedDate('');
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
        title={t.attendance || 'Attendance'}
        subtitle={t.attendance_desc || 'View attendance records for your children'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-mint-600 dark:text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
            {selectedDate && (
              <button
                onClick={handleClearFilter}
                className="rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 whitespace-nowrap"
              >
                {t.clear_filter || 'Clear Filter'}
              </button>
            )}
          </div>
        }
      />

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <strong>{t.error || 'Error'}:</strong> {error}
        </div>
      )}

      {/* No linked students message */}
      {!loadingAttendance && attendance.length === 0 && !error && linkedStudentIds.length === 0 && (
        <div className="mb-4 rounded-ds-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-ds-small text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
          {t.no_linked_students || 'No students linked to your account. Please contact the school administrator.'}
        </div>
      )}

      {/* Attendance Table */}
      <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        {loadingAttendance ? (
          <LoadingSkeleton type="table" rows={10} className="border-0 p-0" />
        ) : attendance.length === 0 ? (
          <EmptyState
            lang={lang}
            icon={UserCheck}
            title={t.no_attendance_data_title || 'No Attendance Data'}
            description={
              selectedDate
                ? (t.no_attendance_filtered_description || 'Try selecting a different date or clear the date filter to see all records.')
                : (t.no_attendance_data_description || 'No attendance records found for your linked students.')
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-ds-md">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-mint-500 sticky top-0 z-10">
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-md">
                      {t.col_date || 'Date'}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                      {t.col_student_name || 'Student Name'}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                      {t.col_class || 'Class'}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-md">
                      {t.col_status || 'Status'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttendance.map((record) => {
                    // Validate record structure
                    if (!record || !record.id || !record.date || !record.status) {
                      return null;
                    }

                    const studentName = record.students?.users
                      ? `${record.students.users.first_name || ''} ${record.students.users.last_name || ''}`.trim() || (t.unknown_student || 'Unknown Student')
                      : (t.unknown_student || 'Unknown Student');
                    const className = record.students?.classes?.name || t.no_class || 'No Class';

                    return (
                      <tr key={record.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="text-left py-2 px-4 text-ds-small text-slate-900 dark:text-slate-100">
                          {formatDate(record.date, lang)}
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small text-slate-900 dark:text-slate-100">
                          {studentName}
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                          {className}
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-ds-full text-ds-tiny font-medium ${getStatusBadgeClass(record.status)}`}>
                            {getStatusLabel(record.status, t)}
                          </span>
                        </td>
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
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
                          ? 'bg-mint-500 text-white border border-mint-500'
                          : 'border border-slate-400 hover:bg-mint-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
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

function GuardianAttendancePageContent() {
  return (
    <GuardianPageLayout>
      <GuardianAttendanceContent />
    </GuardianPageLayout>
  );
}

export default function GuardianAttendancePage() {
  return (
    <Suspense fallback={
      <GuardianPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSkeleton type="table" rows={10} />
        </div>
      </GuardianPageLayout>
    }>
      <GuardianAttendancePageContent />
    </Suspense>
  );
}
