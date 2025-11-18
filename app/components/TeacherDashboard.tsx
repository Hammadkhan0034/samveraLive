'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Users, CalendarDays, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link as LinkIcon, Mail, Utensils, Menu, Eye, MessageSquarePlus } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import AnnouncementForm from './AnnouncementForm';
import AnnouncementList from './AnnouncementList';
import { supabase } from '@/lib/supabaseClient';
import { option } from 'framer-motion/client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import StoryColumn from './shared/StoryColumn';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';
import { GuardianTable } from '@/app/components/shared/GuardianTable';
import { GuardianForm, type GuardianFormData } from '@/app/components/shared/GuardianForm';
import LinkStudentGuardian from './LinkStudentGuardian';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';

type Lang = 'is' | 'en';
type TileId = 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}
const uid = () => Math.random().toString(36).slice(2, 9);

export default function TeacherDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const [active, setActive] = useState<TileId>('announcements');
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Set active tab from query parameter
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['announcements', 'students', 'guardians', 'link_student', 'menus'].includes(tabParam)) {
      setActive(tabParam as TileId);
    }
  }, [searchParams]);

  // Prefetch routes for instant navigation
  useEffect(() => {
    try {
      router.prefetch('/dashboard/menus-view');
      router.prefetch('/dashboard/menus-list');
      router.prefetch('/dashboard/add-menu');
      router.prefetch('/dashboard/teacher/messages');
    } catch {}
  }, [router]);

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

  // Messages count for sidebar badge
  const [messagesCount, setMessagesCount] = useState(0);

  // Student request states - initialize empty to avoid hydration mismatch
  const [studentRequests, setStudentRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isStudentRequestModalOpen, setIsStudentRequestModalOpen] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Students from assigned classes - initialize empty to avoid hydration mismatch
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string | null; dob: string | null; gender: string; class_id: string | null; created_at: string; classes?: any; guardians?: Array<{ id: string; relation: string; users?: { id: string; full_name: string; email: string } }> }>>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [studentRequestForm, setStudentRequestForm] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'unknown',
    medical_notes: '',
    allergies: '',
    emergency_contact: '',
    status: 'pending',
    class_id: '',
    barngildi: 0.5,
    ssn: '',
    address: '',
    phone: '',
    registration_time: '',
    start_date: '',
    guardian_ids: [] as string[]
  });

  // Metadata fix state to prevent infinite loops
  const [metadataFixAttempted, setMetadataFixAttempted] = useState(false);

  // Edit and Delete student states
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  // Guardians state removed from existing students UI flow
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
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

  // Define tiles array
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell },
      { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users },
      { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users },
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils },
    ], [t]);

  // ---- Student request actions ----
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
      // Set empty array on error
      setTeacherClasses([]);
    } finally {
      if (showLoading) setLoadingClasses(false);
    }
  }

  async function loadStudentRequests(showLoading = true) {
    try {
      if (showLoading) setLoadingRequests(true);

      // Get teacher's assigned classes first
      if (teacherClasses.length === 0) {
        setStudentRequests([]);
        return;
      }

      // Load student requests for all assigned classes (for approved/rejected history only)
      const classIds = teacherClasses.map(cls => cls.id).join(',');

      const response = await fetch(`/api/student-requests?classIds=${classIds}&orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        // Enhance the student requests with class names (use API response first, fallback to teacherClasses)
        const enhancedRequests = (data.student_requests || []).map((request: any) => {
          // Use class_name from API if available, otherwise look it up
          const classInfo = request.class_name 
            ? null 
            : teacherClasses.find(cls => cls.id === request.class_id);
          return {
            ...request,
            class_name: request.class_name || classInfo?.name || request.classes?.name || `Class ${request.class_id?.slice(0, 8)}...`
          };
        });
        setStudentRequests(enhancedRequests);
        
        // Cache the data
        if (typeof window !== 'undefined') {
          localStorage.setItem('teacher_student_requests_cache', JSON.stringify(enhancedRequests));
        }
      } else {
        // Silently handle errors - student requests are optional (only for history)
        setStudentRequests([]);
      }
    } catch (error) {
      // Silently handle errors - student requests are optional (only for history)
      setStudentRequests([]);
    } finally {
      if (showLoading) setLoadingRequests(false);
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
            credentials: 'include' // Include cookies for authentication
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

  async function submitStudentRequest(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoadingRequests(true);

      const classId = studentRequestForm.class_id;
      const requestedBy = session?.user?.id;

  
      if (!requestedBy) {
        alert('Missing user ID - Please check if you are properly logged in');
        return;
      }

      if (!classId) {
        alert('Please select a class for the student');
        return;
      }

      if (!finalOrgId) {
        alert('Missing organization ID - Please check your session');
        return;
      }

      const response = await fetch('/api/student-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studentRequestForm,
          class_id: classId,
          org_id: finalOrgId,
          requested_by: requestedBy,
          guardian_ids: studentRequestForm.guardian_ids || []
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('Student request submitted successfully! Waiting for principal approval.');
        setIsSuccessModalOpen(true);

        setStudentRequestForm({
          first_name: '',
          last_name: '',
          dob: '',
          gender: 'unknown',
          medical_notes: '',
          allergies: '',
          emergency_contact: '',
          status: 'pending',
          class_id: '',
          barngildi: 0.5,
          ssn: '',
          address: '',
          phone: '',
          registration_time: '',
          start_date: '',
          guardian_ids: []
        });
        setIsStudentRequestModalOpen(false);
        // loadStudentRequests removed - teachers now create students directly
      } else {
        setSuccessMessage(`Error: ${data.error}`);
        setIsSuccessModalOpen(true);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoadingRequests(false);
    }
  }

  // Load messages count for KPI badge - only when messages tab is active or on initial mount
  async function loadMessagesForKPI() {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/messages?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.threads) {
        const unreadCount = json.threads.filter((t: any) => t.unread).length;
        setMessagesCount(unreadCount);
      }
    } catch (error) {
      console.error('Error loading messages count:', error);
    }
  }

  // Load messages count for sidebar badge
  React.useEffect(() => {
    if (session?.user?.id) {
      loadMessagesForKPI();
    }
  }, [session?.user?.id]);

  // Load data immediately on mount and refresh when session is available
  React.useEffect(() => {
    const loadAllData = async () => {
      try {
        // Load cached data first for instant display (client-side only)
        if (typeof window !== 'undefined') {
          try {
            const cachedRequests = localStorage.getItem('teacher_student_requests_cache');
            const cachedClasses = localStorage.getItem('teacher_classes_cache');
            const cachedStudents = localStorage.getItem('teacher_students_cache');
            
            if (cachedRequests) {
              const parsed = JSON.parse(cachedRequests);
              if (Array.isArray(parsed)) setStudentRequests(parsed);
            }
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

        // Start background loading - only load teacher classes on mount
        // createTableAndLoadData will be called when students tab becomes active
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, finalOrgId]);

  // Load student requests and students when teacher classes are loaded - ONLY if students tab is active
  React.useEffect(() => {
    if (teacherClasses.length > 0 && active === 'students') {
      console.log('Teacher classes loaded, fetching students...', teacherClasses);
      Promise.allSettled([
        loadStudents(false)
      ]);
    } else if (session?.user?.id && !loadingClasses && teacherClasses.length === 0) {
      // Try loading classes again if they're not loaded yet
      console.log('No classes found yet, attempting to load...');
      loadTeacherClasses(false);
    }
  }, [teacherClasses, session?.user?.id, loadingClasses, active]);

  // Load student requests and students ONLY when students tab becomes active (no auto-refresh)
  React.useEffect(() => {
    if (session?.user?.id && teacherClasses.length > 0 && active === 'students') {
      // Create table if needed and load data
      createTableAndLoadData(true);
      
      // Load immediately when tab becomes active
      loadStudents(false);
    }
  }, [session?.user?.id, teacherClasses.length, active]);


  React.useEffect(() => {
    if (isStudentRequestModalOpen && session?.user?.id) {
    }
  }, [isStudentRequestModalOpen, session?.user?.id, finalOrgId]);

//       const userId = session?.user?.id;
//       if (!userId) return;

//       console.log('🔍 Debugging teacher data...');
//       const response = await fetch(`/api/debug-teacher?userId=${userId}`);
//       const data = await response.json();

//       console.log('🔍 Debug data:', data);

//       const debugInfo = `Debug Info:
// User has class_id: ${data.debug_info.user_has_class_id}
// Class ID: ${data.debug_info.user_class_id}
// Total classes: ${data.debug_info.total_classes}
// Total students: ${data.debug_info.total_students}

// Available classes:
// ${data.classes.map((cls: any) => `- ${cls.name} (${cls.id})`).join('\n')}`;

//       alert(debugInfo);
//     } catch (error) {
//       console.error('Debug error:', error);
//     }
//   }

  // Debug function to check class memberships
//   async function debugClassMemberships() {
//     try {
//       const userId = session?.user?.id;
//       const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

//       if (!userId) return;

//       console.log('🔍 Debugging class memberships...');
//       const response = await fetch(`/api/debug-class-memberships?userId=${userId}&orgId=${orgId}`);
//       const data = await response.json();

//       console.log('🔍 Class memberships debug data:', data);

//       const debugInfo = `Class Memberships Debug:
//       Total memberships: ${data.total_memberships}
//       User memberships: ${data.user_memberships.length}
//     Org memberships: ${data.org_memberships.length}

// User memberships:
// ${data.user_memberships.map((m: any) => `- ${m.classes?.name} (${m.class_id}) - ${m.membership_role}`).join('\n')}

// Org memberships:
// ${data.org_memberships.map((m: any) => `- ${m.users?.full_name} -> ${m.classes?.name} (${m.class_id})`).join('\n')}`;

//       alert(debugInfo);
//     } catch (error) {
//       console.error('Debug memberships error:', error);
//     }
//   }

  // Function to test if class exists
  // async function testClassExists() {
  //   try {
  //     const userId = session?.user?.id;
  //     if (!userId) return;

  //     console.log('🧪 Testing class existence...');

  //     // Get the class_id from memberships
  //     const response = await fetch(`/api/debug-class-memberships?userId=${userId}&orgId=1db3c97c-de42-4ad2-bb72-cc0b6cda69f7`);
  //     const data = await response.json();

  //     if (data.user_memberships && data.user_memberships.length > 0) {
  //       const classId = data.user_memberships[0].class_id;
  //       console.log('🧪 Testing class ID:', classId);

  //       const testResponse = await fetch(`/api/test-class?classId=${classId}`);
  //       const testData = await testResponse.json();

  //       console.log('🧪 Test result:', testData);

  //       if (testResponse.ok) {
  //         alert(`✅ Class exists in database!\n\nClass: ${testData.class.name}\nID: ${testData.class.id}\nOrg ID: ${testData.class.org_id}`);
  //       } else {
  //         alert(`❌ Class not found in database!\n\nError: ${testData.error}\nDetails: ${testData.details}`);
  //       }
  //     } else {
  //       alert('❌ No class memberships found for this teacher');
  //     }
  //   } catch (error) {
  //     console.error('Test class error:', error);
  //     alert('❌ Error testing class existence');
  //   }
  // }

  // Function to assign teacher to first available class
  // async function assignTeacherToClass() {
  //   try {
  //     const userId = session?.user?.id;
  //     if (!userId) return;

  //     console.log('🔧 Assigning teacher to class...');

  //     // Get available classes
  //     const debugResponse = await fetch(`/api/debug-teacher?userId=${userId}`);
  //     const debugData = await debugResponse.json();

  //     if (debugData.classes && debugData.classes.length > 0) {
  //       const firstClass = debugData.classes[0];
  //       console.log('Assigning teacher to class:', firstClass.name, firstClass.id);

  //       // Update teacher's class assignment
  //       const updateResponse = await fetch('/api/assign-teacher-class', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({
  //           userId: userId,
  //           classId: firstClass.id
  //         })
  //       });

  //       const updateData = await updateResponse.json();

  //       if (updateResponse.ok) {
  //         alert(`✅ Teacher assigned to class: ${firstClass.name}`);
  //         // Reload classes
  //         loadTeacherClasses();
  //       } else {
  //         alert(`❌ Error: ${updateData.error}`);
  //       }
  //     } else {
  //       alert(`❌ No classes available to assign.\n\nPlease create classes first in Principal Dashboard:\n1. Go to Principal Dashboard\n2. Click "Add Class"\n3. Create a class\n4. Then try again`);
  //     }
  //   } catch (error) {
  //     console.error('Error assigning class:', error);
  //     alert('❌ Error assigning class');
  //   }
  // }

  // Create table and load data - ONLY when students tab is active
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
        // Only load data if requested (when students tab is active)
        if (shouldLoadData) {
          // loadStudentRequests removed - teachers now create students directly
        }
      } else {
        console.error('❌ Failed to create table:', createData.error);
      }
    } catch (error) {
      console.error('💥 Error creating table:', error);
    }
  }

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

  // // Function to fix missing user metadata
  // async function fixUserMetadata() {
  //   try {
  //     const userId = session?.user?.id;
  //     if (!userId) return;

  //     // Use default values for now - in a real app, you'd get these from context or database
  //     const defaultOrgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'default-org-id';
  //     const defaultClassId = 'default-class-id';

  //     console.log('📝 Using default values:', { defaultOrgId, defaultClassId });

  //     // Update the user's metadata with the default org_id and class_id
  //     const updateResponse = await fetch('/api/teacher-metadata', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         user_id: userId,
  //         org_id: defaultOrgId,
  //         class_id: defaultClassId
  //       })
  //     });

  //     const updateData = await updateResponse.json();

  //     if (updateResponse.ok) {
  //       console.log('✅ Metadata updated successfully');
  //       // loadStudentRequests removed - teachers now create students directly
  //     } else {
  //       console.error('❌ Failed to update metadata:', updateData.error);
  //     }
  //   } catch (error) {
  //     console.error('💥 Error fixing metadata:', error);
  //   }
  // }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      {/* Main content area with sidebar and content - starts below navbar */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <TeacherSidebar
          activeTile={active}
          onTileClick={(tileId) => setActive(tileId as TileId)}
          sidebarOpen={sidebarOpen}
          onSidebarClose={() => setSidebarOpen(false)}
          tiles={tiles}
          pathname={pathname}
          attendanceTile={{
            title: t.tile_att,
            desc: t.tile_att_desc,
          }}
          diapersTile={{
            title: t.tile_diaper,
            desc: t.tile_diaper_desc,
          }}
          messagesTile={{
            title: t.tile_msg,
            desc: t.tile_msg_desc,
            badge: messagesCount > 0 ? messagesCount : undefined,
          }}
          mediaTile={{
            title: t.tile_media,
            desc: t.tile_media_desc,
          }}
          storiesTile={{
            title: t.tile_stories,
            desc: t.tile_stories_desc,
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
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <ProfileSwitcher />
                <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>
                    {t.tile_students}:{' '}
                    <span className="font-medium">{students.length}</span>
                  </span>
                  <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
                  <CalendarDays className="h-4 w-4" />
                  <span>{t.today_hint}</span>
                </div>
                {/* Small-screen stats row */}
                <div className="md:hidden flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>
                    {t.tile_students}:{' '}
                    <span className="font-medium">{students.length}</span>
                  </span>
                </div>
              </div>
            </div>
            {/* Active panel */}
            
            <section>
              {active === 'announcements' && <AnnouncementsPanel t={t} lang={lang} teacherClasses={teacherClasses} />}
              {active === 'students' && <StudentsPanel t={t} studentRequests={studentRequests} loadingRequests={loadingRequests} students={students} loadingStudents={loadingStudents} studentError={studentError} onAddStudent={() => router.push('/dashboard/add-student')} onEditStudent={openEditStudentModal} onDeleteStudent={openDeleteConfirm} teacherClasses={teacherClasses} />}
              {active === 'guardians' && <GuardiansPanel t={t} lang={lang} orgId={finalOrgId} />}
              {active === 'link_student' && <LinkStudentPanel t={t} lang={lang} />}
              {active === 'menus' && <MenusPanel t={t} lang={lang} orgId={finalOrgId} userId={session?.user?.id} isActive={active === 'menus'} />}
            </section>
          </div>
        </main>
      </div>
      
      {/* Student Request Modal (disabled) */}
      {false && isStudentRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.add_student_request}</h3>
              <button
                onClick={() => {
                  setIsStudentRequestModalOpen(false);
                }}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitStudentRequest} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_first_name}
                  </label>
                  <input
                    type="text"
                    value={studentRequestForm.first_name}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, first_name: e.target.value }))}
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
                    value={studentRequestForm.last_name}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, last_name: e.target.value }))}
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
                    value={studentRequestForm.dob}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, dob: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_gender}
                  </label>
                  <select
                    value={studentRequestForm.gender}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, gender: e.target.value }))}
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
                    {t.status || 'Status'}
                  </label>
                  <select
                    value={studentRequestForm.status}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="pending">{t.pending || 'Pending'}</option>
                    <option value="approved">{t.approved || 'Approved'}</option>
                    <option value="rejected">{t.rejected || 'Rejected'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_class}
                  </label>
                  <select
                    value={studentRequestForm.class_id}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, class_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    required
                  >
                    <option value="">{t.select_class}</option>
                    {loadingClasses ? (
                      <option disabled>{t.loading}</option>
                    ) : teacherClasses.length === 0 ? (
                      <option disabled>{t.no_classes_assigned}</option>
                    ) : (
                      teacherClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_child_value || 'Child Value'}
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="1.9"
                    step="0.1"
                    value={studentRequestForm.barngildi}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0.5 && value <= 1.9) {
                        setStudentRequestForm(prev => ({ ...prev, barngildi: value }));
                      }
                    }}
                    placeholder={t.student_child_value_placeholder || '0.5 - 1.9'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_social_security_number || 'SSN'}
                  </label>
                  <input
                    type="text"
                    value={studentRequestForm.ssn}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, ssn: e.target.value }))}
                    placeholder="000000-0000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Registration Time, Start Date, Phone on same line */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_registration_time || 'Registration Time'}
                  </label>
                  <input

type="text"
                    value={studentRequestForm.registration_time}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, registration_time: e.target.value }))}
                    placeholder='YYYY-MM-DD HH:MM'
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_start_date || 'Start Date'}
                  </label>
                  <input
                    type="date"
                    value={studentRequestForm.start_date}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_phone || 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={studentRequestForm.phone}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder={t.student_phone_placeholder || 'Enter phone number'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.student_medical_notes}
                  </label>
                  <textarea
                    value={studentRequestForm.medical_notes}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, medical_notes: e.target.value }))}
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
                    value={studentRequestForm.allergies}
                    onChange={(e) => setStudentRequestForm(prev => ({ ...prev, allergies: e.target.value }))}
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
                  value={studentRequestForm.emergency_contact}
                  onChange={(e) => setStudentRequestForm(prev => ({ ...prev, emergency_contact: e.target.value }))}
                  placeholder={t.student_emergency_contact_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_address || 'Address'}
                </label>
                <input
                  type="text"
                  value={studentRequestForm.address}
                  onChange={(e) => setStudentRequestForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={t.student_address_placeholder || 'Enter address'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                />
              </div>

              

              {/* Guardians selection removed */}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsStudentRequestModalOpen(false)}
                  disabled={loadingRequests}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loadingRequests}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 dark:bg-black"
                >
                  {loadingRequests ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t.submitting}
                    </>
                  ) : (
                    t.submit_request
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {successMessage.includes('Error') ? 'Error' : 'Success'}
              </h3>
              <button
                onClick={() => setIsSuccessModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className={`mb-4 text-sm ${successMessage.includes('Error') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {successMessage}
            </p>
            <button
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-black"
            >
              OK
            </button>
          </div>
        </div>
      )}

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

              {/* Guardians removed from edit modal */}

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
    </div>
  );
}

/* -------------------- Panels -------------------- */

// MessagesPanel removed - now in /dashboard/teacher/messages page
// MediaPanel removed - now in /dashboard/teacher/media page
// StoriesPanel removed - now in /dashboard/teacher/stories page

function AnnouncementsPanel({ t, lang, teacherClasses }: { t: typeof enText; lang: 'is' | 'en'; teacherClasses?: any[] }) {
  const { session } = useAuth();
  const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;
  const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
  
  // Get all teacher class IDs for filtering announcements
  const teacherClassIds = teacherClasses && teacherClasses.length > 0 
    ? teacherClasses.map(c => c.id).filter(Boolean) 
    : (classId ? [classId] : []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">{t.announcements_title}</h2>
        <AnnouncementForm
          classId={classId}
          orgId={orgId}
          lang={lang}
          showClassSelector={true}
          onSuccess={() => {
            // Trigger refresh event instead of reload
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('announcements-refresh'));
            }
          }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <AnnouncementList
          teacherClassIds={teacherClassIds}
          orgId={orgId}
          lang={lang}
        />
      </div>
    </div>
  );
}

function StudentsPanel({
  t,
  studentRequests,
  loadingRequests,
  students,
  loadingStudents,
  studentError,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  teacherClasses
}: {
  t: typeof enText;
  studentRequests: any[];
  loadingRequests: boolean;
  students: any[];
  loadingStudents: boolean;
  studentError: string | null;
  onAddStudent: () => void;
  onEditStudent?: (student: any) => void;
  onDeleteStudent?: (studentId: string) => void;
  teacherClasses?: any[];
}) {
  // Pending requests removed - teachers now create students directly
  const approvedRequests = studentRequests.filter(r => r.status === 'approved');
  const [approvedSearch, setApprovedSearch] = React.useState('');
  const [approvedPage, setApprovedPage] = React.useState(1);
  const approvedPerPage = 10;
  const rejectedRequests = studentRequests.filter(r => r.status === 'rejected');

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
      const guardianNames = '';
      
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.students_title}</h2>
        <button
          onClick={onAddStudent}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white dark:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
          {t.add_student_request}
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
            <div className="text-center py-4 text-slate-600 dark:text-slate-400">{t.loading}</div>
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

      

      {/* Approved Requests */}
      {approvedRequests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-md font-medium text-slate-900 dark:text-slate-100">{t.approved_requests}</h3>
            <div className="relative">
              <input
                type="text"
                value={approvedSearch}
                onChange={(e)=>{ setApprovedSearch(e.target.value); setApprovedPage(1); }}
                placeholder={'Search approved...'}
                className="pl-3 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black text-white dark:bg-slate-800 z-10">
                <tr className="text-left text-slate-100">
                  <th className="py-2 px-3">{t.student_name || 'Name'}</th>
                  <th className="py-2 px-3">{'Requested by'}</th>
                  <th className="py-2 px-3">{'Class'}</th>
                  <th className="py-2 px-3">{'Created at'}</th>
                  <th className="py-2 px-3">{t.status || 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {approvedRequests
                  .filter((r)=>{
                    const q = approvedSearch.trim().toLowerCase();
                    if (!q) return true;
                    const name = `${(r.first_name || '').toLowerCase()} ${(r.last_name || '').toLowerCase()}`.trim();
                    const cls = (r.class_name || r.classes?.name || '').toLowerCase();
                    const reqBy = ((r.requested_by_user?.email) || `${r.requested_by_user?.first_name || ''} ${r.requested_by_user?.last_name || ''}`.trim()).toLowerCase();
                    return name.includes(q) || cls.includes(q) || reqBy.includes(q);
                  })
                  .slice((approvedPage-1)*approvedPerPage, (approvedPage-1)*approvedPerPage + approvedPerPage)
                  .map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3">{request.first_name} {request.last_name}</td>
                      <td className="py-2 px-3">{request.requested_by_user ? ((`${request.requested_by_user.first_name || ''} ${request.requested_by_user.last_name || ''}`.trim()) || request.requested_by_user.email) : 'Unknown'}</td>
                      <td className="py-2 px-3">{request.class_name || request.classes?.name || request.class_id || '-'}</td>
                      <td className="py-2 px-3">
                        <span suppressHydrationWarning>{typeof window !== 'undefined' && request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">{t.approved}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 w-full flex justify-end">
            <div />
            <div className="flex items-center gap-2">
              <button onClick={()=>setApprovedPage(p=>Math.max(1,p-1))} disabled={approvedPage===1} className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">{'Prev'}</button>
              {Array.from({ length: Math.max(1, Math.ceil(approvedRequests.filter((r)=>{
                const q = approvedSearch.trim().toLowerCase();
                if (!q) return true;
                const name = `${(r.first_name || '').toLowerCase()} ${(r.last_name || '').toLowerCase()}`.trim();
                const cls = (r.class_name || r.classes?.name || '').toLowerCase();
                return name.includes(q) || cls.includes(q);
              }).length / approvedPerPage)) }).map((_, idx)=>(
                <button key={idx} onClick={()=>setApprovedPage(idx+1)} className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm ${approvedPage===idx+1 ? 'bg-white text-black border border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' : 'border border-slate-400 dark:border-slate-600 dark:text-slate-200'}`}>{idx+1}</button>
              ))}
              <button onClick={()=>setApprovedPage(p=>p+1)} disabled={(approvedPage*approvedPerPage) >= approvedRequests.filter((r)=>{
                const q = approvedSearch.trim().toLowerCase();
                if (!q) return true;
                const name = `${(r.first_name || '').toLowerCase()} ${(r.last_name || '').toLowerCase()}`.trim();
                const cls = (r.class_name || r.classes?.name || '').toLowerCase();
                return name.includes(q) || cls.includes(q);
              }).length} className="inline-flex items-center rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">{'Next'}</button>
            </div>
            <div />
          </div>
        </div>
      )}

      {/* Rejected Requests */}
      {rejectedRequests.length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-3 text-slate-900 dark:text-slate-100">{t.rejected_requests}</h3>
          <div className="space-y-2">
            {rejectedRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-600 dark:bg-red-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {request.first_name} {request.last_name}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {t.status}: <span className="text-red-700 dark:text-red-300">{t.rejected}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    {t.rejected}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- Copy -------------------- */

const enText = {
  title: 'Teacher Dashboard',
  kids_checked_in: 'Children checked in',
  today_hint: 'Today · Demo data',
  child: 'Child',
  time: 'Time',
  notes: 'Notes',
  save: 'Save',
  saved: 'Saved',
  today_menu: "Today's Menu",
  empty_menu: 'No menu available for today',

  // Tiles
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

  // Attendance
  att_title: 'Attendance & Check-in',
  att_mark_all_in: 'Mark all present',

  // Diapers/Health
  di_title: 'Diapers & Health Log',
  di_hint: 'Quickly capture diapers, naps, meds and temperature.',
  di_type: 'Type',
  di_wet: 'Wet',
  di_dirty: 'Dirty',
  di_mixed: 'Mixed',
  di_notes_ph: 'Optional notes…',

  // Messages
  msg_title: 'Messages',
  msg_hint: 'Parents and staff can receive updates here.',
  inbox: 'Inbox',
  unread: 'new',
  sample_msg: 'Hi! Just a reminder to bring rain gear tomorrow ☔',
  new_message: 'New message',
  to: 'To',
  message: 'Message',
  msg_ph: 'Write a friendly update…',
  send: 'Send',
  attach: 'Attach',
  sent: 'Sent',
  no_threads: 'No messages yet',
  no_messages: 'No messages in this thread',
  select_recipient: 'Select recipient',
  search_placeholder: 'Search conversations...',
  principal: 'Principal',
  guardian: 'Guardian',

  // Media
  media_title: 'Photos & Albums',
  upload: 'Upload',

  // Stories
  stories_title: 'Class Stories (24h)',
  add_story: 'Add story',
  add: 'Add',
  stories_hint:
    'Stories are only visible to guardians of enrolled children in this class and expire after 24 hours.',
  col_title: 'Title',
  col_scope: 'Scope',
  col_caption: 'Caption',
  no_caption: 'No Caption Added',
  view: 'View',
  delete_story: 'Delete Story',
  delete_story_confirm: 'Are you sure you want to delete this story? This action cannot be undone.',
  class_label: 'Class',
  org_wide: 'Organization-wide',
  loading_stories: 'Loading stories…',
  empty_stories: 'No stories yet.',

  // Announcements
  announcements_title: 'Announcements',
  announcements_list: 'Class Announcements',

  // Students
  tile_students: 'Students',
  tile_students_desc: 'Manage student requests and enrollment.',
  students_title: 'Student Requests',
  add_student_request: 'Add Student Request',
  existing_students: 'Existing Students',
  no_students_found: 'No students found in assigned classes',
  guardians: 'Guardians',
  pending_requests: 'Pending Requests',
  approved_requests: 'Approved Requests',
  rejected_requests: 'Rejected Requests',
  no_pending_requests: 'No pending requests',
  waiting_approval: 'Waiting for approval',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  status: 'Status',
  submit_request: 'Submit Request',
  submitting: 'Submitting...',
  student_first_name: 'First Name',
  student_last_name: 'Last Name',
  student_name: 'Student Name',
  student_dob: 'Date of Birth',
  student_gender: 'Gender',
  student_medical_notes: 'Medical Notes',
  student_allergies: 'Allergies',
  student_emergency_contact: 'Emergency Contact',
  student_first_name_placeholder: 'Enter first name',
  student_last_name_placeholder: 'Enter last name',
  student_medical_notes_placeholder: 'Enter medical notes (optional)',
  student_allergies_placeholder: 'Enter allergies (optional)',
  student_emergency_contact_placeholder: 'Enter emergency contact (optional)',
  student_child_value: 'Child Value',
  student_child_value_placeholder: '0.5 - 1.9',
  student_social_security_number: 'SSN',
  student_social_security_number_placeholder: '000000-0000',
  student_address: 'Address',
  student_address_placeholder: 'Enter address',
  student_registration_time: 'Registration Time',
  student_start_date: 'Start Date',
  student_phone: 'Phone',
  student_phone_placeholder: 'Enter phone number',
  student_class: 'Class',
  select_class: 'Select a class',
  no_classes_assigned: 'No classes assigned',
  gender_unknown: 'Unknown',
  gender_male: 'Male',
  gender_female: 'Female',
  gender_other: 'Other',
  cancel: 'Cancel',
  loading: 'Loading...',
  requested_date: 'Requested Date',
  search_students_placeholder: 'Search students...',
  no_students_found_search: 'No students found matching your search',
  no_students_in_class: 'No students in this class',
  all_classes: 'All Classes',
  prev: 'Prev',
  next: 'Next',
  actions: 'Actions',
  edit: 'Edit',
  delete: 'Delete',
  edit_student: 'Edit Student',
  delete_student: 'Delete Student',
  delete_student_confirm: 'Are you sure you want to delete this student? This action cannot be undone.',
  updating: 'Updating...',
  update: 'Update',
  deleting: 'Deleting...',
  no_guardians_available: 'No guardians available',
  select_multiple_guardians: 'Hold Ctrl/Cmd to select multiple guardians',
  send_magic_link: 'Send Magic Link',
  sending: 'Sending...',
  magic_link_sent_to_guardians: 'Magic link sent to {count} guardian(s)',
  magic_link_send_failed: 'Failed to send magic links',
  no_guardians_linked: 'No guardians linked to this student',
  submit_attendance: 'Submit Attendance',
  unsaved_changes: 'You have unsaved changes. Click "Submit Attendance" to save.',
};

const isText = {
  title: 'Kennarayfirlit',
  kids_checked_in: 'Börn skráð inn',
  today_hint: 'Í dag · Sýnagögn',
  child: 'Barn',
  time: 'Tími',
  notes: 'Athugasemdir',
  save: 'Vista',
  saved: 'Vistað',
  today_menu: 'Matseðill dagsins',
  empty_menu: 'Enginn matseðill tiltækur fyrir daginn',

  // Tiles
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
  tile_link_student: 'Tengja nemanda',
  tile_link_student_desc: 'Tengja forráðamann við nemanda.',
  tile_menus: 'Matseðillar',
  tile_menus_desc: 'Sýsla með daglega matseðla.',

  // Attendance
  att_title: 'Mæting & Inn-/útstimplun',
  att_mark_all_in: 'Skrá alla inn',

  // Diapers/Health
  di_title: 'Bleyju- og heilsuskráning',
  di_hint: 'Hraðskráning fyrir bleyjur, svefn, lyf og hita.',
  di_type: 'Tegund',
  di_wet: 'Vot',
  di_dirty: 'Skítug',
  di_mixed: 'Blanda',
  di_notes_ph: 'Valfrjálsar athugasemdir…',

  // Messages
  msg_title: 'Skilaboð',
  msg_hint: 'Foreldrar og starfsfólk fá uppfærslur hér.',
  inbox: 'Innhólf',
  unread: 'ný',
  sample_msg: 'Hæ! Vinsamlegast munið eftir regnfötum á morgun ☔',
  new_message: 'Ný skilaboð',
  to: 'Til',
  message: 'Skilaboð',
  msg_ph: 'Skrifaðu vingjarnlega uppfærslu…',
  send: 'Senda',
  attach: 'Hengja við',
  sent: 'Sent',
  no_threads: 'Engin skilaboð enn',
  no_messages: 'Engin skilaboð í þessum þræði',
  select_recipient: 'Veldu viðtakanda',
  search_placeholder: 'Leita í samtalum...',
  principal: 'Stjórnandi',
  guardian: 'Forráðamaður',

  // Media
  media_title: 'Myndir & Albúm',
  upload: 'Hlaða upp',

  // Stories
  stories_title: 'Hópsögur (24 klst)',
  add_story: 'Bæta við sögu',
  add: 'Bæta við',
  stories_hint:
    'Sögur eru einungis sýnilegar forráðafólki barna í hópnum og hverfa eftir 24 klst.',
  col_title: 'Titill',
  col_scope: 'Svið',
  col_caption: 'Lýsing',
  no_caption: 'Engin lýsing bætt við',
  view: 'Skoða',
  delete_story: 'Eyða sögu',
  delete_story_confirm: 'Ertu viss um að þú viljir eyða þessari sögu? Þessa aðgerð er ekki hægt að afturkalla.',
  class_label: 'Hópur',
  org_wide: 'Stofnunarvítt',
  loading_stories: 'Hleður sögum…',
  empty_stories: 'Engar sögur fundust.',

  // Announcements
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Stofna og skoða tilkynningar',
  announcements_title: 'Tilkynningar',
  announcements_list: 'Tilkynningar hóps',

  // Students
  tile_students: 'Nemendur',
  tile_students_desc: 'Sýsla með beiðnir nemenda og skráningu.',
  students_title: 'Beiðnir nemenda',
  add_student_request: 'Bæta við beiðni nemanda',
  existing_students: 'Núverandi nemendur',
  no_students_found: 'Engir nemendur fundust í úthlutuðum hópum',
  guardians: 'Forráðamenn',
  pending_requests: 'Bíðandi beiðnir',
  approved_requests: 'Samþykktar beiðnir',
  rejected_requests: 'Hafnaðar beiðnir',
  no_pending_requests: 'Engar bíðandi beiðnir',
  waiting_approval: 'Bíður samþykkis',
  pending: 'Bíður',
  approved: 'Samþykkt',
  rejected: 'Hafnað',
  status: 'Staða',
  submit_request: 'Senda beiðni',
  submitting: 'Sendi...',
  student_first_name: 'Fornafn',
  student_last_name: 'Eftirnafn',
  student_name: 'Nafn nemanda',
  student_dob: 'Fæðingardagur',
  student_gender: 'Kyn',
  student_medical_notes: 'Læknisfræðilegar athugasemdir',
  student_allergies: 'Ofnæmi',
  student_emergency_contact: 'Neyðarsamband',
  student_first_name_placeholder: 'Sláðu inn fornafn',
  student_last_name_placeholder: 'Sláðu inn eftirnafn',
  student_medical_notes_placeholder: 'Sláðu inn læknisfræðilegar athugasemdir (valfrjálst)',
  student_allergies_placeholder: 'Sláðu inn ofnæmi (valfrjálst)',
  student_emergency_contact_placeholder: 'Sláðu inn neyðarsamband (valfrjálst)',
  student_child_value: 'Barna gildi',
  student_child_value_placeholder: '0.5 - 1.9',
  student_social_security_number: 'Kennitala',
  student_social_security_number_placeholder: '000000-0000',
  student_address: 'Heimilisfang',
  student_address_placeholder: 'Sláðu inn heimilisfang',
  student_registration_time: 'Skráningartími',
  student_start_date: 'Upphafsdagur',
  student_phone: 'Sími',
  student_phone_placeholder: 'Sláðu inn símanúmer',
  student_class: 'Hópur',
  select_class: 'Veldu hóp',
  no_classes_assigned: 'Engir hópar úthlutaðir',
  gender_unknown: 'Óþekkt',
  gender_male: 'Karl',
  gender_female: 'Kona',
  gender_other: 'Annað',
  cancel: 'Hætta við',
  loading: 'Hleður...',
  requested_date: 'Beiðnidagsetning',
  search_students_placeholder: 'Leita að nemendum...',
  no_students_found_search: 'Engir nemendur fundust sem passa við leit',
  no_students_in_class: 'Engir nemendur í þessum hóp',
  all_classes: 'Allir hópar',
  prev: 'Fyrri',
  next: 'Næsta',
  actions: 'Aðgerðir',
  edit: 'Breyta',
  delete: 'Eyða',
  edit_student: 'Breyta nemanda',
  delete_student: 'Eyða nemanda',
  delete_student_confirm: 'Ertu viss um að þú viljir eyða þessum nemanda? Þessa aðgerð er ekki hægt að afturkalla.',
  updating: 'Uppfæri...',
  update: 'Uppfæra',
  deleting: 'Eyði...',
  no_guardians_available: 'Engir forráðamenn í boði',
  select_multiple_guardians: 'Haltu niðri Ctrl/Cmd til að velja fleiri forráðamenn',
  send_magic_link: 'Senda töfraslóð',
  sending: 'Sendi...',
  magic_link_sent_to_guardians: 'Töfraslóð send til {count} forráðamanns',
  magic_link_send_failed: 'Tókst ekki að senda töfraslóð',
  no_guardians_linked: 'Engir forráðamenn tengdir við þennan nemanda',
  submit_attendance: 'Vista mætingu',
  unsaved_changes: 'Þú hefur óvistaðar breytingar. Smelltu á "Vista mætingu" til að vista.',
};

// Announcements Panel Component
function MenuPanel({ t, lang }: { t: typeof enText; lang: 'is' | 'en' }) {
  const { session } = useAuth();
  const [menu, setMenu] = useState<{ breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null } | null>(null);
  const [menus, setMenus] = useState<Array<{ breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null; class_name?: string }>>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      if (!session?.user?.id) return;

      try {
        setError(null);
        setMenuLoading(true);

        const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
        const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;

        if (!orgId) {
          if (isMounted) {
            setMenus([]);
            setMenuLoading(false);
          }
          return;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        let allMenus: Array<{ class_id?: string | null; class_name?: string; breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null }> = [];

        // Get teacher's assigned classes
        let teacherClasses: Array<{ id: string; name: string }> = [];
        if (session?.user?.id) {
          try {
            const teacherClassesRes = await fetch(`/api/teacher-classes?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
            const teacherClassesData = await teacherClassesRes.json();
            teacherClasses = teacherClassesData.classes || [];
          } catch (e) {
            console.error('Error loading teacher classes:', e);
          }
        }

        const teacherClassIds = teacherClasses.map((c: any) => c.id);

        // Fetch menus for each assigned class in parallel - filter by created_by to show only teacher's menus
        const classMenuPromises = (teacherClassIds.length > 0 ? teacherClassIds : (classId ? [classId] : [])).map(async (cid: string) => {
          try {
            const { data: classMenu, error: classMenuErr } = await supabase
              .from('menus')
              .select('class_id,breakfast,lunch,snack,notes,day,created_by')
              .eq('org_id', orgId)
              .eq('class_id', cid)
              .eq('day', todayStr)
              .eq('created_by', session.user.id) // Filter by created_by
              .is('deleted_at', null)
              .maybeSingle();
            
            if (classMenu) {
              const className = teacherClasses.find(c => c.id === cid)?.name || 'Class';
              return {
                ...classMenu,
                class_name: className
              };
            } else if (classMenuErr && classMenuErr.code !== 'PGRST116') {
              console.error(`Error fetching menu for class ${cid}:`, classMenuErr);
              return null;
            }
            return null;
          } catch (e) {
            console.error(`Error fetching menu for class ${cid}:`, e);
            return null;
          }
        });

        // Wait for all class menu queries to complete
        const classMenuResults = await Promise.all(classMenuPromises);
        const validClassMenus = classMenuResults.filter((menu): menu is NonNullable<typeof menu> => menu !== null);
        allMenus.push(...validClassMenus);

        // Also get org-wide menu (class_id null) created by this teacher if exists
        const { data: orgMenu, error: orgMenuErr } = await supabase
          .from('menus')
          .select('class_id,breakfast,lunch,snack,notes,day,created_by')
          .eq('org_id', orgId)
          .is('class_id', null)
          .eq('day', todayStr)
          .eq('created_by', session.user.id) // Filter by created_by
          .is('deleted_at', null)
          .maybeSingle();
        
        if (orgMenu) {
          allMenus.push({
            ...orgMenu,
            class_name: 'All Classes'
          });
        } else if (orgMenuErr && orgMenuErr.code !== 'PGRST116') {
          throw orgMenuErr;
        }

        if (isMounted) {
          setMenus(allMenus);
          setMenuLoading(false);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || 'Failed to load menu');
          setMenuLoading(false);
        }
      }
    }

    loadMenu();
    return () => { isMounted = false; };
  }, [session]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t.today_menu || "Today's Menu"}
        </h2>
        <div className="text-sm text-slate-500 dark:text-slate-400" suppressHydrationWarning>
          {mounted ? new Date().toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }) : ''}
        </div>
      </div>
      
      {menuLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      ) : menus.length === 0 ? (
        <div className="text-center py-6">
          <Utensils className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty_menu}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {menus.map((menu, idx) => (
            <div key={idx} className="space-y-3">
              {menu.class_name && (
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
                  {menu.class_name}
                </div>
              )}
              {menu.breakfast && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-100">08:30</div>
                    <div className="text-sm text-amber-700 dark:text-amber-300">{menu.breakfast}</div>
                  </div>
                </div>
              )}
              {menu.lunch && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">12:00</div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">{menu.lunch}</div>
                  </div>
                </div>
              )}
              {menu.snack && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900 dark:text-green-100">14:00</div>
                    <div className="text-sm text-green-700 dark:text-green-300">{menu.snack}</div>
                  </div>
                </div>
              )}
              {menu.notes && (
                <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.notes || 'Notes'}</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">{menu.notes}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuardiansPanel({ t, lang, orgId }: { t: typeof enText; lang: Lang; orgId: string | undefined }) {
  const [guardians, setGuardians] = useState<Array<any>>([]);
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [isDeleteGuardianModalOpen, setIsDeleteGuardianModalOpen] = useState(false);
  const [guardianToDelete, setGuardianToDelete] = useState<string | null>(null);
  const [deletingGuardian, setDeletingGuardian] = useState(false);
  const [submittingGuardian, setSubmittingGuardian] = useState(false);
  const [guardianForm, setGuardianForm] = useState<GuardianFormData>({ first_name: '', last_name: '', email: '', phone: '', org_id: orgId || '', is_active: true });
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string; timezone: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const router = useRouter();

  useEffect(() => {
    if (orgId) {
      loadGuardians();
      loadOrgs();
    }
  }, [orgId]);

  async function loadGuardians() {
    if (!orgId) return;
    try {
      setLoadingGuardians(true);
      setGuardianError(null);
      const res = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setGuardians(json.guardians || []);
    } catch (e: any) {
      console.error('❌ Error loading guardians:', e.message);
      setGuardianError(e.message);
    } finally {
      setLoadingGuardians(false);
    }
  }

  async function loadOrgs() {
    try {
      const res = await fetch('/api/orgs', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setOrgs(json.orgs || []);
    } catch (e: any) {
      console.error('❌ Error loading organizations:', e.message);
    }
  }

  async function submitGuardian(data: GuardianFormData) {
    try {
      setGuardianError(null);
      setSubmittingGuardian(true);
      const res = await fetch('/api/guardians', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsGuardianModalOpen(false);
      setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: orgId || '', is_active: true });
      await loadGuardians();
    } catch (e: any) {
      console.error('❌ Error submitting guardian:', e.message);
      setGuardianError(e.message);
    } finally {
      setSubmittingGuardian(false);
    }
  }

  function openCreateGuardianModal() {
    setGuardianForm({ first_name: '', last_name: '', email: '', phone: '', org_id: orgId || '', is_active: true });
    setIsGuardianModalOpen(true);
  }

  function openEditGuardianModal(guardian: any) {
    setGuardianForm({
      id: guardian.id,
      first_name: guardian.first_name ?? ((guardian.full_name || '').split(/\s+/)[0] || ''),
      last_name: guardian.last_name ?? ((guardian.full_name || '').split(/\s+/).slice(1).join(' ') || ''),
      email: guardian.email ?? '',
      phone: guardian.phone ?? '',
      org_id: guardian.org_id || orgId || '',
      is_active: guardian.is_active ?? true
    });
    setIsGuardianModalOpen(true);
  }

  function openDeleteGuardianModal(id: string) {
    setGuardianToDelete(id);
    setIsDeleteGuardianModalOpen(true);
  }

  async function confirmDeleteGuardian() {
    if (!guardianToDelete) return;
    try {
      setGuardianError(null);
      setDeletingGuardian(true);
      const res = await fetch(`/api/guardians?id=${encodeURIComponent(guardianToDelete)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      setIsDeleteGuardianModalOpen(false);
      setGuardianToDelete(null);
      await loadGuardians();
    } catch (e: any) {
      setGuardianError(e.message);
    } finally {
      setDeletingGuardian(false);
    }
  }

  const filteredGuardians = searchQuery ? guardians.filter((g: any) => {
    const q = searchQuery.trim().toLowerCase();
    const first = ((g.first_name ?? ((g.full_name || '').split(/\s+/)[0] || ''))).toLowerCase();
    const last = ((g.last_name ?? (((g.full_name || '').split(/\s+/).slice(1).join(' ')) || ''))).toLowerCase();
    const email = ((g.email || '')).toLowerCase();
    return first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q) || email.includes(q);
  }) : guardians;

  const paginatedGuardians = filteredGuardians.slice((currentPage-1)*itemsPerPage, (currentPage-1)*itemsPerPage + itemsPerPage);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.tile_guardians || 'Guardians'}</h2>
        <button
          onClick={openCreateGuardianModal}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við forráðamanni' : 'Add Guardian'}
        </button>
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder={lang === 'is' ? 'Leita...' : 'Search guardians...'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        />
      </div>
      <GuardianTable
        guardians={paginatedGuardians.map((g: any) => ({
          id: g.id,
          first_name: g.first_name ?? ((g.full_name || '').trim().split(/\s+/)[0] || ''),
          last_name: g.last_name ?? ((g.full_name || '').trim().split(/\s+/).slice(1).join(' ') || ''),
          email: g.email ?? null,
          phone: g.phone ?? null,
          is_active: g.is_active ?? true,
        }))}
        error={guardianError}
        onEdit={openEditGuardianModal}
        onDelete={openDeleteGuardianModal}
        onCreate={openCreateGuardianModal}
        translations={{
          guardians: t.tile_guardians || 'Guardians',
          first_name: lang === 'is' ? 'Fornafn' : 'First Name',
          last_name: lang === 'is' ? 'Eftirnafn' : 'Last Name',
          email: lang === 'is' ? 'Netfang' : 'Email',
          phone: lang === 'is' ? 'Sími' : 'Phone',
          status: lang === 'is' ? 'Staða' : 'Status',
          active: lang === 'is' ? 'Virkur' : 'Active',
          inactive: lang === 'is' ? 'Óvirkur' : 'Inactive',
          actions: lang === 'is' ? 'Aðgerðir' : 'Actions',
          create: lang === 'is' ? 'Búa til' : 'Create',
          no_guardians: lang === 'is' ? 'Engir forráðamenn' : 'No guardians',
          no_guardians_loading: lang === 'is' ? 'Hleður...' : 'Loading...',
          edit: lang === 'is' ? 'Breyta' : 'Edit',
          delete: lang === 'is' ? 'Eyða' : 'Delete',
          send_magic_link: lang === 'is' ? 'Senda töfraslóð' : 'Send Magic Link',
          sending: lang === 'is' ? 'Sendi...' : 'Sending...',
          magic_link_sent: lang === 'is' ? 'Töfraslóð send' : 'Magic link sent',
          magic_link_send_failed: lang === 'is' ? 'Tókst ekki að senda töfraslóð' : 'Failed to send magic link',
          no_students_linked: lang === 'is' ? 'Engir nemendur tengdir' : 'No students linked',
        }}
      />
      {filteredGuardians.length > itemsPerPage && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {lang === 'is' ? 'Fyrri' : 'Prev'}
          </button>
          <span className="px-3 py-1.5 text-sm">{currentPage} / {Math.ceil(filteredGuardians.length / itemsPerPage)}</span>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage >= Math.ceil(filteredGuardians.length / itemsPerPage)}
            className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {lang === 'is' ? 'Næsta' : 'Next'}
          </button>
        </div>
      )}
      <GuardianForm
        isOpen={isGuardianModalOpen}
        onClose={() => setIsGuardianModalOpen(false)}
        onSubmit={submitGuardian}
        initialData={guardianForm}
        loading={submittingGuardian}
        error={guardianError}
        orgs={orgs}
        translations={{
          create_guardian: lang === 'is' ? 'Búa til forráðamann' : 'Create Guardian',
          edit_guardian: lang === 'is' ? 'Breyta forráðamanni' : 'Edit Guardian',
          first_name: lang === 'is' ? 'Fornafn' : 'First Name',
          last_name: lang === 'is' ? 'Eftirnafn' : 'Last Name',
          email: lang === 'is' ? 'Netfang' : 'Email',
          phone: lang === 'is' ? 'Sími' : 'Phone',
          organization: lang === 'is' ? 'Stofnun' : 'Organization',
          status: lang === 'is' ? 'Staða' : 'Status',
          active: lang === 'is' ? 'Virkur' : 'Active',
          inactive: lang === 'is' ? 'Óvirkur' : 'Inactive',
          create: lang === 'is' ? 'Búa til' : 'Create',
          update: lang === 'is' ? 'Uppfæra' : 'Update',
          cancel: lang === 'is' ? 'Hætta við' : 'Cancel',
          creating: lang === 'is' ? 'Býr til...' : 'Creating...',
          updating: lang === 'is' ? 'Uppfærir...' : 'Updating...',
          first_name_placeholder: lang === 'is' ? 'Sláðu inn fornafn' : 'Enter first name',
          last_name_placeholder: lang === 'is' ? 'Sláðu inn eftirnafn' : 'Enter last name',
          email_placeholder: lang === 'is' ? 'Sláðu inn netfang' : 'Enter email address',
          phone_placeholder: lang === 'is' ? 'Sláðu inn símanúmer' : 'Enter phone number',
          status_placeholder: lang === 'is' ? 'Veldu stöðu' : 'Select status',
        }}
      />
      <DeleteConfirmationModal
        isOpen={isDeleteGuardianModalOpen}
        onClose={() => setIsDeleteGuardianModalOpen(false)}
        onConfirm={confirmDeleteGuardian}
        title={lang === 'is' ? 'Eyða forráðamanni' : 'Delete Guardian'}
        message={lang === 'is' ? 'Ertu viss um að þú viljir eyða þessum forráðamanni?' : 'Are you sure you want to delete this guardian?'}
        loading={deletingGuardian}
        error={guardianError}
        translations={{
          confirm_delete: lang === 'is' ? 'Eyða' : 'Delete',
          cancel: lang === 'is' ? 'Hætta við' : 'Cancel',
        }}
      />
    </div>
  );
}

function LinkStudentPanel({ t, lang }: { t: typeof enText; lang: Lang }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <LinkStudentGuardian lang={lang} />
    </div>
  );
}

function MenusPanel({ t, lang, orgId, userId, isActive = false }: { t: typeof enText; lang: Lang; orgId: string | undefined; userId: string | undefined; isActive?: boolean }) {
  const [menus, setMenus] = useState<Array<{ id: string; org_id: string; class_id?: string | null; day: string; breakfast?: string | null; lunch?: string | null; snack?: string | null; notes?: string | null; created_at?: string; classes?: { id: string; name: string } }>>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: string; name: string }>>([]);
  const router = useRouter();

  // Load menus ONLY when panel is active
  useEffect(() => {
    if (isActive && orgId && userId) {
      loadMenus();
    }
  }, [isActive, orgId, userId]);

  // Listen for menu updates (when menu is created/edited from add-menu page)
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;
    
    const handleMenuUpdate = () => {
      // Clear cache and reload
      if (userId) {
        localStorage.removeItem(`teacher_menus_cache_${userId}`);
      }
      if (orgId && userId) {
        loadMenus();
      }
    };
    
    window.addEventListener('menu-updated', handleMenuUpdate);
    
    // Also check localStorage flag on mount
    if (userId) {
      const menuUpdated = localStorage.getItem('menu_data_updated');
      if (menuUpdated === 'true') {
        localStorage.removeItem('menu_data_updated');
        handleMenuUpdate();
      }
    }
    
    return () => {
      window.removeEventListener('menu-updated', handleMenuUpdate);
    };
  }, [isActive, orgId, userId]);

  async function loadMenus() {
    if (!orgId || !userId) return;
    
    // Load cached data first
    if (typeof window !== 'undefined') {
      try {
        const cachedMenus = localStorage.getItem(`teacher_menus_cache_${userId}`);
        const cachedClasses = localStorage.getItem('teacher_classes_cache');
        if (cachedMenus) {
          const parsed = JSON.parse(cachedMenus);
          if (Array.isArray(parsed)) setMenus(parsed);
        }
        if (cachedClasses) {
          const parsed = JSON.parse(cachedClasses);
          if (Array.isArray(parsed)) setTeacherClasses(parsed);
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    try {
      setLoadingMenus(true);
      setError(null);
      
      // Load teacher classes (use cache if available)
      let classes: any[] = [];
      if (teacherClasses.length === 0) {
        try {
          const teacherClassesRes = await fetch(`/api/teacher-classes?userId=${userId}&t=${Date.now()}`, { cache: 'no-store' });
          const teacherClassesData = await teacherClassesRes.json();
          classes = teacherClassesData.classes || [];
          setTeacherClasses(classes);
          
          // Cache classes
          if (typeof window !== 'undefined') {
            localStorage.setItem('teacher_classes_cache', JSON.stringify(classes));
          }
        } catch (e: any) {
          console.warn('⚠️ Error loading teacher classes:', e.message);
          // Continue with cached classes if available
          classes = teacherClasses;
        }
      } else {
        classes = teacherClasses;
      }
      
      // Optimize: Use single API call to get all menus for the user
      // Instead of multiple calls per class, fetch all at once
      let allMenus: any[] = [];
      try {
        const res = await fetch(`/api/menus?orgId=${orgId}&createdBy=${userId}`, { cache: 'no-store' });
        const json = await res.json();
        
        if (res.ok && json.menus) {
          allMenus = (json.menus || []).map((m: any) => ({
            ...m,
            classes: m.class_id ? (classes.find((c: any) => c.id === m.class_id) || null) : null
          }));
        } else if (res.status === 429) {
          // Rate limit error
          setError('Too many requests. Please wait a moment and try again.');
          // Use cached data if available
          return;
        } else {
          throw new Error(json.error || `Failed with ${res.status}`);
        }
      } catch (fetchError: any) {
        if (fetchError.message?.includes('rate limit') || fetchError.message?.includes('429')) {
          setError('Request rate limit reached. Please wait a moment and refresh.');
          console.warn('⚠️ Rate limit reached, using cached data');
          return;
        }
        throw fetchError;
      }
      
      setMenus(allMenus);
      
      // Cache menus
      if (typeof window !== 'undefined') {
        localStorage.setItem(`teacher_menus_cache_${userId}`, JSON.stringify(allMenus));
      }
    } catch (e: any) {
      console.error('❌ Error loading menus:', e);
      setError(e.message || 'Failed to load menus');
    } finally {
      setLoadingMenus(false);
    }
  }

  function openDeleteModal(menuId: string) {
    setMenuToDelete(menuId);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false);
    setMenuToDelete(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!menuToDelete) return;
    
    setDeletingMenu(true);
    setDeleteError(null);
    
    try {
      const res = await fetch(`/api/menus?id=${menuToDelete}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Failed to delete menu: ${res.status}`);
      }
      
      // Remove from local state
      setMenus(prev => prev.filter(m => m.id !== menuToDelete));
      
      // Update cache
      if (typeof window !== 'undefined') {
        const updatedMenus = menus.filter(m => m.id !== menuToDelete);
        localStorage.setItem(`teacher_menus_cache_${userId}`, JSON.stringify(updatedMenus));
      }
      
      closeDeleteModal();
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeletingMenu(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.tile_menus || 'Menus'}</h2>
        <button
          onClick={() => router.push('/dashboard/add-menu')}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" /> {lang === 'is' ? 'Bæta við matseðli' : 'Add Menu'}
        </button>
      </div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}
      {loadingMenus ? (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">{lang === 'is' ? 'Hleður...' : 'Loading...'}</div>
      ) : menus.length === 0 ? (
        <div className="text-center py-12">
          <Utensils className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{lang === 'is' ? 'Engir matseðillar fundust. Smelltu á "Bæta við matseðli" til að búa til einn.' : 'No menus found. Click "Add Menu" to create one.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black">
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Dagur' : 'Date'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Hópur' : 'Class'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Morgunmatur' : 'Breakfast'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Hádegismatur' : 'Lunch'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Kvöldmatur' : 'Snack'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {lang === 'is' ? 'Athugasemdir' : 'Notes'}
                </th>
                <th className="text-left py-2 px-4 text-sm font-medium text-white dark:text-slate-300">
                  {t.actions || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {menus.map((menu) => (
                <tr key={menu.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-2 px-4 text-sm text-slate-900 dark:text-slate-100">
                    {menu.day ? (
                      <span suppressHydrationWarning>
                        {typeof window !== 'undefined' ? new Date(menu.day).toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : ''}
                      </span>
                    ) : (
                      menu.created_at ? (
                        <span suppressHydrationWarning>
                          {typeof window !== 'undefined' ? new Date(menu.created_at).toLocaleDateString(lang === 'is' ? 'is-IS' : 'en-US') : ''}
                        </span>
                      ) : (
                        '—'
                      )
                    )}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.classes?.name || (menu.class_id ? `Class ${menu.class_id.substring(0, 8)}...` : lang === 'is' ? 'Allir hópar' : 'All Classes')}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.breakfast || '—'}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.lunch || '—'}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.snack || '—'}
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {menu.notes ? (
                      <span className="line-clamp-2" title={menu.notes}>{menu.notes}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/add-menu?id=${menu.id}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[13px] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        title={t.edit || 'Edit'}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        {t.edit || 'Edit'}
                      </button>
                      <button
                        onClick={() => openDeleteModal(menu.id)}
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={lang === 'is' ? 'Eyða matseðli' : 'Delete Menu'}
        message={lang === 'is' ? 'Ertu viss um að þú viljir eyða þessum matseðli? Þessa aðgerð er ekki hægt að afturkalla.' : 'Are you sure you want to delete this menu? This action cannot be undone.'}
        loading={deletingMenu}
        error={deleteError}
        confirmButtonText={t.delete || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />
    </div>
  );
}
