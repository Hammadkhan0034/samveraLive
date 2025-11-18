'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Users, CalendarDays, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link as LinkIcon, Mail, Utensils, Menu } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function TeacherAttendancePage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isSigningIn } = useRequireAuth('teacher');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading attendance page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata;
  const orgIdFromMetadata = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  
  // If no org_id in metadata, we need to get it from the database
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  
  // Fetch org_id from database if not in metadata
  useEffect(() => {
    if (session?.user?.id && !orgIdFromMetadata) {
      const fetchUserOrgId = async () => {
        try {
          const response = await fetch(`/api/user-org-id?user_id=${session.user.id}`);
          const data = await response.json();
          if (response.ok && data.org_id) {
            setDbOrgId(data.org_id);
          }
        } catch (error) {
          console.error('Failed to fetch user org_id:', error);
        }
      };
      fetchUserOrgId();
    }
  }, [session?.user?.id, orgIdFromMetadata]);
  
  // Final org_id to use - from metadata, database, or default
  const finalOrgId = orgIdFromMetadata || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // ---- Attendance state ----
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [savedAttendance, setSavedAttendance] = useState<Record<string, boolean>>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Teacher classes and students
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  // Calculate kids checked in from actual students (needed for tiles badge)
  const kidsIn = useMemo(() => {
    return students.filter(s => attendance[s.id]).length;
  }, [students, attendance]);

  // Define tiles array (excluding attendance and diapers as they're handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'messages', title: t.tile_msg, desc: t.tile_msg_desc, Icon: MessageSquare, route: '/dashboard/teacher' },
      { id: 'media', title: t.tile_media, desc: t.tile_media_desc, Icon: Camera, route: '/dashboard/teacher' },
      { id: 'stories', title: t.tile_stories, desc: t.tile_stories_desc, Icon: Timer, route: '/dashboard/teacher' },
      { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell, route: '/dashboard/teacher' },
      { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users, route: '/dashboard/teacher' },
      { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users, route: '/dashboard/teacher' },
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher' },
    ], [t]);

  // Load teacher classes
  async function loadTeacherClasses(showLoading = true) {
    try {
      if (showLoading) setLoadingClasses(true);
      const userId = session?.user?.id;

      if (!userId) {
        return;
      }

      const response = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = data.classes || [];
        setTeacherClasses(classesData);

        if (typeof window !== 'undefined') {
          localStorage.setItem('teacher_classes_cache', JSON.stringify(classesData));
        }
      } else {
        setTeacherClasses([]);
      }
    } catch (error) {
      setTeacherClasses([]);
    } finally {
      if (showLoading) setLoadingClasses(false);
    }
  }

  // Load students from assigned classes
  async function loadStudents(showLoading = true) {
    try {
      if (showLoading) setLoadingStudents(true);
      setStudentError(null);

      if (teacherClasses.length === 0) {
        console.log('No classes assigned to teacher, skipping students load');
        setStudents([]);
        return;
      }

      if (!finalOrgId) {
        console.warn('⚠️ No orgId available, skipping students load');
        setStudents([]);
        return;
      }

      const classIds = teacherClasses.map(cls => cls.id);
      console.log('Loading students for classes:', classIds, 'Org ID:', finalOrgId);

      const allStudents = [];
      for (const classId of classIds) {
        try {
          const url = `/api/students?orgId=${finalOrgId}&classId=${classId}&t=${Date.now()}`;
          console.log(`📋 Fetching students for class ${classId}:`, url);
          
          const response = await fetch(url, { 
            cache: 'no-store',
            credentials: 'include'
          });
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || `HTTP ${response.status}` };
            }
            
            if (response.status === 401 || errorData.error?.includes('Authentication')) {
              console.warn(`⚠️ Authentication required for class ${classId}. Skipping...`);
            } else {
              console.error(`❌ Error loading students for class ${classId}:`, errorData.error || `HTTP ${response.status}`);
            }
            continue;
          }

          const data = await response.json();

          if (data.students && Array.isArray(data.students)) {
            const enhancedStudents = (data.students || []).map((student: any) => {
              const classInfo = teacherClasses.find(cls => cls.id === student.class_id);
              return {
                ...student,
                classes: {
                  id: student.class_id,
                  name: classInfo?.name || `Class ${student.class_id?.slice(0, 8)}...`
                }
              };
            });
            allStudents.push(...enhancedStudents);
            console.log(`✅ Loaded ${enhancedStudents.length} student(s) for class ${classId}`);
          } else {
            console.warn(`⚠️ No students array in response for class ${classId}`);
          }
        } catch (fetchError: any) {
          console.error(`❌ Fetch error loading students for class ${classId}:`, fetchError.message || fetchError);
          continue;
        }
      }

      setStudents(allStudents);
      console.log(`✅ Total students loaded: ${allStudents.length}`);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('teacher_students_cache', JSON.stringify(allStudents));
      }
    } catch (error: any) {
      console.error('❌ Error loading students:', error);
      setStudentError(error.message || 'Failed to load students');
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('teacher_students_cache');
          if (cached) {
            const cachedStudents = JSON.parse(cached);
            setStudents(cachedStudents);
            console.log('📦 Using cached students data due to error');
          }
        } catch (e) {
          // Ignore cache errors
        }
      }
    } finally {
      if (showLoading) setLoadingStudents(false);
    }
  }

  // Load data on mount
  React.useEffect(() => {
    const loadAllData = async () => {
      try {
        if (typeof window !== 'undefined') {
          try {
            const cachedClasses = localStorage.getItem('teacher_classes_cache');
            const cachedStudents = localStorage.getItem('teacher_students_cache');
            
            if (cachedClasses) {
              const parsed = JSON.parse(cachedClasses);
              if (Array.isArray(parsed)) setTeacherClasses(parsed);
            }
            if (cachedStudents) {
              const parsed = JSON.parse(cachedStudents);
              if (Array.isArray(parsed)) setStudents(parsed);
            }
          } catch (e) {
            // Ignore cache parsing errors
          }
        }

        if (session?.user?.id) {
          await Promise.allSettled([
            loadTeacherClasses(false)
          ]);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    
    loadAllData();
  }, [session?.user?.id, finalOrgId]);

  // Load students when teacher classes are loaded
  React.useEffect(() => {
    if (teacherClasses.length > 0) {
      console.log('Teacher classes loaded, fetching students...', teacherClasses);
      Promise.allSettled([
        loadStudents(false)
      ]);
    } else if (session?.user?.id && !loadingClasses && teacherClasses.length === 0) {
      console.log('No classes found yet, attempting to load...');
      loadTeacherClasses(false);
    }
  }, [teacherClasses, session?.user?.id, loadingClasses]);

  // ---- Attendance actions ----
  // Load attendance for today
  async function loadAttendanceForToday() {
    if (!finalOrgId || students.length === 0) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const classIds = teacherClasses.map(c => c.id).filter(Boolean);
      
      const allAttendance: Record<string, boolean> = {};
      
      for (const classId of classIds) {
        const response = await fetch(
          `/api/attendance?orgId=${finalOrgId}&classId=${classId}&date=${today}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        
        if (response.ok && data.attendance) {
          data.attendance.forEach((record: any) => {
            allAttendance[record.student_id] = record.status === 'present';
          });
        }
      }
      
      setAttendance(allAttendance);
      setSavedAttendance(allAttendance);
      console.log('✅ Attendance loaded for today:', allAttendance);
    } catch (error) {
      console.error('❌ Error loading attendance:', error);
    }
  }

  // Save single attendance record to database
  async function saveAttendanceRecord(studentId: string, isPresent: boolean, classId?: string | null) {
    if (!finalOrgId || !session?.user?.id) return false;

    try {
      const today = new Date().toISOString().split('T')[0];
      const status = isPresent ? 'present' : 'absent';
      
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: finalOrgId,
          class_id: classId || null,
          student_id: studentId,
          date: today,
          status: status,
          recorded_by: session.user.id
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Attendance saved:', { studentId, status });
        return true;
      } else {
        console.error('❌ Failed to save attendance:', data.error);
        return false;
      }
    } catch (error: any) {
      console.error('❌ Error saving attendance:', error);
      return false;
    }
  }

  // Submit all attendance changes
  async function submitAttendance() {
    if (!finalOrgId || !session?.user?.id || isSavingAttendance) return;

    try {
      setIsSavingAttendance(true);
      const today = new Date().toISOString().split('T')[0];
      
      const studentsToSave = students.filter(student => {
        const currentStatus = attendance[student.id] || false;
        const savedStatus = savedAttendance[student.id] || false;
        return currentStatus !== savedStatus;
      });

      if (studentsToSave.length === 0) {
        console.log('No attendance changes to save');
        setIsSavingAttendance(false);
        return;
      }

      console.log(`📋 Saving attendance for ${studentsToSave.length} student(s)...`);

      const savePromises = studentsToSave.map(async (student) => {
        const isPresent = attendance[student.id] || false;
        const classId = student.class_id || (student as any)?.classes?.id || null;
        return saveAttendanceRecord(student.id, isPresent, classId);
      });

      const results = await Promise.allSettled(savePromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failureCount = results.length - successCount;

      if (failureCount === 0) {
        setSavedAttendance({ ...attendance });
        console.log(`✅ Successfully saved attendance for ${successCount} student(s)`);
      } else {
        console.error(`❌ Failed to save attendance for ${failureCount} student(s)`);
        alert(`Failed to save attendance for ${failureCount} student(s). Please try again.`);
      }
    } catch (error: any) {
      console.error('❌ Error submitting attendance:', error);
      alert('Error saving attendance. Please try again.');
    } finally {
      setIsSavingAttendance(false);
    }
  }

  function togglePresent(studentId: string, checked: boolean) {
    setAttendance((prev) => ({ ...prev, [studentId]: checked }));
  }

  function markAllPresent(classId?: string) {
    const studentsToMark = classId 
      ? students.filter(s => {
          const sClassId = s.class_id || (s as any).classes?.id;
          return sClassId === classId;
        })
      : students;
    
    const newAttendance = { ...attendance };
    studentsToMark.forEach(s => {
      newAttendance[s.id] = true;
    });
    setAttendance(newAttendance);
  }

  // Check if there are unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    return students.some(student => {
      const currentStatus = attendance[student.id] || false;
      const savedStatus = savedAttendance[student.id] || false;
      return currentStatus !== savedStatus;
    });
  }, [attendance, savedAttendance, students]);

  // Load attendance when students are loaded
  React.useEffect(() => {
    if (students.length > 0 && finalOrgId && session?.user?.id && teacherClasses.length > 0) {
      loadAttendanceForToday();
    }
  }, [students.length, finalOrgId, session?.user?.id, teacherClasses.length]);

  // Determine active tile based on pathname
  const activeTile = pathname === '/dashboard/teacher/attendance' ? 'attendance' : null;

  // Safety check: if user is still not available after loading, don't render
  // (useRequireAuth hook should have redirected by now)
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      {/* Main content area with sidebar and content - starts below navbar */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <TeacherSidebar
          sidebarOpen={sidebarOpen}
          onSidebarClose={() => setSidebarOpen(false)}
          tiles={tiles}
          pathname={pathname}
          attendanceTile={{
            title: t.tile_att,
            desc: t.tile_att_desc,
            badge: kidsIn,
          }}
          diapersTile={{
            title: t.tile_diaper,
            desc: t.tile_diaper_desc,
          }}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Content Header */}
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  aria-label="Toggle sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.att_title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <ProfileSwitcher />
                <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>
                    {t.kids_checked_in}:{' '}
                    <span className="font-medium">{kidsIn}</span> / {students.length}
                  </span>
                  <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
                  <CalendarDays className="h-4 w-4" />
                  <span>{t.today_hint}</span>
                </div>
                {/* Small-screen stats row */}
                <div className="md:hidden flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>
                    {t.kids_checked_in}:{' '}
                    <span className="font-medium">{kidsIn}</span> / {students.length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Attendance Panel */}
            <section>
              <AttendancePanel 
                t={t} 
                students={students}
                teacherClasses={teacherClasses}
                attendance={attendance}
                hasUnsavedChanges={hasUnsavedChanges}
                isSaving={isSavingAttendance}
                onMarkAll={markAllPresent} 
                onToggle={togglePresent}
                onSubmit={submitAttendance}
                loadingStudents={loadingStudents}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------- Attendance Panel -------------------- */

function AttendancePanel({
  t,
  students,
  teacherClasses,
  attendance,
  hasUnsavedChanges,
  isSaving,
  onMarkAll,
  onToggle,
  onSubmit,
  loadingStudents,
}: {
  t: typeof enText;
  students: Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>;
  teacherClasses: any[];
  attendance: Record<string, boolean>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onMarkAll: (classId?: string) => void;
  onToggle: (studentId: string, checked: boolean) => void;
  onSubmit: () => void;
  loadingStudents: boolean;
}) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  // Filter students by selected class
  const filteredStudents = React.useMemo(() => {
    if (selectedClassId === 'all') {
      return students;
    }
    
    const filtered = students.filter(s => {
      const studentClassId = s.class_id || (s as any).classes?.id || null;
      const normalizedStudentClassId = studentClassId ? String(studentClassId).trim() : null;
      const normalizedSelectedClassId = selectedClassId ? String(selectedClassId).trim() : null;
      return normalizedStudentClassId === normalizedSelectedClassId;
    });
    
    return filtered;
  }, [students, selectedClassId]);

  // Get class name for display
  const getClassName = (classId: string | null) => {
    if (!classId) return 'No Class';
    const classInfo = teacherClasses.find(c => c.id === classId);
    return classInfo?.name || `Class ${classId.substring(0, 8)}...`;
  };

  // Get student full name
  const getStudentName = (student: any) => {
    const firstName = (student as any).users?.first_name || student.first_name || '';
    const lastName = (student as any).users?.last_name || student.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Unknown';
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.att_title}</h2>
        <div className="flex items-center gap-3">
          {/* Class Filter Dropdown */}
          {teacherClasses.length > 0 ? (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              <option value="all">{t.all_classes || 'All Classes'}</option>
              {teacherClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {t.no_classes_assigned || 'No classes assigned'}
            </div>
          )}
          <button
            onClick={() => onMarkAll(selectedClassId !== 'all' ? selectedClassId : undefined)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" />
            {t.att_mark_all_in}
          </button>
          <button
            onClick={onSubmit}
            disabled={!hasUnsavedChanges || isSaving || loadingStudents}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t.saved || 'Saving...'}
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4" />
                {t.submit_attendance || 'Submit Attendance'}
              </>
            )}
          </button>
        </div>
      </div>
      {hasUnsavedChanges && !isSaving && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
          {t.unsaved_changes || 'You have unsaved changes. Click "Submit Attendance" to save.'}
        </div>
      )}
      
      {loadingStudents ? (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">{t.loading}</div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          {selectedClassId === 'all' 
            ? t.no_students_found || 'No students found in assigned classes'
            : t.no_students_in_class || 'No students in this class'}
        </div>
      ) : (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const isPresent = attendance[student.id] || false;
            const studentName = getStudentName(student);
            return (
          <label
                key={student.id}
            className={clsx(
              'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition',
                  isPresent
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
            )}
          >
                <div className="flex flex-col">
                  <span className="font-medium">{studentName}</span>
                  {(student.class_id || (student as any).classes?.id) && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {getClassName(student.class_id || (student as any).classes?.id)}
                    </span>
                  )}
                </div>
            <input
              type="checkbox"
                  checked={isPresent}
                  onChange={(e) => onToggle(student.id, e.target.checked)}
                  disabled={isSaving || loadingStudents}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
            );
          })}
      </div>
      )}
    </div>
  );
}

/* -------------------- Translations -------------------- */

const enText = {
  title: 'Teacher Dashboard',
  kids_checked_in: 'Children checked in',
  today_hint: 'Today · Demo data',
  tile_att: 'Attendance',
  tile_att_desc: 'Mark in/out and late arrivals.',
  tile_diaper: 'Diapers & Health',
  tile_diaper_desc: 'Log diapers, naps, meds & temperature.',
  tile_msg: 'Messages',
  tile_msg_desc: 'Direct messages and announcements.',
  tile_guardians: 'Guardians',
  tile_guardians_desc: 'Add and manage guardians.',
  tile_media: 'Media',
  tile_media_desc: 'Upload photos & albums.',
  tile_stories: 'Stories (24h)',
  tile_stories_desc: 'Post classroom stories that expire in 24h.',
  tile_announcements: 'Announcements',
  tile_announcements_desc: 'Create and view announcements.',
  tile_link_student: 'Link Student',
  tile_link_student_desc: 'Link a guardian to a student.',
  tile_menus: 'Menus',
  tile_menus_desc: 'Manage daily menus.',
  tile_students: 'Students',
  tile_students_desc: 'Manage student requests and enrollment.',
  att_title: 'Attendance & Check-in',
  att_mark_all_in: 'Mark all present',
  all_classes: 'All Classes',
  no_classes_assigned: 'No classes assigned',
  no_students_found: 'No students found in assigned classes',
  no_students_in_class: 'No students in this class',
  submit_attendance: 'Submit Attendance',
  unsaved_changes: 'You have unsaved changes. Click "Submit Attendance" to save.',
  loading: 'Loading...',
  saved: 'Saved',
};

const isText = {
  title: 'Kennarayfirlit',
  kids_checked_in: 'Börn skráð inn',
  today_hint: 'Í dag · Sýnagögn',
  tile_att: 'Mæting',
  tile_att_desc: 'Skrá inn/út og seinkun.',
  tile_diaper: 'Bleyjur & Heilsa',
  tile_diaper_desc: 'Skrá bleyjur, svefn, lyf og hita.',
  tile_msg: 'Skilaboð',
  tile_msg_desc: 'Bein skilaboð og tilkynningar.',
  tile_guardians: 'Forráðamenn',
  tile_guardians_desc: 'Bæta við og sýsla með forráðamenn.',
  tile_media: 'Myndir',
  tile_media_desc: 'Hlaða upp myndum og albúmum.',
  tile_stories: 'Sögur (24 klst)',
  tile_stories_desc: 'Hópsögur sem hverfa eftir 24 klst.',
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Stofna og skoða tilkynningar',
  tile_link_student: 'Tengja nemanda',
  tile_link_student_desc: 'Tengja forráðamann við nemanda.',
  tile_menus: 'Matseðillar',
  tile_menus_desc: 'Sýsla með daglega matseðla.',
  tile_students: 'Nemendur',
  tile_students_desc: 'Sýsla með beiðnir nemenda og skráningu.',
  att_title: 'Mæting & Inn-/útstimplun',
  att_mark_all_in: 'Skrá alla inn',
  all_classes: 'Allir hópar',
  no_classes_assigned: 'Engir hópar úthlutaðir',
  no_students_found: 'Engir nemendur fundust í úthlutuðum hópum',
  no_students_in_class: 'Engir nemendur í þessum hóp',
  submit_attendance: 'Vista mætingu',
  unsaved_changes: 'Þú hefur óvistaðar breytingar. Smelltu á "Vista mætingu" til að vista.',
  loading: 'Hleður...',
  saved: 'Vistað',
};

