'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Timer, Users, MessageSquare, Camera, Link as LinkIcon, Utensils, Plus, Search, Edit, Trash2, X, Menu, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

// Students Page Header Component
function StudentsPageHeader({ 
  title, 
  label,
  value, 
  todayHint 
}: { 
  title: string; 
  label: string;
  value: number; 
  todayHint: string;
}) {
  const { sidebarRef } = useTeacherPageLayout();
  
  return (
    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={() => sidebarRef.current?.open()}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <ProfileSwitcher />
        {/* Desktop stats */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Users className="h-4 w-4" />
          <span>
            {label}:{' '}
            <span className="font-medium">{value}</span>
          </span>
          <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
          <CalendarDays className="h-4 w-4" />
          <span>{todayHint}</span>
        </div>
        {/* Mobile stats */}
        <div className="md:hidden flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Users className="h-4 w-4" />
          <span>
            {label}:{' '}
            <span className="font-medium">{value}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// StudentsPanel Component
function StudentsPanel({
  t,
  students,
  loadingStudents,
  studentError,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  teacherClasses
}: {
  t: typeof enText | typeof isText;
  students: any[];
  loadingStudents: boolean;
  studentError: string | null;
  onAddStudent: () => void;
  onEditStudent?: (student: any) => void;
  onDeleteStudent?: (studentId: string) => void;
  teacherClasses?: any[];
}) {
  // Search and pagination state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 5;

  // Filter students based on search query
  const filteredStudents = React.useMemo(() => {
    if (!searchQuery.trim()) return students;
    
    const query = searchQuery.toLowerCase();
    return students.filter((student) => {
      const firstName = ((student as any).users?.first_name || student.first_name || '').toLowerCase();
      const lastName = ((student as any).users?.last_name || student.last_name || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const className = (student.classes?.name || '').toLowerCase();
      
      return fullName.includes(query) || 
             firstName.includes(query) || 
             lastName.includes(query) ||
             className.includes(query);
    });
  }, [students, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center">
        <button
          onClick={onAddStudent}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" />
          {t.add_student || 'Add Student'}
        </button>
      </div>

      {/* Existing Students Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-medium text-slate-900 dark:text-slate-100">{t.existing_students}</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_students_placeholder || 'Search students...'}
                className="pl-10 pr-4 py-1 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 w-64"
              />
            </div>
          </div>
        </div>
        {studentError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {studentError}
          </div>
        )}
        <div className="overflow-x-auto rounded-t-lg rounded-r-lg">
          {loadingStudents ? (
            <LoadingSkeleton type="table" rows={5} />
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">
              {searchQuery ? (t.no_students_found_search || 'No students found matching your search') : t.no_students_found}
            </div>
          ) : (
            <>
              <table className="w-full border-collapse">
              <thead>
                <tr className="bg-black">
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.student_name}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.student_dob}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.student_gender}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.student_class}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.guardians || 'Guardians'}
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                    {t.actions || 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-2 px-4">
                      <div className="font-medium text-[13px] text-slate-900 dark:text-slate-100">
                        {(student as any).users?.first_name || student.first_name || ''} {(student as any).users?.last_name || student.last_name || ''}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-sm text-black dark:text-slate-400">
                      {(student as any).users?.dob ? (
                        <span suppressHydrationWarning>{typeof window !== 'undefined' ? new Date((student as any).users.dob).toLocaleDateString() : ''}</span>
                      ) : student.dob ? (
                        <span suppressHydrationWarning>{typeof window !== 'undefined' ? new Date(student.dob).toLocaleDateString() : ''}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2 px-4 text-sm text-black dark:text-slate-400">
                      {(student as any).users?.gender || student.gender || '-'}
                    </td>
                    <td className="py-2 px-4 text-sm text-black dark:text-slate-400">
                      {student.classes?.name || '-'}
                    </td>
                    <td className="py-2 px-4 text-sm text-black dark:text-slate-400">
                      {((student as any).guardians && Array.isArray((student as any).guardians) && (student as any).guardians.length > 0) ? (
                        <div className="flex flex-col gap-1">
                          {(student as any).guardians.map((guardian: any, idx: number) => {
                            const guardianName = guardian.users 
                              ? `${guardian.users.first_name || ''} ${guardian.users.last_name || ''}`.trim()
                              : null;
                            return guardianName ? (
                              <span key={guardian.id || idx} className="text-xs">
                                {guardianName}
                                {guardian.relation ? ` (${guardian.relation})` : ''}
                              </span>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEditStudent && onEditStudent(student)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[13px] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                          title={t.edit || 'Edit'}
                        >
                          <Edit className="h-3.5 w-3.5" />
                          {t.edit || 'Edit'}
                        </button>
                        
                        <button
                          onClick={() => onDeleteStudent && onDeleteStudent(student.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-[13px] text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                          title={t.delete || 'Delete'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.delete || 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
              
              {/* Pagination Controls - Always show when there is at least 1 student */}
              {filteredStudents.length > 0 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-400 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {t.prev || 'Prev'}
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm rounded-lg ${
                          currentPage === page
                            ? 'bg-white text-black dark:bg-slate-800 border border-slate-300'
                            : 'border border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-400 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {t.next || 'Next'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeacherStudentsPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

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
  
  // Final org_id to use
  const finalOrgId = orgIdFromMetadata || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // Teacher classes
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Students from assigned classes
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  // Edit and Delete student states
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [editingStudentForm, setEditingStudentForm] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'unknown',
    medical_notes: '',
    allergies: '',
    emergency_contact: '',
    class_id: '',
    guardian_ids: [] as string[]
  });

  // Load teacher classes
  async function loadTeacherClasses(showLoading = true) {
    try {
      if (showLoading) setLoadingClasses(true);
      const userId = session?.user?.id;

      if (!userId) {
        return;
      }

      // Fetch teacher's assigned classes
      const response = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = data.classes || [];
        setTeacherClasses(classesData);

        // Cache the data
        if (typeof window !== 'undefined') {
          localStorage.setItem('teacher_classes_cache', JSON.stringify(classesData));
        }
      } else {
        // Set empty array on error
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

      // Get teacher's assigned classes first
      if (teacherClasses.length === 0) {
        console.log('No classes assigned to teacher, skipping students load');
        setStudents([]);
        return;
      }

      // Validate orgId before making requests
      if (!finalOrgId) {
        console.warn('⚠️ No orgId available, skipping students load');
        setStudents([]);
        return;
      }

      const classIds = teacherClasses.map(cls => cls.id);
      console.log('Loading students for classes:', classIds, 'Org ID:', finalOrgId);

      // Load students for each class
      const allStudents = [];
      for (const classId of classIds) {
        try {
          const url = `/api/students?orgId=${finalOrgId}&classId=${classId}&t=${Date.now()}`;
          console.log(`📋 Fetching students for class ${classId}:`, url);
          
          const response = await fetch(url, { 
            cache: 'no-store',
            credentials: 'include'
          });
          
          // Check if fetch succeeded before trying to parse JSON
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || `HTTP ${response.status}` };
            }
            
            // Handle authentication errors gracefully
            if (response.status === 401 || errorData.error?.includes('Authentication')) {
              console.warn(`⚠️ Authentication required for class ${classId}. Skipping...`);
            } else {
              console.error(`❌ Error loading students for class ${classId}:`, errorData.error || `HTTP ${response.status}`);
            }
            continue; // Skip this class and continue with others
          }

          const data = await response.json();

          if (data.students && Array.isArray(data.students)) {
            // Enhance students with class names
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
          // Handle network errors, JSON parsing errors, etc.
          console.error(`❌ Fetch error loading students for class ${classId}:`, fetchError.message || fetchError);
          // Continue with other classes instead of failing completely
          continue;
        }
      }

      setStudents(allStudents);
      console.log(`✅ Total students loaded: ${allStudents.length}`);
      
      // Cache the data
      if (typeof window !== 'undefined') {
        localStorage.setItem('teacher_students_cache', JSON.stringify(allStudents));
      }
    } catch (error: any) {
      console.error('❌ Error loading students:', error);
      setStudentError(error.message || 'Failed to load students');
      // Don't clear students on error - keep cached data if available
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

  // Create table and load data
  async function createTableAndLoadData(shouldLoadData = false) {
    try {
      console.log('🏗️ Creating student_requests table...');
      const createResponse = await fetch('/api/create-student-requests-table', {
        method: 'POST'
      });

      const createData = await createResponse.json();
      console.log('📊 Create table result:', createData);

      if (createResponse.ok) {
        console.log('✅ Table created successfully');
      } else {
        console.error('❌ Failed to create table:', createData.error);
      }
    } catch (error) {
      console.error('💥 Error creating table:', error);
    }
  }

  // Load data on mount
  useEffect(() => {
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
  useEffect(() => {
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

  // Load students when classes are available
  useEffect(() => {
    if (session?.user?.id && teacherClasses.length > 0) {
      // Create table if needed and load data
      createTableAndLoadData(true);
      
      // Load immediately
      loadStudents(false);
    }
  }, [session?.user?.id, teacherClasses.length]);

  // Edit and Delete handlers
  function openEditStudentModal(student: any) {
    setEditingStudent(student);
    const userData = (student as any).users || {};
    
    setEditingStudentForm({
      first_name: userData.first_name || student.first_name || '',
      last_name: userData.last_name || student.last_name || '',
      dob: userData.dob || student.dob || '',
      gender: (userData.gender || student.gender || 'unknown').toLowerCase(),
      medical_notes: student.medical_notes_encrypted || '',
      allergies: student.allergies_encrypted || '',
      emergency_contact: student.emergency_contact_encrypted || '',
      class_id: student.class_id || '',
      guardian_ids: []
    });
    
    setIsEditStudentModalOpen(true);
  }

  async function handleUpdateStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      setUpdatingStudent(true);

      const response = await fetch(`/api/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStudent.id,
          ...editingStudentForm,
          org_id: finalOrgId,
          medical_notes: editingStudentForm.medical_notes,
          allergies: editingStudentForm.allergies,
          emergency_contact: editingStudentForm.emergency_contact,
          guardian_ids: editingStudentForm.guardian_ids || []
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsEditStudentModalOpen(false);
        setEditingStudent(null);
        // Reload students in the background without showing loading state
        loadStudents(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setUpdatingStudent(false);
    }
  }

  function openDeleteConfirm(studentId: string) {
    setDeletingStudentId(studentId);
    setIsDeleteConfirmOpen(true);
  }

  async function handleDeleteStudent() {
    if (!deletingStudentId) return;

    try {
      setDeletingStudent(true);
      
      // Optimistically remove student from UI
      setStudents(prev => prev.filter(s => s.id !== deletingStudentId));
      
      const response = await fetch(`/api/students?id=${deletingStudentId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        setIsDeleteConfirmOpen(false);
        setDeletingStudentId(null);
        // Refresh in background to ensure data consistency
        loadStudents(false);
      } else {
        // Revert optimistic update on error
        loadStudents(false);
        alert(`Error: ${data.error}`);
      }
    } catch (error: any) {
      // Revert optimistic update on error
      loadStudents(false);
      alert(`Error: ${error.message}`);
    } finally {
      setDeletingStudent(false);
    }
  }

  // Define tiles array
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher?tab=link_student' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
    ], [t, lang]);

  return (
    <TeacherPageLayout>
      {/* Content Header */}
      <StudentsPageHeader
        title={t.students}
        label={t.tile_students}
        value={students.length}
        todayHint={t.today_hint}
      />

      {/* Students Panel */}
      <StudentsPanel 
        t={t} 
        students={students} 
        loadingStudents={loadingStudents} 
        studentError={studentError} 
        onAddStudent={() => router.push('/dashboard/add-student')} 
        onEditStudent={openEditStudentModal} 
        onDeleteStudent={openDeleteConfirm} 
        teacherClasses={teacherClasses} 
      />

      {/* Edit Student Modal */}
      {isEditStudentModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.edit_student || 'Edit Student'}</h3>
              <button
                onClick={() => {
                  setIsEditStudentModalOpen(false);
                  setEditingStudent(null);
                }}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_first_name}
                  </label>
                  <input
                    type="text"
                    value={editingStudentForm.first_name}
                    onChange={(e) => setEditingStudentForm(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t.student_first_name_placeholder}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_last_name}
                  </label>
                  <input
                    type="text"
                    value={editingStudentForm.last_name}
                    onChange={(e) => setEditingStudentForm(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t.student_last_name_placeholder}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_dob}
                  </label>
                  <input
                    type="date"
                    value={editingStudentForm.dob}
                    onChange={(e) => setEditingStudentForm(prev => ({ ...prev, dob: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_gender}
                  </label>
                  <select
                    value={editingStudentForm.gender}
                    onChange={(e) => setEditingStudentForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="unknown">{t.gender_unknown}</option>
                    <option value="male">{t.gender_male}</option>
                    <option value="female">{t.gender_female}</option>
                    <option value="other">{t.gender_other}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_class}
                  </label>
                  <select
                    value={editingStudentForm.class_id}
                    onChange={(e) => setEditingStudentForm(prev => ({ ...prev, class_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="">{t.select_class}</option>
                    {teacherClasses && teacherClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_medical_notes}
                  </label>
                  <textarea
                    value={editingStudentForm.medical_notes}
                    onChange={(e) => setEditingStudentForm(prev => ({ ...prev, medical_notes: e.target.value }))}
                    placeholder={t.student_medical_notes_placeholder}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_allergies}
                  </label>
                  <textarea
                    value={editingStudentForm.allergies}
                    onChange={(e) => setEditingStudentForm(prev => ({ ...prev, allergies: e.target.value }))}
                    placeholder={t.student_allergies_placeholder}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                    rows={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_emergency_contact}
                </label>
                <textarea
                  value={editingStudentForm.emergency_contact}
                  onChange={(e) => setEditingStudentForm(prev => ({ ...prev, emergency_contact: e.target.value }))}
                  placeholder={t.student_emergency_contact_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditStudentModalOpen(false);
                    setEditingStudent(null);
                  }}
                  disabled={loadingStudents}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={updatingStudent}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 dark:bg-black"
                >
                  {updatingStudent ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t.updating || 'Updating...'}
                    </>
                  ) : (
                    t.update || 'Update'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setDeletingStudentId(null);
        }}
        onConfirm={handleDeleteStudent}
        title={t.delete_student || 'Delete Student'}
        message={t.delete_student_confirm || 'Are you sure you want to delete this student? This action cannot be undone.'}
        loading={deletingStudent}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel}
      />
    </TeacherPageLayout>
  );
}

