'use client';
import React, { useMemo, useState } from 'react';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Users, CalendarDays, Plus, Send, Paperclip, Bell, X } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import AnnouncementForm from './AnnouncementForm';
import AnnouncementList from './AnnouncementList';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}
const uid = () => Math.random().toString(36).slice(2, 9);

export default function TeacherDashboard({ lang = 'en' }: { lang?: Lang }) {
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const [active, setActive] = useState<TileId>('attendance');
  const { session } = useAuth();

  // ---- Demo data / state ----
  const [roster, setRoster] = useState(
    Array.from({ length: 15 }).map((_, i) => ({
      id: i + 1,
      name: `${t.child} ${i + 1}`,
      present: i % 3 !== 0, // just some demo variation
    }))
  );
  const kidsIn = roster.filter((r) => r.present).length;

  const [threads] = useState([
    { id: uid(), name: 'Guðrún (Parent)', preview: t.sample_msg, unread: true },
    { id: uid(), name: 'Ásgeir (Parent)', preview: t.sample_msg, unread: false },
    { id: uid(), name: 'Hópur: Gulikjarni', preview: t.sample_msg, unread: false },
  ]);

  const [uploads, setUploads] = useState<string[]>([]); // data URLs for image previews

  // Student request states
  const [studentRequests, setStudentRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isStudentRequestModalOpen, setIsStudentRequestModalOpen] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [studentRequestForm, setStudentRequestForm] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'unknown',
    medical_notes: '',
    allergies: '',
    emergency_contact: '',
    class_id: ''
  });

  // Metadata fix state to prevent infinite loops
  const [metadataFixAttempted, setMetadataFixAttempted] = useState(false);

  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
  }> = [
      { id: 'attendance', title: t.tile_att, desc: t.tile_att_desc, Icon: CheckSquare, badge: kidsIn },
      { id: 'diapers', title: t.tile_diaper, desc: t.tile_diaper_desc, Icon: Baby },
      { id: 'messages', title: t.tile_msg, desc: t.tile_msg_desc, Icon: MessageSquare, badge: threads.filter(x => x.unread).length || undefined },
      { id: 'media', title: t.tile_media, desc: t.tile_media_desc, Icon: Camera, badge: uploads.length || undefined },
      { id: 'stories', title: t.tile_stories, desc: t.tile_stories_desc, Icon: Timer },
      { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell },
      { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users, badge: studentRequests.filter(r => r.status === 'pending').length || undefined },
    ];

  // ---- Attendance actions ----
  function togglePresent(id: number, checked: boolean) {
    setRoster((prev) => prev.map((r) => (r.id === id ? { ...r, present: checked } : r)));
  }
  function markAllPresent() {
    setRoster((prev) => prev.map((r) => ({ ...r, present: true })));
  }

  // ---- Media actions (mock) ----
  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files).slice(0, 12).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setUploads((prev) => [...prev, String(reader.result)]);
      reader.readAsDataURL(file);
    });
  }

  // ---- Student request actions ----
  async function loadTeacherClasses() {
    try {
      setLoadingClasses(true);
      const userId = session?.user?.id;

      if (!userId) {
        console.error('No user ID available');
        return;
      }

      console.log('Loading classes for teacher:', userId);
      console.log('Session user metadata:', session?.user?.user_metadata);

      // Fetch teacher's assigned classes
      const response = await fetch(`/api/teacher-classes?userId=${userId}`);
      const data = await response.json();

      console.log('API Response:', data);

      if (response.ok) {
        setTeacherClasses(data.classes || []);
        console.log('Teacher classes loaded:', data.classes);

        // If no classes found, show a message
        if (!data.classes || data.classes.length === 0) {
          console.warn('No classes assigned to this teacher');
        }
      } else {
        console.error('Error loading teacher classes:', data.error);
      }
    } catch (error) {
      console.error('Error loading teacher classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  }

  async function loadStudentRequests() {
    try {
      setLoadingRequests(true);

      // Get teacher's assigned classes first
      if (teacherClasses.length === 0) {
        console.log('No classes assigned to teacher, skipping student requests load');
        setStudentRequests([]);
        return;
      }

      // Load student requests for all assigned classes
      const classIds = teacherClasses.map(cls => cls.id).join(',');
      const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

      console.log('Loading student requests for classes:', classIds, 'Org ID:', orgId);

      const response = await fetch(`/api/student-requests?classIds=${classIds}&orgId=${orgId}`);
      const data = await response.json();

      if (response.ok) {
        // Enhance the student requests with class names from teacherClasses
        const enhancedRequests = (data.student_requests || []).map((request: any) => {
          const classInfo = teacherClasses.find(cls => cls.id === request.class_id);
          return {
            ...request,
            class_name: classInfo?.name || `Class ${request.class_id?.slice(0, 8)}...`
          };
        });
        setStudentRequests(enhancedRequests);
      } else {
        console.error('Error loading student requests:', data.error);
      }
    } catch (error) {
      console.error('Error loading student requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function submitStudentRequest(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoadingRequests(true);

      const classId = studentRequestForm.class_id;
      const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';
      const requestedBy = session?.user?.id;

      console.log('Submit - Using selected class');
      console.log('Submit - Class ID:', classId);
      console.log('Submit - Org ID:', orgId);
      console.log('Submit - Requested By:', requestedBy);

      if (!requestedBy) {
        alert('Missing user ID - Please check if you are properly logged in');
        return;
      }

      if (!classId) {
        alert('Please select a class for the student');
        return;
      }

      const response = await fetch('/api/student-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studentRequestForm,
          class_id: classId,
          org_id: orgId,
          requested_by: requestedBy
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Student request submitted successfully! Waiting for principal approval.');
        setStudentRequestForm({
          first_name: '',
          last_name: '',
          dob: '',
          gender: 'unknown',
          medical_notes: '',
          allergies: '',
          emergency_contact: '',
          class_id: ''
        });
        setIsStudentRequestModalOpen(false);
        loadStudentRequests();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoadingRequests(false);
    }
  }

  // Load student requests when session is available
  React.useEffect(() => {
    if (session) {
      // First create the table if it doesn't exist, then load data
      createTableAndLoadData();
      // Also load teacher's classes
      loadTeacherClasses();
    }
  }, [session]);

  // Load student requests when teacher classes are loaded
  React.useEffect(() => {
    if (teacherClasses.length > 0) {
      loadStudentRequests();
    }
  }, [teacherClasses]);

  // Debug function to check teacher data
//   async function debugTeacherData() {
//     try {
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

  // Create table and load data
  async function createTableAndLoadData() {
    try {
      console.log('🏗️ Creating student_requests table...');
      const createResponse = await fetch('/api/create-student-requests-table', {
        method: 'POST'
      });

      const createData = await createResponse.json();
      console.log('📊 Create table result:', createData);

      if (createResponse.ok) {
        console.log('✅ Table created successfully, loading data...');
        loadStudentRequests();
      } else {
        console.error('❌ Failed to create table:', createData.error);
      }
    } catch (error) {
      console.error('💥 Error creating table:', error);
    }
  }

  // Function to fix missing user metadata
  async function fixUserMetadata() {
    try {
      const userId = session?.user?.id;
      if (!userId) return;

      console.log('🔧 Fixing metadata for user:', userId);

      // Use default values for now - in a real app, you'd get these from context or database
      const defaultOrgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'default-org-id';
      const defaultClassId = 'default-class-id';

      console.log('📝 Using default values:', { defaultOrgId, defaultClassId });

      // Update the user's metadata with the default org_id and class_id
      const updateResponse = await fetch('/api/teacher-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          org_id: defaultOrgId,
          class_id: defaultClassId
        })
      });

      const updateData = await updateResponse.json();
      console.log('📊 Update response:', updateData);

      if (updateResponse.ok) {
        console.log('✅ Metadata updated successfully');
        // Instead of reloading, just load student requests directly
        // The session will be updated on next auth state change
        loadStudentRequests();
      } else {
        console.error('❌ Failed to update metadata:', updateData.error);
      }
    } catch (error) {
      console.error('💥 Error fixing metadata:', error);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Dashboard header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>

        {/* Switch profile control (only shows if the user has multiple roles) */}
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
          {/* <button
            onClick={debugTeacherData}
            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300"
          >
            Debug
          </button>
          <button
            onClick={debugClassMemberships}
            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-300"
          >
            Debug Memberships
          </button>
          <button
            onClick={assignTeacherToClass}
            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300"
          >
            Assign Class
          </button>
          <button
            onClick={testClassExists}
            className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-300"
          >
            Test Class
          </button> */}
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Users className="h-4 w-4" />
            <span>
              {t.kids_checked_in}:{' '}
              <span className="font-medium">{kidsIn}</span> / {roster.length}
            </span>
            <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
            <CalendarDays className="h-4 w-4" />
            <span>{t.today_hint}</span>
          </div>
        </div>

        {/* Small-screen stats row */}
        <div className="md:hidden flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Users className="h-4 w-4" />
          <span>
            {t.kids_checked_in}:{' '}
            <span className="font-medium">{kidsIn}</span> / {roster.length}
          </span>
          <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
          <CalendarDays className="h-4 w-4" />
          <span>{t.today_hint}</span>
        </div>
      </div>

      {/* Feature tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map(({ id, title, desc, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={clsx(
              'group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800',
              active === id && 'ring-2 ring-slate-300 dark:ring-slate-600'
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <span className="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                  <Icon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{title}</span>
              </span>
              {badge !== undefined && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300">{badge}</span>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <section className="mt-8">
        {active === 'attendance' && (
          <AttendancePanel t={t} roster={roster} onMarkAll={markAllPresent} onToggle={togglePresent} />
        )}
        {active === 'diapers' && <DiaperPanel t={t} />}
        {active === 'messages' && <MessagesPanel t={t} threads={threads} />}
        {active === 'media' && <MediaPanel t={t} uploads={uploads} onFiles={handleFiles} />}
        {active === 'stories' && <StoriesPanel t={t} />}
        {active === 'announcements' && <AnnouncementsPanel t={t} lang={lang} />}
        {active === 'students' && <StudentsPanel t={t} studentRequests={studentRequests} loadingRequests={loadingRequests} onAddStudent={() => setIsStudentRequestModalOpen(true)} />}
      </section>

      {/* Student Request Modal */}
      {isStudentRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.add_student_request}</h3>
              <button
                onClick={() => setIsStudentRequestModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitStudentRequest} className="space-y-1">
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

              <div className="grid grid-cols-2 gap-3">
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
                    <option value="Unknown">{t.gender_unknown}</option>
                    <option value="Male">{t.gender_male}</option>
                    <option value="Female">{t.gender_female}</option>
                    <option value="Other">{t.gender_other}</option>
                  </select>
                </div>
              </div>

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

              {/* <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.student_allergies}
                </label>
                <textarea
                  value={studentRequestForm.allergies}
                  onChange={(e) => setStudentRequestForm(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder={t.student_allergies_placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  rows={1}
                />
              </div> */}

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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsStudentRequestModalOpen(false)}
                  disabled={loadingRequests}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loadingRequests}
                  className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 dark:bg-black"
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
    </main>
  );
}

/* -------------------- Panels -------------------- */

function AttendancePanel({
  t,
  roster,
  onMarkAll,
  onToggle,
}: {
  t: typeof enText;
  roster: { id: number; name: string; present: boolean }[];
  onMarkAll: () => void;
  onToggle: (id: number, checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.att_title}</h2>
        <button
          onClick={onMarkAll}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" />
          {t.att_mark_all_in}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((s) => (
          <label
            key={s.id}
            className={clsx(
              'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition',
              s.present
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
            )}
          >
            <span className="font-medium">{s.name}</span>
            <input
              type="checkbox"
              checked={s.present}
              onChange={(e) => onToggle(s.id, e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function DiaperPanel({ t }: { t: typeof enText }) {
  const [child, setChild] = useState('');
  const [kind, setKind] = useState<'wet' | 'dirty' | 'mixed'>('wet');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    // mock save
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setChild('');
    setKind('wet');
    setTime('');
    setNotes('');
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.di_title}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.di_hint}</p>

      <form onSubmit={save} className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.child}
          <input
            value={child}
            onChange={(e) => setChild(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={`${t.child} 1`}
            required
          />
        </label>
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.di_type}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="wet">{t.di_wet}</option>
            <option value="dirty">{t.di_dirty}</option>
            <option value="mixed">{t.di_mixed}</option>
          </select>
        </label>
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.time}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            required
          />
        </label>
        <label className="text-sm md:col-span-3 text-slate-700 dark:text-slate-300">
          {t.notes}
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={t.di_notes_ph}
          />
        </label>
        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
            {t.save}
          </button>
          {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">✓ {t.saved}</span>}
        </div>
      </form>
    </div>
  );
}

function MessagesPanel({ t, threads }: { t: typeof enText; threads: { id: string; name: string; preview: string; unread: boolean }[] }) {
  const [to, setTo] = useState('Hópur: Gulikjarni');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  function send() {
    if (!msg.trim()) return;
    setSent(true);
    setTimeout(() => setSent(false), 1200);
    setMsg('');
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.msg_title}</h2>
        <div className="text-sm text-slate-500 dark:text-slate-400">{t.msg_hint}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr,380px]">
        {/* Thread list */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-600">
          <div className="border-b border-slate-200 bg-slate-50 p-3 text-sm font-medium dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">{t.inbox}</div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-600">
            {threads.map((th) => (
              <li key={th.id} className="cursor-pointer p-3 hover:bg-slate-50 dark:hover:bg-slate-700">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{th.name}</div>
                  {th.unread && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{t.unread}</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-600 dark:text-slate-400">{th.preview}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Composer */}
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-600 dark:bg-slate-700">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.new_message}</div>
          <label className="mt-2 block text-sm text-slate-700 dark:text-slate-300">
            {t.to}
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder="Hópur: Gulikjarni"
            />
          </label>
          <label className="mt-2 block text-sm text-slate-700 dark:text-slate-300">
            {t.message}
            <textarea
              rows={5}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder={t.msg_ph}
            />
          </label>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={send}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Send className="h-4 w-4" /> {t.send}
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Paperclip className="h-4 w-4" /> {t.attach}
            </button>
            {sent && <span className="text-sm text-emerald-700 dark:text-emerald-400">✓ {t.sent}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaPanel({
  t,
  uploads,
  onFiles,
}: {
  t: typeof enText;
  uploads: string[];
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.media_title}</h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
          <Plus className="h-4 w-4" />
          {t.upload}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {uploads.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700" />
          ))
          : uploads.map((src, i) => (
            <div key={i} className="aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
      </div>
    </div>
  );
}

function StoriesPanel({ t }: { t: typeof enText }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.stories_title}</h2>
        <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
          <Plus className="h-4 w-4" />
          {t.add_story}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto py-1">
        <button className="flex w-20 flex-col items-center gap-1">
          <span className="rounded-full bg-gradient-to-tr from-slate-300 to-slate-400 p-0.5">
            <span className="block rounded-full bg-white p-0.5">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed">
                <Plus className="h-5 w-5" />
              </span>
            </span>
          </span>
          <span className="truncate text-xs text-slate-600 dark:text-slate-400">{t.add}</span>
        </button>
        {['Blue Room', 'Green Room', 'Yellow Room', 'Red Room'].map((name, i) => (
          <div key={i} className="flex w-20 flex-col items-center gap-1">
            <span className="rounded-full bg-gradient-to-tr from-rose-400 to-amber-400 p-0.5">
              <span className="block rounded-full bg-white p-0.5">
                <span className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-600" />
              </span>
            </span>
            <span className="truncate text-xs text-slate-600 dark:text-slate-400">{name}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{t.stories_hint}</p>
    </div>
  );
}

function StudentsPanel({
  t,
  studentRequests,
  loadingRequests,
  onAddStudent
}: {
  t: typeof enText;
  studentRequests: any[];
  loadingRequests: boolean;
  onAddStudent: () => void;
}) {
  const pendingRequests = studentRequests.filter(r => r.status === 'pending');
  const approvedRequests = studentRequests.filter(r => r.status === 'approved');
  const rejectedRequests = studentRequests.filter(r => r.status === 'rejected');

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.students_title}</h2>
        <button
          onClick={onAddStudent}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="h-4 w-4" />
          {t.add_student_request}
        </button>
      </div>

      {/* Pending Requests Table */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3 text-slate-900 dark:text-slate-100">{t.pending_requests}</h3>
        {loadingRequests ? (
          <div className="text-center py-4 text-slate-600 dark:text-slate-400">{t.loading}</div>
        ) : pendingRequests.length === 0 ? (
          <div className="text-center py-4 text-slate-500 dark:text-slate-400">{t.no_pending_requests}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.student_name}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.student_dob}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.student_gender}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.student_class}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.student_medical_notes}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.status}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.requested_date}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((request) => (
                  <tr key={request.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {request.first_name} {request.last_name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {request.dob ? new Date(request.dob).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {request.gender || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {request.class_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {request.medical_notes ? (
                        <span className="truncate max-w-xs block" title={request.medical_notes}>
                          {request.medical_notes.length > 30 
                            ? `${request.medical_notes.substring(0, 30)}...` 
                            : request.medical_notes}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        {t.pending}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                      {request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approved Requests */}
      {approvedRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-md font-medium mb-3 text-slate-900 dark:text-slate-100">{t.approved_requests}</h3>
          <div className="space-y-2">
            {approvedRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-600 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {request.first_name} {request.last_name}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {t.status}: <span className="text-green-700 dark:text-green-300">{t.approved}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {t.approved}
                  </span>
                </div>
              </div>
            ))}
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

  // Tiles
  tile_att: 'Attendance',
  tile_att_desc: 'Mark in/out and late arrivals.',
  tile_diaper: 'Diapers & Health',
  tile_diaper_desc: 'Log diapers, naps, meds & temperature.',
  tile_msg: 'Messages',
  tile_msg_desc: 'Direct messages and announcements.',
  tile_media: 'Media',
  tile_media_desc: 'Upload photos & albums.',
  tile_stories: 'Stories (24h)',
  tile_stories_desc: 'Post classroom stories that expire in 24h.',
  tile_announcements: 'Announcements',
  tile_announcements_desc: 'Create and view announcements.',

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

  // Media
  media_title: 'Photos & Albums',
  upload: 'Upload',

  // Stories
  stories_title: 'Class Stories (24h)',
  add_story: 'Add story',
  add: 'Add',
  stories_hint:
    'Stories are only visible to guardians of enrolled children in this class and expire after 24 hours.',

  // Announcements
  announcements_title: 'Announcements',
  announcements_list: 'Class Announcements',

  // Students
  tile_students: 'Students',
  tile_students_desc: 'Manage student requests and enrollment.',
  students_title: 'Student Requests',
  add_student_request: 'Add Student Request',
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

  // Tiles
  tile_att: 'Mæting',
  tile_att_desc: 'Skrá inn/út og seinkun.',
  tile_diaper: 'Bleyjur & Heilsa',
  tile_diaper_desc: 'Skrá bleyjur, svefn, lyf og hita.',
  tile_msg: 'Skilaboð',
  tile_msg_desc: 'Bein skilaboð og tilkynningar.',
  tile_media: 'Myndir',
  tile_media_desc: 'Hlaða upp myndum og albúmum.',
  tile_stories: 'Sögur (24 klst)',
  tile_stories_desc: 'Hópsögur sem hverfa eftir 24 klst.',

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

  // Media
  media_title: 'Myndir & Albúm',
  upload: 'Hlaða upp',

  // Stories
  stories_title: 'Hópsögur (24 klst)',
  add_story: 'Bæta við sögu',
  add: 'Bæta við',
  stories_hint:
    'Sögur eru einungis sýnilegar forráðafólki barna í hópnum og hverfa eftir 24 klst.',

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
};

// Announcements Panel Component
function AnnouncementsPanel({ t, lang }: { t: typeof enText; lang: 'is' | 'en' }) {
  const { session } = useAuth();
  const classId = (session?.user?.user_metadata as any)?.class_id as string | undefined;
  const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">{t.announcements_title}</h2>
        <AnnouncementForm
          classId={classId}
          orgId={orgId}
          lang={lang}
          onSuccess={() => {
            // Refresh announcements list
            window.location.reload();
          }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">{t.announcements_list}</h3>
        <AnnouncementList
          classId={classId}
          showAuthor={true}
          limit={5}
          lang={lang}
        />
      </div>
    </div>
  );
}
