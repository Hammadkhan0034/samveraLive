'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

type Lang = 'is' | 'en';

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

export default function AttendancePage() {
  const { lang, t } = useLanguage();
  const { user, loading, isSigningIn } = useRequireAuth();
  const { session } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
        console.log('📋 [Attendance] No guardianId, skipping linked students load');
        return;
      }

      console.log('📋 [Attendance] Loading linked students for guardian:', guardianId);
      try {
        const response = await fetch(`/api/guardian-students?guardianId=${guardianId}`);
        console.log('📋 [Attendance] Guardian-students API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 [Attendance] Guardian-students API response data:', data);
          const relationships = data.relationships || [];
          const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);
          console.log('📋 [Attendance] Found linked student IDs:', studentIds);
          setLinkedStudentIds(studentIds);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ [Attendance] Failed to load linked students:', response.status, errorData);
        }
      } catch (error) {
        console.error('❌ [Attendance] Error loading linked students:', error);
      }
    }

    loadLinkedStudents();
  }, [guardianId]);

  // Load attendance data
  useEffect(() => {
    async function loadAttendance() {
      if (!orgId) {
        console.log('📋 [Attendance] No orgId, skipping attendance load');
        setAttendance([]);
        return;
      }

      if (linkedStudentIds.length === 0) {
        console.log('📋 [Attendance] No linked student IDs, skipping attendance load');
        setAttendance([]);
        return;
      }

      console.log('📋 [Attendance] Loading attendance data:', {
        orgId,
        studentCount: linkedStudentIds.length,
        studentIds: linkedStudentIds,
        selectedDate: selectedDate || 'all dates'
      });

      setLoadingAttendance(true);
      setError(null);

      try {
        // Fetch attendance for all linked students
        const attendancePromises = linkedStudentIds.map(async (studentId) => {
          try {
            const url = `/api/attendance?orgId=${orgId}&studentId=${studentId}${selectedDate ? `&date=${selectedDate}` : ''}&t=${Date.now()}`;
            console.log(`📋 [Attendance] Fetching for student ${studentId}:`, url);
            
            const response = await fetch(url, { cache: 'no-store' });
            console.log(`📋 [Attendance] Response for student ${studentId}:`, response.status, response.statusText);
            
            if (response.ok) {
              const data = await response.json();
              console.log(`📋 [Attendance] Data for student ${studentId}:`, {
                total: data.total,
                attendanceCount: data.attendance?.length || 0,
                sample: data.attendance?.[0] || null
              });
              
              // Validate data structure
              if (data.attendance && Array.isArray(data.attendance)) {
                return data.attendance;
              } else {
                console.warn(`⚠️ [Attendance] Invalid data structure for student ${studentId}:`, data);
                return [];
              }
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error(`❌ [Attendance] API error for student ${studentId}:`, response.status, errorData);
              return [];
            }
          } catch (error) {
            console.error(`❌ [Attendance] Error fetching attendance for student ${studentId}:`, error);
            return [];
          }
        });

        const results = await Promise.all(attendancePromises);
        console.log('📋 [Attendance] All API calls completed. Results:', {
          totalPromises: results.length,
          resultsLengths: results.map(r => r.length),
          totalRecords: results.reduce((sum, r) => sum + r.length, 0)
        });

        // Flatten and sort by date (most recent first)
        const allAttendance = results.flat().sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });

        console.log('📋 [Attendance] Final attendance array:', {
          totalRecords: allAttendance.length,
          sampleRecords: allAttendance.slice(0, 3),
          dateRange: allAttendance.length > 0 ? {
            earliest: allAttendance[allAttendance.length - 1]?.date,
            latest: allAttendance[0]?.date
          } : null
        });

        setAttendance(allAttendance);
      } catch (error: any) {
        console.error('❌ [Attendance] Error loading attendance:', error);
        setError(error.message || 'Failed to load attendance data');
        setAttendance([]);
      } finally {
        setLoadingAttendance(false);
        console.log('📋 [Attendance] Loading complete');
      }
    }

    loadAttendance();
  }, [orgId, linkedStudentIds, selectedDate]);

  // Pagination
  const totalPages = Math.ceil(attendance.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAttendance = attendance.slice(startIndex, endIndex);

  // Reset to page 1 when date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present':
        return t.attendance_present || 'Present';
      case 'absent':
        return t.attendance_absent || 'Absent';
      case 'late':
        return t.attendance_late || 'Late';
      case 'excused':
        return t.attendance_excused || 'Excused';
      default:
        return t.attendance_not_recorded || 'Not Recorded';
    }
  };

  // Get status badge color
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'absent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'excused':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              {t.loading || 'Loading...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 ml-20">
        {/* Header with Back button and Date filter */}
        <div className="mb-6 flex items-center gap-3 flex-wrap mt-14">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.attendance || 'Attendance'}
          </h1>
          <div className="flex items-center gap-2 ml-auto">
            <Calendar className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
            {selectedDate && (
              <button
                onClick={() => {
                  setSelectedDate('');
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 whitespace-nowrap"
              >
                {t.clear_filter || 'Clear Filter'}
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            <strong>{t.error || 'Error'}:</strong> {error}
          </div>
        )}

        {/* Debug Info - Show when no data and not loading */}
        {!loadingAttendance && attendance.length === 0 && !error && linkedStudentIds.length === 0 && (
          <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
            {t.no_linked_students || 'No students linked to your account. Please contact the school administrator.'}
          </div>
        )}

        {/* Attendance Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {loadingAttendance ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              {t.loading || 'Loading...'}
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400 mb-2">
                {t.no_attendance_data || 'No attendance data available'}
              </p>
              {selectedDate && (
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  {t.try_different_date || 'Try selecting a different date or clear the date filter to see all records.'}
                </p>
              )}
              {!selectedDate && linkedStudentIds.length > 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  {t.no_records_for_students || 'No attendance records found for your linked students.'}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                        {t.col_date || 'Date'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                        {t.col_student_name || 'Student Name'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                        {t.col_class || 'Class'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                        {t.col_status || 'Status'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {paginatedAttendance.map((record) => {
                      // Validate record structure
                      if (!record || !record.id || !record.date || !record.status) {
                        console.warn('⚠️ [Attendance] Invalid record structure:', record);
                        return null;
                      }

                      const studentName = record.students?.users
                        ? `${record.students.users.first_name || ''} ${record.students.users.last_name || ''}`.trim() || (t.unknown_student || 'Unknown Student')
                        : (t.unknown_student || 'Unknown Student');
                      const className = record.students?.classes?.name || t.no_class || 'No Class';

                      return (
                        <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                            {formatDate(record.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                            {studentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                            {className}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(record.status)}`}>
                              {getStatusLabel(record.status)}
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
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {t.prev || 'Prev'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${
                          currentPage === page
                            ? 'bg-white text-black border border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                            : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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

// Translations removed - using centralized translations from @/lib/translations

