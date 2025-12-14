'use client';

import { useState, useMemo, useCallback, useEffect, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Phone, Mail, MessageSquare, Camera, Heart, X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import { useAttendance } from '@/lib/hooks/useAttendance';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { AttendanceFilters } from '@/app/components/attendance/AttendanceFilters';
import { AttendanceActions } from '@/app/components/attendance/AttendanceActions';
import { UnsavedChangesWarning } from '@/app/components/attendance/UnsavedChangesWarning';
import EmptyState from '@/app/components/EmptyState';
import { PhotoUploadModal } from '@/app/components/shared/PhotoUploadModal';
import { HealthLogFormModal } from '@/app/components/shared/HealthLogFormModal';
import StudentCard from '@/app/components/students/student_card';
import { getStudentName } from '@/lib/utils/studentUtils';
import type { Student } from '@/lib/types/attendance';

export default function AttendancePanel() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  // Data fetching hooks
  const { classes: teacherClasses, isLoading: loadingClasses } = useTeacherClasses();
  const { students, isLoading: loadingStudents } = useTeacherStudents(teacherClasses);
  const {
    attendance,
    savedAttendance,
    attendanceRecords,
    leftAt,
    savedLeftAt,
    isLoading: loadingAttendance,
    isSaving: isSavingAttendance,
    hasLoadedInitial,
    loadAttendance,
    saveAttendance,
    updateAttendance,
  } = useAttendance(students, teacherClasses);

  // Local state for class filter
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  
  // State for photo upload modal
  const [photoUploadModalOpen, setPhotoUploadModalOpen] = useState(false);
  const [selectedStudentForUpload, setSelectedStudentForUpload] = useState<Student | null>(null);

  // State for health log modal
  const [healthLogModalOpen, setHealthLogModalOpen] = useState(false);
  const [selectedStudentForHealthLog, setSelectedStudentForHealthLog] = useState<Student | null>(null);
  const [isSubmittingHealthLog, setIsSubmittingHealthLog] = useState(false);

  // State for student card modal
  const [studentCardModalOpen, setStudentCardModalOpen] = useState(false);
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);

  // Load attendance for today when students are available
  useEffect(() => {
    if (students.length > 0 && teacherClasses.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      loadAttendance(today);
    }
  }, [students.length, teacherClasses.length, loadAttendance]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return students.some((student) => {
      const currentStatus = attendance[student.id] || '';
      const savedStatus = savedAttendance[student.id] || '';
      const currentLeftAt = leftAt[student.id] ?? null;
      const savedLeftAtValue = savedLeftAt[student.id] ?? null;
      return currentStatus !== savedStatus || currentLeftAt !== savedLeftAtValue;
    });
  }, [attendance, savedAttendance, leftAt, savedLeftAt, students]);

  // Handle save attendance
  const handleSaveAttendance = useCallback(async () => {
    try {
      await saveAttendance(attendance, leftAt);
    } catch (error: any) {
      alert(error.message || t.error_saving_attendance);
    }
  }, [attendance, leftAt, saveAttendance, t]);

  // Handle status change
  const handleStatusChange = useCallback(
    (studentId: string, status: string) => {
      updateAttendance(studentId, status);
    },
    [updateAttendance]
  );

  // Aggregate loading state
  const isLoading =
    loadingClasses ||
    loadingStudents ||
    (loadingAttendance && students.length > 0 && teacherClasses.length > 0) ||
    (!hasLoadedInitial && students.length > 0 && teacherClasses.length > 0);

  // Filter students by selected class
  const filteredStudents = useMemo(() => {
    if (selectedClassId === 'all') {
      return students;
    }

    return students.filter((s) => {
      const studentClassId = s.class_id || (s as any).classes?.id || null;
      const normalizedStudentClassId = studentClassId ? String(studentClassId).trim() : null;
      const normalizedSelectedClassId = selectedClassId ? String(selectedClassId).trim() : null;
      return normalizedStudentClassId === normalizedSelectedClassId;
    });
  }, [students, selectedClassId]);

  // Handle class filter change
  const handleClassChange = useCallback((classId: string) => {
    setSelectedClassId(classId);
  }, []);

  // Get available status options based on current status and left_at
  const getAvailableOptions = useCallback((status: string, isGone: boolean): Array<{ value: string; label: string }> => {
    const currentStatus = status || '';
    
    // If student has left (left_at is set), show option to unmark as gone
    if (isGone) {
      return [
        { value: 'arrived', label: t.attendance_status_arrived },
        { value: 'gone', label: t.attendance_status_gone },
      ];
    }
    
    // If status is 'arrived' and not gone, show option to mark as gone
    if (currentStatus === 'arrived') {
      return [
        { value: 'arrived', label: t.attendance_status_arrived },
        { value: 'gone', label: t.attendance_mark_as_gone },
      ];
    }
    
    // Otherwise show the main status options
    return [
      { value: '', label: t.attendance_not_recorded },
      { value: 'arrived', label: t.attendance_status_arrived },
      { value: 'away_holiday', label: t.attendance_status_away_holiday },
      { value: 'away_sick', label: t.attendance_status_away_sick },
    ];
  }, [t]);

  // Handle student name click
  const handleStudentNameClick = useCallback((e: MouseEvent, student: Student) => {
    e.stopPropagation();
    setSelectedStudentForCard(student);
    setStudentCardModalOpen(true);
  }, []);

  // Handle student card modal close
  const handleStudentCardClose = useCallback(() => {
    setStudentCardModalOpen(false);
    setSelectedStudentForCard(null);
  }, []);

  // Handle photo upload button click
  const handleUploadImages = useCallback((e: MouseEvent, student: Student) => {
    e.stopPropagation();
    setSelectedStudentForUpload(student);
    setPhotoUploadModalOpen(true);
  }, []);

  // Handle photo upload modal close
  const handlePhotoUploadClose = useCallback(() => {
    setPhotoUploadModalOpen(false);
    setSelectedStudentForUpload(null);
  }, []);

  // Handle photo upload success
  const handlePhotoUploadSuccess = useCallback(() => {
    handlePhotoUploadClose();
  }, [handlePhotoUploadClose]);

  // Handle send message button click
  const handleSendMessage = useCallback((e: MouseEvent, guardianId: string) => {
    e.stopPropagation();
    router.push(`/dashboard/teacher/messages?recipientId=${encodeURIComponent(guardianId)}`);
  }, [router]);

  // Handle health log button click
  const handleHealthLogClick = useCallback((e: MouseEvent, student: Student) => {
    e.stopPropagation();
    setSelectedStudentForHealthLog(student);
    setHealthLogModalOpen(true);
  }, []);

  // Handle health log modal close
  const handleHealthLogClose = useCallback(() => {
    setHealthLogModalOpen(false);
    setSelectedStudentForHealthLog(null);
    setIsSubmittingHealthLog(false);
  }, []);

  // Handle health log form submission
  const handleHealthLogSubmit = useCallback(async (data: any) => {
    setIsSubmittingHealthLog(true);
    try {
      const url = '/api/health-logs';
      const payload = {
        student_id: data.student_id,
        type: data.type,
        recorded_at: data.recorded_at,
        temperature_celsius: data.temperature_celsius,
        notes: data.notes,
        severity: data.severity,
        data: data.data || {},
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMessage = json.error || 
          (t.failed_with_status ? t.failed_with_status.replace('{status}', String(res.status)) : `Failed with ${res.status}`);
        throw new Error(errorMessage);
      }

      // Success - close modal
      handleHealthLogClose();
    } catch (error) {
      console.error('Error submitting health log:', error);
      throw error; // Re-throw so modal can handle error display
    } finally {
      setIsSubmittingHealthLog(false);
    }
  }, [handleHealthLogClose]);

  return (
    <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
      {/* Title and Actions Row */}
      <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:gap-ds-sm sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
          {t['attendance_title'] || t['attendance'] || t['att_title']}
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-ds-sm">
          <AttendanceFilters
            classes={teacherClasses}
            selectedClassId={selectedClassId}
            onClassChange={handleClassChange}
            translations={t}
          />
          <AttendanceActions
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSavingAttendance}
            onSave={handleSaveAttendance}
            translations={t}
            disabled={isLoading}
          />
        </div>
      </div>

      {hasUnsavedChanges && !isSavingAttendance && (
        <UnsavedChangesWarning lang={lang} />
      )}

      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={selectedClassId === 'all' ? t.no_students_found_title : t.no_students_assigned}
          description={selectedClassId === 'all' ? t.no_students_found_description : t.no_students_assigned}
        />
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-ds-lg">
          <div className="min-w-[800px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-mint-500">
                  <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-lg">
                    {t.student_name}
                  </th>
                  <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300">
                    {t.guardians}
                  </th>
                  <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300">
                    {t.attendance_status}
                  </th>
                  <th className="text-left py-2 px-2 sm:px-4 text-ds-tiny sm:text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-lg">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const status = attendance[student.id] || '';
                  const record = attendanceRecords[student.id];
                  const studentLeftAt = leftAt[student.id] ?? record?.left_at ?? null;
                  const isGone = studentLeftAt !== null && studentLeftAt !== undefined;
                  const displayStatus = isGone ? 'gone' : status;
                  const options = getAvailableOptions(status, isGone);
                  const studentName = getStudentName(student);

                  // Get guardian info (use first guardian if available)
                  const guardian = student.guardians && student.guardians.length > 0 ? student.guardians[0] : null;
                  const hasGuardian = guardian !== null;
                  const guardianUser = guardian?.users as any;
                  const guardianPhone = hasGuardian ? (guardianUser?.phone || null) : null;
                  const guardianEmail = hasGuardian ? guardianUser?.email : null;
                  const guardianId = hasGuardian ? (guardianUser?.id || guardian?.guardian_id) : null;

                  // Get all guardian names
                  const guardianNames = student.guardians?.map((guardian) => {
                    const guardianFirstName = guardian.users?.first_name || '';
                    const guardianLastName = guardian.users?.last_name || '';
                    return `${guardianFirstName} ${guardianLastName}`.trim();
                  }).filter(name => name.length > 0) || [];

                  return (
                    <tr
                      key={student.id}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="py-2 px-2 sm:px-4">
                        <button
                          onClick={(e) => handleStudentNameClick(e, student)}
                          className="font-medium text-left hover:text-mint-600 dark:hover:text-mint-400 hover:underline transition-colors cursor-pointer focus:outline-none rounded px-1 -ml-1 text-ds-tiny text-ds-text-primary dark:text-slate-100"
                          type="button"
                        >
                          {studentName}
                        </button>
                      </td>
                      <td className="py-2 px-2 sm:px-4">
                        {guardianNames.length > 0 ? (
                          <div className="text-ds-tiny sm:text-ds-small text-slate-700 dark:text-slate-300">
                            {guardianNames.join(', ')}
                          </div>
                        ) : (
                          <div className="text-ds-tiny sm:text-ds-small text-slate-400 dark:text-slate-500 italic">
                            {t['no_guardians_assigned'] || t['no_guardian_attached'] || t['no_guardians']}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 sm:px-4">
                        <select
                          value={displayStatus || ''}
                          onChange={(e) => handleStatusChange(student.id, e.target.value)}
                          disabled={isSavingAttendance || isLoading}
                          className="w-auto min-w-[160px] max-w-[200px] rounded-ds-md border border-slate-300 dark:border-slate-600 px-2 sm:px-3 py-1.5 sm:py-2 text-ds-tiny sm:text-ds-small bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800"
                        >
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 sm:px-4">
                        <div className="flex items-center gap-1 sm:gap-2">
                          {/* Call Parent Button */}
                          {hasGuardian && guardianPhone ? (
                            <a
                              href={`tel:${guardianPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 sm:p-2 rounded-ds-md border border-mint-200 bg-mint-50 text-mint-600 hover:bg-mint-100 hover:border-mint-300 dark:border-mint-600 dark:bg-mint-900/20 dark:text-mint-300 dark:hover:bg-mint-900/40 transition-colors flex-shrink-0"
                              title={t.call_parent}
                              aria-label={t.call_parent}
                            >
                              <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </a>
                          ) : (
                            <button
                              disabled
                              className="p-1.5 sm:p-2 rounded-ds-md border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed flex-shrink-0"
                              title={hasGuardian ? t.no_phone_number : t.no_guardian_attached}
                              aria-label={hasGuardian ? t.no_phone_number : t.no_guardian_attached}
                            >
                              <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}

                          {/* Send Email Button */}
                          {hasGuardian && guardianEmail ? (
                            <a
                              href={`mailto:${guardianEmail}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 sm:p-2 rounded-ds-md border border-mint-200 bg-mint-50 text-mint-600 hover:bg-mint-100 hover:border-mint-300 dark:border-mint-600 dark:bg-mint-900/20 dark:text-mint-300 dark:hover:bg-mint-900/40 transition-colors flex-shrink-0"
                              title={t.send_email}
                              aria-label={t.send_email}
                            >
                              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </a>
                          ) : (
                            <button
                              disabled
                              className="p-1.5 sm:p-2 rounded-ds-md border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed flex-shrink-0"
                              title={hasGuardian ? t.no_email_address : t.no_guardian_attached}
                              aria-label={hasGuardian ? t.no_email_address : t.no_guardian_attached}
                            >
                              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}

                          {/* Send In-App Message Button */}
                          {hasGuardian && guardianId ? (
                            <button
                              onClick={(e) => handleSendMessage(e, guardianId)}
                              className="p-1.5 sm:p-2 rounded-ds-md border border-mint-200 bg-mint-50 text-mint-600 hover:bg-mint-100 hover:border-mint-300 dark:border-mint-600 dark:bg-mint-900/20 dark:text-mint-300 dark:hover:bg-mint-900/40 transition-colors flex-shrink-0"
                              title={t.send_message}
                              aria-label={t.send_message}
                            >
                              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="p-1.5 sm:p-2 rounded-ds-md border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed flex-shrink-0"
                              title={hasGuardian ? t.no_guardian : t.no_guardian_attached}
                              aria-label={hasGuardian ? t.no_guardian : t.no_guardian_attached}
                            >
                              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}

                          {/* Upload Images Button */}
                          <button
                            onClick={(e) => handleUploadImages(e, student)}
                            className="p-1.5 sm:p-2 rounded-ds-md border border-mint-200 bg-mint-50 text-mint-600 hover:bg-mint-100 hover:border-mint-300 dark:border-mint-600 dark:bg-mint-900/20 dark:text-mint-300 dark:hover:bg-mint-900/40 transition-colors flex-shrink-0"
                            title={t.upload_images}
                            aria-label={t.upload_images}
                          >
                            <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>

                          {/* Health Log Button */}
                          <button
                            onClick={(e) => handleHealthLogClick(e, student)}
                            className="p-1.5 sm:p-2 rounded-ds-md border border-mint-200 bg-mint-50 text-mint-600 hover:bg-mint-100 hover:border-mint-300 dark:border-mint-600 dark:bg-mint-900/20 dark:text-mint-300 dark:hover:bg-mint-900/40 transition-colors flex-shrink-0"
                            title={t['health_log'] || t['diapers_subtitle']}
                            aria-label={t['health_log'] || t['diapers_subtitle']}
                          >
                            <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        isOpen={photoUploadModalOpen}
        onClose={handlePhotoUploadClose}
        onSuccess={handlePhotoUploadSuccess}
        classes={teacherClasses}
        students={students}
        initialStudentId={selectedStudentForUpload?.id || null}
        initialClassId={selectedStudentForUpload?.class_id || null}
        disableDropdowns={!!(selectedStudentForUpload?.id && selectedStudentForUpload?.class_id)}
      />

      {/* Health Log Modal */}
      {selectedStudentForHealthLog && (
        <HealthLogFormModal
          isOpen={healthLogModalOpen}
          onClose={handleHealthLogClose}
          onSubmit={handleHealthLogSubmit}
          loading={isSubmittingHealthLog}
          initialStudentId={selectedStudentForHealthLog.id}
          initialStudentName={getStudentName(selectedStudentForHealthLog)}
          initialClassId={selectedStudentForHealthLog.class_id || null}
          initialClassName={
            selectedStudentForHealthLog.classes?.name ||
            teacherClasses.find((c) => c.id === selectedStudentForHealthLog.class_id)?.name ||
            null
          }
          disableDropdowns={true}
        />
      )}

      {/* Student Card Modal */}
      {studentCardModalOpen && selectedStudentForCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleStudentCardClose();
            }
          }}
        >
          <div className="w-full max-w-md rounded-ds-lg bg-white dark:bg-slate-800 p-4 sm:p-ds-md shadow-ds-lg max-h-[95vh] overflow-y-auto relative">
            <button
              onClick={handleStudentCardClose}
              className="absolute top-4 right-4 rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:bg-mint-200 dark:active:bg-slate-600 transition-colors z-10"
              aria-label={t.close}
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <StudentCard student={selectedStudentForCard} />
          </div>
        </div>
      )}
    </div>
  );
}

