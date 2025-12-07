'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Paperclip, Search, MessageSquarePlus, X, MessageSquare } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import EmptyState from '@/app/components/EmptyState';

type Lang = 'is' | 'en';
type Role = 'principal' | 'teacher' | 'guardian';

interface MessagesPanelProps {
  role: Role;
  teacherClasses?: any[];
  students?: Array<{ id: string; class_id: string | null }>;
}

export default function MessagesPanel({ role, teacherClasses = [], students = [] }: MessagesPanelProps) {
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const [threads, setThreads] = useState<MessageThreadWithParticipants[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThreadWithParticipants | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sent, setSent] = useState(false);
  const [principals, setPrincipals] = useState<Array<{ id: string; first_name: string; last_name: string | null; email: string; role: string }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; first_name: string; last_name: string | null; email: string; role: string }>>([]);
  const [guardians, setGuardians] = useState<Array<{ id: string; first_name: string; last_name: string | null; email: string }>>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allowedGuardianIds, setAllowedGuardianIds] = useState<Set<string>>(new Set());
  const [linkedStudentClassIds, setLinkedStudentClassIds] = useState<Set<string>>(new Set());
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [chatMessageBody, setChatMessageBody] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Refs to track previous values and prevent infinite loops
  const prevAllowedGuardianIdsRef = useRef<string>('');
  const prevLinkedStudentClassIdsRef = useRef<string>('');
  const prevStudentIdsRef = useRef<string>('');
  const isManuallyLoadingMessagesRef = useRef<boolean>(false);

  const userMetadata = session?.user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const guardianId = session?.user?.id;

  // Calculate keys once per render (will be compared with refs to prevent loops)
  const studentIdsKey = students.map(s => s.id).filter(Boolean).sort().join(',');
  const allowedGuardianIdsKey = Array.from(allowedGuardianIds).sort().join(',');
  const linkedStudentClassIdsKey = Array.from(linkedStudentClassIds).sort().join(',');

  // Load guardians linked to teacher's students (for teacher role)
  useEffect(() => {
    // Calculate current key
    const currentStudentIdsKey = students.map(s => s.id).filter(Boolean).sort().join(',');
    
    if (role !== 'teacher' || !orgId || students.length === 0) {
      const emptyKey = '';
      if (prevStudentIdsRef.current !== emptyKey) {
        setAllowedGuardianIds(new Set());
        prevStudentIdsRef.current = emptyKey;
        prevAllowedGuardianIdsRef.current = emptyKey;
      }
      return;
    }

    // Only run if student IDs actually changed
    if (prevStudentIdsRef.current === currentStudentIdsKey && prevStudentIdsRef.current !== '') {
      return;
    }

    prevStudentIdsRef.current = currentStudentIdsKey;

    async function loadAllowedGuardians() {
      try {
        const studentIds = students.map(s => s.id).filter(Boolean);
        if (studentIds.length === 0) {
          const emptyKey = '';
          if (prevAllowedGuardianIdsRef.current !== emptyKey) {
            setAllowedGuardianIds(new Set());
            prevAllowedGuardianIdsRef.current = emptyKey;
          }
          return;
        }

        const guardianIdsSet = new Set<string>();
        
        for (const studentId of studentIds) {
          try {
            const res = await fetch(`/api/guardian-students?studentId=${studentId}&t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (res.ok && data.relationships) {
              data.relationships.forEach((rel: any) => {
                if (rel.guardian_id) {
                  guardianIdsSet.add(rel.guardian_id);
                }
              });
            }
          } catch (error) {
            console.error(`Error loading guardians for student ${studentId}:`, error);
          }
        }

        const newKey = Array.from(guardianIdsSet).sort().join(',');
        // Only update if content actually changed
        if (prevAllowedGuardianIdsRef.current !== newKey) {
          console.log(`✅ Loaded ${guardianIdsSet.size} allowed guardians for teacher:`, Array.from(guardianIdsSet));
          setAllowedGuardianIds(guardianIdsSet);
          prevAllowedGuardianIdsRef.current = newKey;
        }
      } catch (error) {
        console.error('Error loading allowed guardians:', error);
        const emptyKey = '';
        if (prevAllowedGuardianIdsRef.current !== emptyKey) {
          setAllowedGuardianIds(new Set());
          prevAllowedGuardianIdsRef.current = emptyKey;
        }
      }
    }

    loadAllowedGuardians();
    // Note: We check studentIdsKey via ref inside to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, role, students.length]);

  // Load guardian's linked students and their class IDs (for guardian role)
  useEffect(() => {
    if (role !== 'guardian' || !orgId || !guardianId) {
      setLinkedStudentClassIds(new Set());
      return;
    }

    async function loadLinkedStudents() {
      try {
        console.log(`🔍 [Guardian Chat] Step 1: Loading linked students for guardian: ${guardianId}`);
        const studentsRes = await fetch(`/api/guardian-students?guardianId=${guardianId}&t=${Date.now()}`, { cache: 'no-store' });
        const studentsData = await studentsRes.json();
        if (studentsRes.ok && studentsData.relationships) {
          const studentIds = studentsData.relationships.map((r: any) => r.student_id).filter(Boolean);
          console.log(`✅ [Guardian Chat] Step 1: Found ${studentIds.length} linked students for guardian:`, studentIds);
          
          if (studentIds.length > 0) {
            console.log(`🔍 [Guardian Chat] Step 2: Loading student details to get class assignments...`);
            const studentsDetailsRes = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
            const studentsDetails = await studentsDetailsRes.json();
            if (studentsDetailsRes.ok && studentsDetails.students) {
              const classIdsSet = new Set<string>();
              const studentClassMap: Record<string, string[]> = {};
              
              studentsDetails.students
                .filter((s: any) => studentIds.includes(s.id))
                .forEach((s: any) => {
                  const classId = s.class_id || s.classes?.id;
                  if (classId) {
                    classIdsSet.add(classId);
                    if (!studentClassMap[s.id]) {
                      studentClassMap[s.id] = [];
                    }
                    studentClassMap[s.id].push(classId);
                  }
                });
              
              console.log(`✅ [Guardian Chat] Step 2: Found ${classIdsSet.size} unique classes for guardian's students`);
              console.log(`📋 [Guardian Chat] Student-Class mapping:`, studentClassMap);
              console.log(`📋 [Guardian Chat] Class IDs:`, Array.from(classIdsSet));
              setLinkedStudentClassIds(classIdsSet);
            } else {
              console.warn('⚠️ [Guardian Chat] Step 2: Failed to load student details');
              setLinkedStudentClassIds(new Set());
            }
          } else {
            console.warn('⚠️ [Guardian Chat] Step 1: No linked students found for guardian');
            setLinkedStudentClassIds(new Set());
          }
        } else {
          console.warn('⚠️ [Guardian Chat] Step 1: Failed to load guardian-student relationships');
          setLinkedStudentClassIds(new Set());
        }
      } catch (error) {
        console.error('❌ [Guardian Chat] Error loading linked students:', error);
        setLinkedStudentClassIds(new Set());
      }
    }

    loadLinkedStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, guardianId, role]);

  // Load recipients based on role
  useEffect(() => {
    if (!orgId) return;

    // For guardian role, wait for linkedStudentClassIds to be populated
    if (role === 'guardian' && linkedStudentClassIds.size === 0) {
      console.log(`⏳ [Guardian Chat] Waiting for linkedStudentClassIds to be populated...`);
      return;
    }

    // Calculate keys inside effect to avoid recalculation on every render
    const currentAllowedKey = Array.from(allowedGuardianIds).sort().join(',');
    const currentLinkedKey = Array.from(linkedStudentClassIds).sort().join(',');
    
    // For guardian role, always run if orgId is available (don't skip on first load)
    // For other roles, only run if keys actually changed
    const shouldSkip = role !== 'guardian' && 
      prevAllowedGuardianIdsRef.current === currentAllowedKey && 
      prevLinkedStudentClassIdsRef.current === currentLinkedKey &&
      prevAllowedGuardianIdsRef.current !== '' && 
      prevLinkedStudentClassIdsRef.current !== '';
    
    if (shouldSkip) {
      return;
    }

    async function loadRecipients() {
      setLoadingRecipients(true);
      const allowedKey = currentAllowedKey;
      const linkedKey = currentLinkedKey;
      try {
        // Principals - load for teacher and guardian roles
        if (role === 'teacher' || role === 'guardian') {
          const principalsRes = await fetch(`/api/principals?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
          const principalsData = await principalsRes.json();
          if (principalsRes.ok && principalsData.principals) {
            setPrincipals(principalsData.principals.map((p: any) => ({
              id: p.id,
              first_name: p.first_name || '',
              last_name: p.last_name || null,
              email: p.email || '',
              role: 'principal'
            })));
          }
        }

        // Teachers - load for principal, guardian, and teacher roles (for teacher-to-teacher messaging)
        if (role === 'principal' || role === 'guardian' || role === 'teacher') {
          if (role === 'teacher') {
            // For teachers, load ALL other teachers from the same organization (excluding current user)
            try {
              const teachersRes = await fetch(`/api/staff-management?t=${Date.now()}`, { cache: 'no-store' });
              const teachersData = await teachersRes.json();
              if (teachersRes.ok && teachersData.staff) {
                // Filter to only teachers (not principals) and exclude current user
                // This ensures all teachers from the same organization can message each other
                
                const teacherRoleStaff = teachersData.staff
                  .filter((t: any) => {
                    const userRole = t.role || 'teacher';
                    const isTeacher = userRole === 'teacher';
                    const isNotCurrentUser = t.id !== session?.user?.id;
                    return isTeacher && isNotCurrentUser;
                  });
               
                setTeachers(teacherRoleStaff.map((t: any) => ({
                  id: t.id,
                  first_name: t.first_name || '',
                  last_name: t.last_name || null,
                  email: t.email || '',
                  role: t.role || 'teacher'
                })));
                
                console.log(`✅ Loaded ${teacherRoleStaff.length} teachers for messaging`);
              } else {
                console.warn('❌ Failed to load teachers for teacher role:', teachersData);
                setTeachers([]);
              }
            } catch (error) {
              console.error('❌ Error loading teachers for teacher role:', error);
              setTeachers([]);
            }
          } else if (role === 'guardian') {
            // For guardians, load ONLY teachers assigned to their students' classes
            // Flow: Guardian → Students → Classes → Teachers
            try {
              let teacherIdsSet = new Set<string>();
              let classesData: any = null; // Store classes data for later use
              let classIdsArray: string[] = []; // Store class IDs for later use
              
              // Step 3: Get teachers from guardian's students' classes
              if (linkedStudentClassIds.size > 0) {
                classIdsArray = Array.from(linkedStudentClassIds);
                console.log(`🔍 [Guardian Chat] Step 3: Loading teachers from ${classIdsArray.length} classes:`, classIdsArray);
                
                try {
                  // Try to get teachers from classes API first
                  const classesRes = await fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' });
                  classesData = await classesRes.json();
                  if (classesRes.ok && classesData.classes) {
                    const relevantClasses = classesData.classes.filter((c: any) => classIdsArray.includes(c.id));
                    console.log(`✅ [Guardian Chat] Step 3a: Found ${relevantClasses.length} relevant classes from API`);
                    
                    relevantClasses.forEach((classData: any) => {
                      // Check for assigned_teachers array (format: {id, full_name, first_name, last_name, email})
                      if (classData?.assigned_teachers && Array.isArray(classData.assigned_teachers)) {
                        console.log(`  📋 Class ${classData.name} has ${classData.assigned_teachers.length} assigned teachers:`, classData.assigned_teachers.map((t: any) => ({ id: t?.id || t, name: t?.first_name || t?.full_name || 'Unknown' })));
                        classData.assigned_teachers.forEach((teacher: any) => {
                          // Handle object format {id, first_name, ...} and just id
                          const teacherId = teacher?.id || teacher;
                          if (teacherId) {
                            teacherIdsSet.add(teacherId);
                            const teacherName = teacher.first_name || teacher.full_name || 'Unknown';
                            console.log(`  ✅ Found teacher in class ${classData.name}: ${teacherId} (${teacherName})`);
                            // Special check for the specific teacher mentioned
                            if (teacherId === 'b43d997f-4852-4c70-abd8-9c13ff6bae9e' || teacherName.toLowerCase().includes('shayan')) {
                              console.log(`  🎯 FOUND TARGET TEACHER: ${teacherId} - ${teacherName} in class ${classData.name}`);
                            }
                          }
                        });
                      } else {
                        console.log(`  ⚠️ Class ${classData.name} (${classData.id}) has no assigned_teachers array`);
                      }
                    });
                    console.log(`✅ [Guardian Chat] Step 3a: Found ${teacherIdsSet.size} unique teachers from classes API`);
                  } else {
                    console.warn('⚠️ [Guardian Chat] Step 3a: Classes API response not ok or no classes data:', classesData);
                  }
                  
                  // Step 3b: Fallback - Query class_memberships directly if assigned_teachers is empty
                  if (teacherIdsSet.size === 0) {
                    console.log(`🔍 [Guardian Chat] Step 3b: No teachers from classes API, querying class_memberships directly...`);
                    try {
                      const membershipsRes = await fetch(`/api/class-memberships?classIds=${classIdsArray.join(',')}&orgId=${orgId}&role=teacher&t=${Date.now()}`, { cache: 'no-store' });
                      if (membershipsRes.ok) {
                        const membershipsData = await membershipsRes.json();
                        if (membershipsData.memberships && Array.isArray(membershipsData.memberships)) {
                          membershipsData.memberships.forEach((m: any) => {
                            const teacherId = m.user_id || m.user?.id;
                            if (teacherId) {
                              teacherIdsSet.add(teacherId);
                              console.log(`  ✅ Found teacher from class_memberships: ${teacherId}`);
                            }
                          });
                          console.log(`✅ [Guardian Chat] Step 3b: Found ${teacherIdsSet.size} teachers from class_memberships`);
                        }
                      } else {
                        // If API doesn't exist, we'll handle it in the catch block below
                        console.log(`⚠️ [Guardian Chat] Step 3b: class-memberships API not available, will query directly via Supabase`);
                      }
                    } catch (membershipError) {
                      console.log(`⚠️ [Guardian Chat] Step 3b: Could not use class-memberships API, will continue with teachers from classes API`);
                    }
                  }
                } catch (error) {
                  console.error('❌ [Guardian Chat] Step 3: Error loading classes for teachers:', error);
                }
                
                console.log(`📊 [Guardian Chat] Step 3 Summary: Total ${teacherIdsSet.size} unique teachers found from classes`);
                if (teacherIdsSet.size > 0) {
                  console.log(`📋 [Guardian Chat] Teacher IDs:`, Array.from(teacherIdsSet));
                }
              } else {
                console.log('⚠️ [Guardian Chat] Step 3: No linked student classes found for guardian - will show empty teacher list');
              }

              // Step 4: Load teachers from staff-management API and filter to only those assigned to guardian's students' classes
              console.log(`🔍 [Guardian Chat] Step 4: Loading teachers from staff-management API (orgId: ${orgId})...`);
              const teachersRes = await fetch(`/api/staff-management?t=${Date.now()}`, { cache: 'no-store' });
              
              if (!teachersRes.ok) {
                console.error(`❌ [Guardian Chat] Step 4: Staff-management API returned error: ${teachersRes.status} ${teachersRes.statusText}`);
                const errorData = await teachersRes.json().catch(() => ({}));
                console.error('Error details:', errorData);
                setTeachers([]);
                return;
              }
              
              const teachersData = await teachersRes.json();
              console.log(`📦 [Guardian Chat] Step 4: Staff-management API response:`, { 
                hasStaff: !!teachersData.staff, 
                staffLength: teachersData.staff?.length || 0,
                totalStaff: teachersData.total_staff || 0
              });
              
              if (teachersData.staff && Array.isArray(teachersData.staff)) {
                console.log(`📊 [Guardian Chat] Step 4: Total staff from API: ${teachersData.staff.length}`);
                
                // Filter to only teachers (not principals or admins)
                let filteredTeachers = teachersData.staff.filter((t: any) => {
                  const userRole = (t.role || 'teacher').toLowerCase().trim();
                  const isTeacher = userRole === 'teacher';
                  if (!isTeacher) {
                    console.log(`  🔒 Filtering out staff member: ${t.first_name || ''} ${t.last_name || ''} (role: ${t.role || 'null'})`);
                  }
                  return isTeacher;
                });
                
                console.log(`✅ [Guardian Chat] Step 4: Filtered to ${filteredTeachers.length} teachers (excluding principals/admins) out of ${teachersData.staff.length} total staff`);
                
                // Step 5: Filter to ONLY teachers assigned to guardian's students' classes
                if (teacherIdsSet.size > 0) {
                  const teacherIdsArray = Array.from(teacherIdsSet);
                  console.log(`🔍 [Guardian Chat] Step 5: Looking for ${teacherIdsArray.length} teachers in staff API:`, teacherIdsArray);
                  console.log(`🔍 [Guardian Chat] Step 5: Available teachers in staff API (${filteredTeachers.length}):`, filteredTeachers.map((t: any) => ({ id: t.id, name: `${t.first_name} ${t.last_name || ''}`.trim() || t.email })));
                  
                  const beforeFilter = filteredTeachers.length;
                  console.log(`🔍 [Guardian Chat] Step 5: Before filtering - looking for teacher IDs:`, teacherIdsArray);
                  console.log(`🔍 [Guardian Chat] Step 5: Before filtering - available teacher IDs:`, filteredTeachers.map((t: any) => t.id));
                  
                  filteredTeachers = filteredTeachers.filter((t: any) => {
                    const isMatch = teacherIdsArray.includes(t.id);
                    if (t.id === 'b43d997f-4852-4c70-abd8-9c13ff6bae9e' || (t.first_name && t.first_name.toLowerCase().includes('shayan'))) {
                      console.log(`  🎯 TARGET TEACHER CHECK: ${t.id} (${t.first_name} ${t.last_name || ''}) - isMatch: ${isMatch}, in array: ${teacherIdsArray.includes(t.id)}`);
                    }
                    return isMatch;
                  });
                  console.log(`✅ [Guardian Chat] Step 5: Filtered to ${filteredTeachers.length} teachers (from ${beforeFilter}) assigned to guardian's students' classes`);
                  
                  // If some teachers from classes are missing from staff API, try to get their details from classes API
                  const foundTeacherIds = new Set(filteredTeachers.map((t: any) => t.id));
                  const missingTeacherIds = teacherIdsArray.filter((id: string) => !foundTeacherIds.has(id));
                  
                  if (missingTeacherIds.length > 0) {
                    console.warn(`⚠️ [Guardian Chat] Step 5: ${missingTeacherIds.length} teachers from classes not found in staff API:`, missingTeacherIds);
                    if (missingTeacherIds.includes('b43d997f-4852-4c70-abd8-9c13ff6bae9e')) {
                      console.warn(`  🎯 TARGET TEACHER IS MISSING FROM STAFF API! Will try to get from classes API`);
                    }
                    console.warn(`⚠️ [Guardian Chat] Attempting to get teacher details from classes API...`);
                    
                    // Get teacher details from classes API for missing teachers
                    try {
                      const relevantClasses = classesData?.classes?.filter((c: any) => classIdsArray.includes(c.id)) || [];
                      console.log(`  🔍 Found ${relevantClasses.length} relevant classes to search for missing teachers`);
                      const missingTeachers: any[] = [];
                      
                      relevantClasses.forEach((classData: any) => {
                        if (classData?.assigned_teachers && Array.isArray(classData.assigned_teachers)) {
                          classData.assigned_teachers.forEach((teacher: any) => {
                            const teacherId = teacher?.id || teacher;
                            if (teacherId && missingTeacherIds.includes(teacherId) && !foundTeacherIds.has(teacherId)) {
                              // Add teacher from classes API if not already added
                              if (!missingTeachers.find((t: any) => t.id === teacherId)) {
                                const teacherData = {
                                  id: teacherId,
                                  first_name: teacher.first_name || '',
                                  last_name: teacher.last_name || null,
                                  email: teacher.email || '',
                                  role: 'teacher'
                                };
                                missingTeachers.push(teacherData);
                                foundTeacherIds.add(teacherId);
                                if (teacherId === 'b43d997f-4852-4c70-abd8-9c13ff6bae9e' || (teacher.first_name && teacher.first_name.toLowerCase().includes('shayan'))) {
                                  console.log(`  🎯 FOUND MISSING TARGET TEACHER in classes API:`, teacherData);
                                }
                              }
                            }
                          });
                        }
                      });
                      
                      if (missingTeachers.length > 0) {
                        console.log(`✅ [Guardian Chat] Step 5: Added ${missingTeachers.length} missing teachers from classes API:`, missingTeachers.map((t: any) => ({ id: t.id, name: `${t.first_name} ${t.last_name || ''}`.trim() })));
                        filteredTeachers.push(...missingTeachers);
                      } else {
                        console.warn(`  ⚠️ No missing teachers found in classes API data`);
                      }
                    } catch (error) {
                      console.error('❌ [Guardian Chat] Step 5: Error getting missing teachers from classes:', error);
                    }
                  }
                  
                  if (filteredTeachers.length === 0) {
                    console.warn(`⚠️ [Guardian Chat] Step 5: No teachers found after all attempts`);
                    console.warn(`⚠️ [Guardian Chat] Teacher IDs from classes:`, Array.from(teacherIdsSet));
                    const allTeacherIds = teachersData.staff
                      .filter((t: any) => (t.role || 'teacher').toLowerCase().trim() === 'teacher')
                      .map((t: any) => t.id);
                    console.warn(`⚠️ [Guardian Chat] Teacher IDs in staff API:`, allTeacherIds);
                  }
                } else {
                  console.warn(`⚠️ [Guardian Chat] Step 5: No teacher IDs found from classes - showing empty teacher list`);
                  console.warn(`⚠️ [Guardian Chat] This means guardian's students have no classes or classes have no assigned teachers`);
                  filteredTeachers = []; // Show empty list, no fallback to all teachers
                }
                
                const teachersList = filteredTeachers.map((t: any) => ({
                  id: t.id,
                  first_name: t.first_name || '',
                  last_name: t.last_name || null,
                  email: t.email || '',
                  role: t.role || 'teacher'
                }));
                
                console.log(`✅ [Guardian Chat] Final: Setting ${teachersList.length} teachers for guardian dropdown`);
                if (teachersList.length > 0) {
                  console.log(`📋 [Guardian Chat] Teachers being set:`, teachersList.map((t: any) => ({ 
                    id: t.id, 
                    name: `${t.first_name} ${t.last_name || ''}`.trim() || t.email,
                    email: t.email 
                  })));
                } else {
                  console.warn(`⚠️ [Guardian Chat] No teachers will be shown in dropdown - guardian's students' classes have no assigned teachers`);
                  console.warn(`⚠️ [Guardian Chat] Debug info:`, {
                    teacherIdsFromClasses: Array.from(teacherIdsSet),
                    filteredTeachersBeforeMapping: filteredTeachers.length,
                    classIdsArray: classIdsArray,
                    hasClassesData: !!classesData
                  });
                }
                console.log(`🔍 [Guardian Chat] About to call setTeachers with ${teachersList.length} teachers`);
                setTeachers(teachersList);
                console.log(`✅ [Guardian Chat] setTeachers called`);
              } else {
                console.warn('❌ [Guardian Chat] Step 4: Staff-management API response invalid or empty:', {
                  ok: teachersRes.ok,
                  status: teachersRes.status,
                  hasStaff: !!teachersData.staff,
                  staffIsArray: Array.isArray(teachersData.staff),
                  data: teachersData
                });
                setTeachers([]);
              }
            } catch (error) {
              console.error('❌ Error loading teachers for guardian:', error);
              // Set empty array on error
              setTeachers([]);
            }
          } else {
            // For principals, load all teachers
            const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const teachersData = await teachersRes.json();
            if (teachersRes.ok && teachersData.staff) {
              setTeachers(teachersData.staff.map((t: any) => ({
                id: t.id,
                first_name: t.first_name || '',
                last_name: t.last_name || null,
                email: t.email || '',
                role: t.role || 'teacher'
              })));
            }
          }
        }

        // Guardians - load for principal and teacher roles
        if (role === 'principal' || role === 'teacher') {
          try {
            // Always try to load guardians - for teachers, we'll filter based on allowedGuardianIds
            const guardiansRes = await fetch(`/api/guardians?t=${Date.now()}`, { cache: 'no-store' });
            const guardiansData = await guardiansRes.json();
            if (guardiansRes.ok && guardiansData.guardians) {
              if (role === 'teacher') {
                // For teachers, filter to only show guardians linked to their students
                // But if allowedGuardianIds is empty, still load all guardians (they'll be filtered in the dropdown/threads)
                // This ensures guardians appear in the dropdown even if allowedGuardianIds hasn't loaded yet
                if (allowedGuardianIds.size > 0) {
                  const guardianIdsArray = Array.from(allowedGuardianIds);
                  const filteredGuardians = guardiansData.guardians
                    .filter((g: any) => guardianIdsArray.includes(g.id))
                    .map((g: any) => ({
                      id: g.id,
                      first_name: g.first_name || '',
                      last_name: g.last_name || null,
                      email: g.email || ''
                    }));
                  console.log(`✅ Loaded ${filteredGuardians.length} guardians for teacher (filtered from ${guardiansData.guardians.length} total)`);
                  setGuardians(filteredGuardians);
                } else {
                  // Load all guardians initially - they'll be filtered when allowedGuardianIds is populated
                  // This ensures guardians show up in the dropdown
                  const allGuardians = guardiansData.guardians.map((g: any) => ({
                    id: g.id,
                    first_name: g.first_name || '',
                    last_name: g.last_name || null,
                    email: g.email || ''
                  }));
                  console.log(`⚠️ AllowedGuardianIds empty, loading all ${allGuardians.length} guardians for teacher (will filter when allowedGuardianIds is populated)`);
                  setGuardians(allGuardians);
                }
              } else {
                // For principals, load all guardians
                setGuardians(guardiansData.guardians.map((g: any) => ({
                  id: g.id,
                  first_name: g.first_name || '',
                  last_name: g.last_name || null,
                  email: g.email || ''
                })));
              }
            } else {
              console.warn('❌ Failed to load guardians:', guardiansData);
              setGuardians([]);
            }
          } catch (error) {
            console.error('❌ Error loading guardians:', error);
            setGuardians([]);
          }
        }
      } catch (error) {
        console.error('Error loading recipients:', error);
      } finally {
        setLoadingRecipients(false);
        // Update refs after loading completes
        prevAllowedGuardianIdsRef.current = allowedKey;
        prevLinkedStudentClassIdsRef.current = linkedKey;
      }
    }

    loadRecipients();
    // Note: We check Set content via refs inside to prevent loops
    // For guardian role, we need to depend on linkedStudentClassIds.size to wait for classes to load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, role, session?.user?.id, linkedStudentClassIds.size]);

  // Load message threads
  useEffect(() => {
    if (!session?.user?.id) return;

    // Calculate key inside effect to avoid recalculation on every render
    const currentKey = Array.from(allowedGuardianIds).sort().join(',');
    
    // Only run if allowedGuardianIdsKey actually changed (for teacher role)
    if (role === 'teacher') {
      if (prevAllowedGuardianIdsRef.current === currentKey && prevAllowedGuardianIdsRef.current !== '') {
        return;
      }
    }

    async function loadThreads() {
      const currentSession = session;
      const guardianKey = currentKey;
      if (!currentSession?.user?.id) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/messages?t=${Date.now()}`, { cache: 'no-store' });
        
        // Handle 403 errors gracefully - don't redirect, just show empty state
        if (res.status === 403) {
          console.warn('Access denied to messages API (403). User may not have proper role or org_id.');
          setThreads([]);
          setLoading(false);
          return;
        }
        
        // Handle other non-ok responses
        if (!res.ok) {
          console.error(`Error loading messages: ${res.status} ${res.statusText}`);
          setThreads([]);
          setLoading(false);
          return;
        }
        
        const json = await res.json();
        if (json.threads) {
          // Load all threads without filtering - filtering will happen in useMemo
          // This ensures guardian threads appear even if allowedGuardianIds loads later
          const guardianThreads = json.threads.filter((t: any) => {
            const op = t.other_participant;
            return op && (op.role === 'guardian' || !op.role);
          });
          console.log(`📥 Loaded ${json.threads.length} threads for teacher (${guardianThreads.length} guardian threads, allowedGuardianIds: ${allowedGuardianIds.size})`);
          if (guardianThreads.length > 0) {
            console.log(`👥 Guardian threads found:`, guardianThreads.map((t: any) => ({
              id: t.id,
              guardian_id: t.other_participant?.id,
              guardian_name: `${t.other_participant?.first_name} ${t.other_participant?.last_name || ''}`,
              in_allowed_list: allowedGuardianIds.has(t.other_participant?.id || '')
            })));
          }
          setThreads(json.threads);
          
          // Auto-select first thread if none selected
          if (json.threads.length > 0 && !selectedThread) {
            setSelectedThread(json.threads[0]);
          }
        }
      } catch (error) {
        console.error('Error loading threads:', error);
      } finally {
        setLoading(false);
        // Update ref after loading completes (for teacher role)
        if (role === 'teacher') {
          prevAllowedGuardianIdsRef.current = guardianKey;
        }
      }
    }

    loadThreads();
    // Note: We check Set content via ref inside to prevent loops
    // We only depend on session user id and role - Set size is checked via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, role]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages for selected thread
  useEffect(() => {
    if (!selectedThread || !session?.user?.id) {
      setMessages([]);
      return;
    }

    // Skip loading if we're manually loading messages (e.g., after sending a message)
    if (isManuallyLoadingMessagesRef.current) {
      return;
    }

    async function loadMessages() {
      const currentThread = selectedThread;
      if (!currentThread) return;
      try {
        const res = await fetch(`/api/message-items?messageId=${currentThread.id}&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.items) {
          setMessages(json.items);
        }

        // Mark thread as read
        const currentSession = session;
        if (currentThread?.unread && currentSession?.user?.id) {
          try {
            const participantRes = await fetch(`/api/message-participants?messageId=${currentThread.id}`, { cache: 'no-store' });
            const participantData = await participantRes.json();
            if (participantRes.ok && participantData.participants && currentSession?.user?.id) {
              const userParticipant = participantData.participants.find((p: any) => p.user_id === currentSession.user.id);
              if (userParticipant?.id) {
                const updateRes = await fetch('/api/message-participants', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: userParticipant.id,
                    unread: false
                  })
                });
                if (updateRes.ok && currentThread) {
                  setThreads(prev => prev.map(t => 
                    t.id === currentThread.id ? { ...t, unread: false } : t
                  ));
                  setSelectedThread(prev => prev ? { ...prev, unread: false } : null);
                }
              }
            }
          } catch (error) {
            console.error('Error marking thread as read:', error);
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    }

    loadMessages();
  }, [selectedThread, session?.user?.id]);

  // Set up Realtime subscriptions for messages
  const threadIds = useMemo(() => threads.map(t => t.id), [threads]);
  
  useMessagesRealtime({
    threadIds,
    onNewMessage: (newMessage) => {
      // If the new message is for the currently selected thread, add it to messages
      if (selectedThread?.id === newMessage.message_id) {
        setMessages(prev => {
          // Check if message already exists (avoid duplicates)
          if (prev.some(m => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
      }
      
      // Update the thread's latest_item and move it to top
      setThreads(prev => {
        const threadIndex = prev.findIndex(t => t.id === newMessage.message_id);
        if (threadIndex >= 0) {
          const updatedThreads = [...prev];
          const thread = updatedThreads[threadIndex];
          const updatedThread = {
            ...thread,
            latest_item: newMessage,
            updated_at: newMessage.created_at,
          };
          // Move updated thread to top
          updatedThreads.splice(threadIndex, 1);
          updatedThreads.unshift(updatedThread);
          return updatedThreads;
        }
        return prev;
      });
    },
    onUpdatedParticipant: (updatedParticipant) => {
      // Update unread status for the thread
      setThreads(prev => prev.map(t => 
        t.id === updatedParticipant.message_id 
          ? { ...t, unread: updatedParticipant.unread, unread_count: updatedParticipant.unread ? 1 : 0 }
          : t
      ));
      
      // Update selected thread if it matches
      if (selectedThread?.id === updatedParticipant.message_id) {
        setSelectedThread(prev => prev ? { ...prev, unread: updatedParticipant.unread } : null);
      }
    },
    onNewThread: (newThread) => {
      // For teacher role, show all threads (principals, teachers, and all guardians)
      // If a thread exists, it means the teacher already has a conversation, so show it
      // allowedGuardianIds is only used for filtering recipient dropdown, not existing threads
      let shouldAdd = true;
      if (role === 'teacher') {
        const otherParticipant = newThread.other_participant;
        if (!otherParticipant) {
          shouldAdd = false;
        } else if (otherParticipant.role === 'principal') {
          shouldAdd = true;
        } else if (otherParticipant.role === 'teacher') {
          shouldAdd = true;
        } else if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
          // Show all guardian threads - if thread exists, it means conversation already started
          shouldAdd = true;
        } else {
          shouldAdd = false;
        }
      }
      
      if (shouldAdd) {
        setThreads(prev => {
          // Check if thread already exists (avoid duplicates)
          if (prev.some(t => t.id === newThread.id)) {
            return prev;
          }
          // Add new thread at the beginning
          return [newThread, ...prev];
        });
      }
    },
    onUpdatedThread: (updatedThread) => {
      // Update thread in the list
      setThreads(prev => prev.map(t => 
        t.id === updatedThread.id ? updatedThread : t
      ));
      
      // Update selected thread if it matches
      if (selectedThread?.id === updatedThread.id) {
        setSelectedThread(updatedThread);
      }
    },
  });

  // Filter threads by role permissions and search query
  const filteredThreads = useMemo(() => {
    let filtered = threads;

    // Filter threads for teacher role - show all existing threads
    // Note: allowedGuardianIds is only used for filtering recipient dropdown, not existing threads
    // If a thread exists, it means the teacher already has a conversation with that person, so show it
    if (role === 'teacher') {
      const beforeCount = filtered.length;
      const guardianThreads = filtered.filter(t => {
        const op = t.other_participant;
        return op && (op.role === 'guardian' || !op.role);
      });
      
      filtered = filtered.filter((thread: MessageThreadWithParticipants) => {
        const otherParticipant = thread.other_participant;
        if (!otherParticipant) return false;
        
        // Always show principals
        if (otherParticipant.role === 'principal') return true;
        
        // Always show other teachers
        if (otherParticipant.role === 'teacher') return true;
        
        // For guardians/parents, show ALL existing threads (don't filter by allowedGuardianIds)
        // If a thread exists, it means the teacher already has a conversation with this guardian
        // allowedGuardianIds is only used to filter the recipient dropdown for NEW conversations
        if (otherParticipant.role === 'guardian' || otherParticipant.role === 'parent' || !otherParticipant.role) {
          console.log(`✅ Showing guardian thread: ${otherParticipant.id} (${otherParticipant.first_name} ${otherParticipant.last_name || ''}) - existing conversation`);
          return true;
        }
        
        return false;
      });
      
      const guardianThreadsShown = filtered.filter(t => {
        const op = t.other_participant;
        return op && (op.role === 'guardian' || !op.role);
      }).length;
      
      if (beforeCount !== filtered.length || guardianThreads.length > 0) {
        console.log(`📊 Thread filtering summary: ${beforeCount} total -> ${filtered.length} filtered | ${guardianThreads.length} guardian threads found, ${guardianThreadsShown} shown`);
      }
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(thread => {
        const otherParticipant = thread.other_participant;
        if (!otherParticipant) return false;
        const name = `${otherParticipant.first_name} ${otherParticipant.last_name || ''}`.toLowerCase();
        const email = otherParticipant.email?.toLowerCase() || '';
        return name.includes(query) || email.includes(query);
      });
    }

    return filtered;
  }, [threads, searchQuery, role, allowedGuardianIds]);

  // Update selected thread if it's no longer in filtered list
  useEffect(() => {
    if (selectedThread && filteredThreads.length > 0) {
      const isSelectedThreadVisible = filteredThreads.some(t => t.id === selectedThread.id);
      if (!isSelectedThreadVisible) {
        // Selected thread is filtered out, select the first available thread
        setSelectedThread(filteredThreads[0]);
      }
    } else if (!selectedThread && filteredThreads.length > 0) {
      // No thread selected but we have filtered threads, select the first one
      setSelectedThread(filteredThreads[0]);
    }
  }, [filteredThreads, selectedThread]);

  // Combined recipients list based on role
  const allRecipients = useMemo(() => {
    if (role === 'principal') {
      const teacherList = teachers.map(t => ({ ...t, type: 'teacher' as const }));
      const guardianList = guardians.map(g => ({ ...g, type: 'guardian' as const }));
      return [...teacherList, ...guardianList];
    } else if (role === 'teacher') {
      const principalList = principals.map(p => ({ ...p, type: 'principal' as const }));
      const teacherList = teachers.map(t => ({ ...t, type: 'teacher' as const }));
      const guardianList = guardians.map(g => ({ ...g, type: 'guardian' as const }));
      return [...principalList, ...teacherList, ...guardianList];
    } else { // guardian
      const principalList = principals.map(p => ({ ...p, type: 'principal' as const }));
      const teacherList = teachers.map(t => ({ ...t, type: 'teacher' as const }));
      return [...principalList, ...teacherList];
    }
  }, [principals, teachers, guardians, role]);

  // Send message from chat view
  async function sendChatMessage() {
    if (!chatMessageBody.trim() || !selectedThread || !session?.user?.id) return;

    setSending(true);
    try {
      const messageRes = await fetch('/api/message-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: selectedThread.id,
          body: chatMessageBody.trim()
        })
      });

      const messageData = await messageRes.json();
      if (!messageRes.ok) {
        throw new Error(messageData.error || 'Failed to send message');
      }

      setChatMessageBody('');
      
      // Reset textarea height
      const textarea = document.querySelector('textarea[placeholder*="msg_ph"]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
      
      // Add message to local state immediately for better UX
      if (messageData.item) {
        setMessages(prev => [...prev, messageData.item]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  // Create new conversation and send first message
  async function sendMessage() {
    if (!messageBody.trim() || !recipientId || !session?.user?.id) return;

    setSending(true);
    try {
      let threadId = selectedThread?.id;
      
      // Check if thread already exists with this recipient
      if (!threadId || selectedThread?.other_participant?.id !== recipientId) {
        // First, check if a thread already exists in the current threads list
        const existingThread = threads.find(
          (t) => t.other_participant?.id === recipientId
        );
        
        if (existingThread) {
          threadId = existingThread.id;
          // Select the existing thread
          setSelectedThread(existingThread);
          console.log(`✅ Using existing thread: ${threadId}`);
        } else {
          // If no existing thread found, create a new one
          const threadRes = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              thread_type: 'dm',
              recipient_id: recipientId
            })
          });

          const threadData = await threadRes.json();
          if (!threadRes.ok) {
            throw new Error(threadData.error || 'Failed to create thread');
          }
          threadId = threadData.message.id;
          
          // Immediately add the new thread to the list so it appears right away
          // We'll reload threads after sending the message to get the full data
          if (threadData.message) {
            // Get recipient info to create a temporary thread object
            const recipient = allRecipients.find((r: any) => r.id === recipientId);
            console.log(`🔍 Looking for recipient ${recipientId} in allRecipients (${allRecipients.length} total)`);
            if (recipient) {
              console.log(`✅ Found recipient: ${recipient.first_name} ${recipient.last_name || ''}, type: ${(recipient as any).type}`);
              const newThread: MessageThreadWithParticipants = {
                id: threadData.message.id,
                org_id: orgId || '',
                thread_type: 'dm',
                subject: null,
                created_by: session?.user?.id || '',
                deleted_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                unread: false,
                unread_count: 0,
                latest_item: undefined,
                other_participant: {
                  id: recipient.id,
                  first_name: recipient.first_name || '',
                  last_name: recipient.last_name || null,
                  email: recipient.email || '',
                  role: (recipient as any).type || (recipient as any).role || 'guardian' // Use type as role
                }
              };
              
              // Add to threads list immediately
              setThreads(prev => {
                // Check if already exists
                if (prev.some(t => t.id === newThread.id)) {
                  console.log(`⚠️ Thread ${threadId} already exists in list`);
                  return prev;
                }
                // Add at the beginning
                console.log(`✅ Adding new thread to list: ${threadId} with role: ${newThread.other_participant?.role}, recipient type: ${(recipient as any).type}`);
                return [newThread, ...prev];
              });
              
              // Select the new thread
              setSelectedThread(newThread);
              console.log(`✅ Added new thread to list immediately: ${threadId} (${newThread.other_participant?.first_name} ${newThread.other_participant?.last_name || ''})`);
            } else {
              console.warn(`⚠️ Recipient ${recipientId} not found in allRecipients. Available recipients:`, allRecipients.map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name || ''}`, type: (r as any).type })));
            }
          }
        }
      }

      const messageRes = await fetch('/api/message-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: threadId,
          body: messageBody.trim()
        })
      });

      const messageData = await messageRes.json();
      if (!messageRes.ok) {
        throw new Error(messageData.error || 'Failed to send message');
      }

      // Add message to local state immediately for better UX
      if (messageData.item) {
        setMessages(prev => {
          // Check if message already exists (avoid duplicates)
          if (prev.some(m => m.id === messageData.item.id)) {
            return prev;
          }
          return [...prev, messageData.item];
        });
        
        // Update thread's latest_item
        setThreads(prev => prev.map(t => 
          t.id === threadId 
            ? { ...t, latest_item: messageData.item, updated_at: messageData.item.created_at }
            : t
        ));
        
        // Update selected thread
        setSelectedThread(prev => prev ? { ...prev, latest_item: messageData.item, updated_at: messageData.item.created_at } : null);
        
        console.log(`✅ Added message to local state: ${messageData.item.id}`);
      }

      setSent(true);
      setTimeout(() => setSent(false), 1200);
      setMessageBody('');
      setRecipientId('');
      setShowNewConversation(false);

      // Reload threads to show the new conversation in the list
      // Don't filter here - let the useMemo handle filtering based on role and allowedGuardianIds
      const currentSession = session;
      if (currentSession?.user?.id) {
        const threadsRes = await fetch(`/api/messages?userId=${currentSession.user.id}&t=${Date.now()}`, { cache: 'no-store' });
        const threadsData = await threadsRes.json();
        if (threadsRes.ok && threadsData.threads) {
          // Load all threads - filtering will be handled by useMemo
          console.log(`📥 Reloaded ${threadsData.threads.length} threads after sending message`);
          
          // Merge with existing threads to preserve the one we just added if it's not in the response yet
          setThreads(prev => {
            const serverThreadIds = new Set(threadsData.threads.map((t: any) => t.id));
            // Keep threads that are in server response or were just added
            const existingThreads = prev.filter(t => serverThreadIds.has(t.id) || t.id === threadId);
            // Add new threads from server that we don't have
            const newThreads = threadsData.threads.filter((t: any) => !prev.some(pt => pt.id === t.id));
            // Combine and sort by updated_at (most recent first)
            const combined = [...existingThreads, ...newThreads];
            combined.sort((a, b) => {
              const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
              const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
              return bTime - aTime;
            });
            console.log(`📊 Merged threads: ${prev.length} existing -> ${combined.length} total (${newThreads.length} new from server)`);
            
            // Find and select the thread (either newly created or existing)
            const targetThread = combined.find((t: any) => t.id === threadId);
            if (targetThread) {
              console.log(`✅ Found target thread: ${threadId}, selecting it`);
              
              // Set flag to prevent useEffect from interfering
              isManuallyLoadingMessagesRef.current = true;
              
              // Always reload messages from server to ensure we have the complete list including the message we just sent
              // This ensures the message appears in the list even if there was a timing issue
              fetch(`/api/message-items?messageId=${threadId}&t=${Date.now()}`, { cache: 'no-store' })
                .then(messagesRes => messagesRes.json())
                .then(messagesData => {
                  if (messagesData.items) {
                    setMessages(messagesData.items);
                    console.log(`✅ Reloaded ${messagesData.items.length} messages for thread (including new message)`);
                  }
                  
                  // Reset flag and update selected thread after messages are loaded
                  isManuallyLoadingMessagesRef.current = false;
                  setSelectedThread(targetThread);
                })
                .catch(err => {
                  console.error('Error loading messages:', err);
                  // Reset flag and still update selected thread even if message loading fails
                  isManuallyLoadingMessagesRef.current = false;
                  setSelectedThread(targetThread);
                });
            } else {
              console.warn(`⚠️ Target thread ${threadId} not found in merged threads`);
            }
            
            return combined;
          });
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] rounded-ds-lg border border-slate-200 bg-white shadow-ds-card dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
      {/* Left Sidebar - Conversations List */}
      <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Header with New Conversation Button */}
        <div className="p-ds-sm border-b border-slate-200 dark:border-slate-700 bg-mint-50 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.messages || 'Conversations'}</h2>
            <button
              onClick={() => {
                setShowNewConversation(!showNewConversation);
                setSelectedThread(null);
              }}
              className="p-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 text-white transition-colors"
              title={t.new_message}
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          </div>

          {/* New Conversation Form */}
          {showNewConversation && (
            <div className="p-3 bg-white dark:bg-slate-800 rounded-ds-md border border-slate-200 dark:border-slate-700 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-ds-small font-medium text-slate-900 dark:text-slate-100">{t.new_message}</span>
                <button
                  onClick={() => {
                    setShowNewConversation(false);
                    setRecipientId('');
                    setMessageBody('');
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="block text-ds-tiny text-slate-700 dark:text-slate-300 mb-1">
                {t.to}
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="mt-1 w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-2 py-1.5 text-ds-small dark:text-slate-200 focus:border-mint-500 focus:ring-mint-500"
                >
                  <option value="">{t.select_recipient}</option>
                  {role === 'principal' && (
                    <>
                      {teachers.length > 0 && (
                        <optgroup label={t.role_teacher_title || 'Teacher'}>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.first_name} {t.last_name || ''} ({t.email})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {guardians.length > 0 && (
                        <optgroup label={t.guardian}>
                          {guardians.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.first_name} {g.last_name || ''} ({g.email})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                  {role === 'teacher' && (
                    <>
                      {principals.length > 0 && (
                        <optgroup label={t.principal}>
                          {principals.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.first_name} {p.last_name || ''} ({p.email})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {teachers.length > 0 && (
                        <optgroup label={t.role_teacher_title || 'Teacher'}>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.first_name} {t.last_name || ''} ({t.email})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {guardians.length > 0 && (
                        <optgroup label={t.guardian}>
                          {guardians
                            .filter((g) => {
                              // For teachers, only show guardians in allowedGuardianIds if it's populated
                              // If allowedGuardianIds is empty, show all (they'll be filtered when it loads)
                              if (allowedGuardianIds.size > 0) {
                                return allowedGuardianIds.has(g.id);
                              }
                              return true;
                            })
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.first_name} {g.last_name || ''} ({g.email})
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </>
                  )}
                  {role === 'guardian' && (
                    <>
                      {principals.length > 0 && (
                        <optgroup label={t.principal}>
                          {principals.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.first_name} {p.last_name || ''} ({p.email})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {(() => {
                        console.log(`🔍 [Guardian Chat] Render check: teachers.length = ${teachers.length}, teachers =`, teachers);
                        return teachers.length > 0 ? (
                          <optgroup label={t.role_teacher_title || 'Teacher'}>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.first_name} {t.last_name || ''} ({t.email})
                              </option>
                            ))}
                          </optgroup>
                        ) : null;
                      })()}
                    </>
                  )}
                </select>
              </label>
              <label className="block text-ds-tiny text-slate-700 dark:text-slate-300 mt-2 mb-2">
                {t.message}
                <textarea
                  rows={2}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="mt-1 w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-2 py-1.5 text-ds-small dark:text-slate-200 dark:placeholder-slate-400 resize-none focus:border-mint-500 focus:ring-mint-500"
                  placeholder={t.msg_ph}
                />
              </label>
              <button
                onClick={sendMessage}
                disabled={sending || !messageBody.trim() || !recipientId}
                className="w-full rounded-ds-md bg-mint-500 px-3 py-1.5 text-ds-small text-white hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" /> {t.send}
              </button>
              {sent && <span className="text-ds-tiny text-mint-600 dark:text-mint-400 mt-1 block text-center">✓ {t.message_sent}</span>}
            </div>
          )}

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-[#F5FFF7] dark:bg-slate-800 rounded-ds-md border border-[#D8EBD8] dark:border-slate-700 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t.search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-ds-small outline-none placeholder:text-slate-400 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full animate-pulse bg-slate-200 dark:bg-slate-700"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-ds-sm"></div>
                      <div className="h-3 w-24 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-ds-sm"></div>
                      <div className="h-3 w-full animate-pulse bg-slate-200 dark:bg-slate-700 rounded-ds-sm"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4">
              <EmptyState
                lang={lang}
                icon={MessageSquare}
                title={t.no_messages_title || 'No Messages'}
                description={t.no_messages_description || 'No message threads yet. Start a conversation to get started.'}
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredThreads.map((thread) => (
                <li
                  key={thread.id}
                  onClick={() => {
                    setSelectedThread(thread);
                    setShowNewConversation(false);
                    setChatMessageBody('');
                  }}
                  className={`cursor-pointer p-4 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors ${
                    selectedThread?.id === thread.id ? 'bg-mint-100 dark:bg-slate-800/50 border-l-4 border-mint-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {thread.other_participant
                              ? `${thread.other_participant.first_name} ${thread.other_participant.last_name || ''}`.trim() || thread.other_participant.email
                              : 'Unknown'}
                          </div>
                          {thread.unread && (
                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-mint-500"></span>
                          )}
                        </div>
                        {thread.latest_item && (
                          <span className="text-ds-tiny text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                            {new Date(thread.latest_item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-ds-tiny text-slate-500 dark:text-slate-400 mb-1">
                        <span>
                          {thread.other_participant?.role === 'principal' ? t.principal :
                           thread.other_participant?.role === 'teacher' ? (t.role_teacher_title || 'Teacher') : t.guardian}
                        </span>
                      </div>
                      {thread.latest_item && (
                        <p className="text-ds-small text-slate-600 dark:text-slate-400 truncate line-clamp-1">
                          {thread.latest_item.body}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Side - Chat View */}
      <div className="flex-1 flex flex-col bg-mint-50 dark:bg-slate-900">
        {selectedThread ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mint-500 flex items-center justify-center text-white font-semibold">
                  {selectedThread.other_participant
                    ? (selectedThread.other_participant.first_name?.[0] || selectedThread.other_participant.email?.[0] || '?').toUpperCase()
                    : '?'}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedThread.other_participant
                      ? `${selectedThread.other_participant.first_name} ${selectedThread.other_participant.last_name || ''}`.trim() || selectedThread.other_participant.email
                      : 'Unknown'}
                  </div>
                  <div className="text-ds-tiny text-slate-500 dark:text-slate-400">
                    {selectedThread.other_participant?.role === 'principal' ? t.principal :
                     selectedThread.other_participant?.role === 'teacher' ? (t.role_teacher_title || 'Teacher') : t.guardian}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-slate-500 dark:text-slate-400">{t.no_messages}</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isOwn = msg.author_id === session?.user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-ds-lg px-4 py-2 ${
                            isOwn
                              ? 'bg-mint-500 text-white rounded-br-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <p className="text-ds-small whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className={`text-ds-tiny mt-1 ${isOwn ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-end gap-2">
                <button className="p-2 rounded-ds-md hover:bg-mint-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                  <Paperclip className="h-5 w-5" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={chatMessageBody}
                    onChange={(e) => {
                      setChatMessageBody(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    placeholder={t.msg_ph}
                    rows={1}
                    className="w-full rounded-ds-md border border-[#D8EBD8] dark:border-slate-600 bg-[#F5FFF7] dark:bg-slate-900 px-4 py-2 pr-12 text-ds-small dark:text-slate-200 dark:placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent max-h-[120px] overflow-y-auto"
                  />
                </div>
                <button
                  onClick={sendChatMessage}
                  disabled={sending || !chatMessageBody.trim()}
                  className="p-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquarePlus className="h-16 w-16 text-mint-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{t.select_recipient}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

