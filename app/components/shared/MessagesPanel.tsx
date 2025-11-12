'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Paperclip, Search, MessageSquarePlus, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';

type Lang = 'is' | 'en';
type Role = 'principal' | 'teacher' | 'guardian';

interface MessagesPanelProps {
  t: {
    msg_title: string;
    msg_hint: string;
    inbox: string;
    unread: string;
    new_message: string;
    to: string;
    message: string;
    msg_ph: string;
    send: string;
    attach: string;
    sent: string;
    select_recipient: string;
    no_threads: string;
    no_messages: string;
    loading: string;
    error_loading: string;
    send_message: string;
    search_placeholder: string;
    teacher: string;
    guardian: string;
    principal: string;
  };
  lang?: Lang;
  role: Role;
  teacherClasses?: any[];
  students?: Array<{ id: string; class_id: string | null }>;
}

export default function MessagesPanel({ t, lang = 'en', role, teacherClasses = [], students = [] }: MessagesPanelProps) {
  const { session } = useAuth();
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
        const studentsRes = await fetch(`/api/guardian-students?guardianId=${guardianId}&t=${Date.now()}`, { cache: 'no-store' });
        const studentsData = await studentsRes.json();
        if (studentsRes.ok && studentsData.relationships) {
          const studentIds = studentsData.relationships.map((r: any) => r.student_id).filter(Boolean);
          
          if (studentIds.length > 0) {
            const studentsDetailsRes = await fetch(`/api/students?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const studentsDetails = await studentsDetailsRes.json();
            if (studentsDetailsRes.ok && studentsDetails.students) {
              const classIdsSet = new Set<string>();
              studentsDetails.students
                .filter((s: any) => studentIds.includes(s.id))
                .forEach((s: any) => {
                  const classId = s.class_id || s.classes?.id;
                  if (classId) {
                    classIdsSet.add(classId);
                  }
                });
              setLinkedStudentClassIds(classIdsSet);
            } else {
              setLinkedStudentClassIds(new Set());
            }
          } else {
            setLinkedStudentClassIds(new Set());
          }
        } else {
          setLinkedStudentClassIds(new Set());
        }
      } catch (error) {
        console.error('Error loading linked students:', error);
        setLinkedStudentClassIds(new Set());
      }
    }

    loadLinkedStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, guardianId, role]);

  // Load recipients based on role
  useEffect(() => {
    if (!orgId) return;

    // Calculate keys inside effect to avoid recalculation on every render
    const currentAllowedKey = Array.from(allowedGuardianIds).sort().join(',');
    const currentLinkedKey = Array.from(linkedStudentClassIds).sort().join(',');
    
    // Only run if keys actually changed
    if (prevAllowedGuardianIdsRef.current === currentAllowedKey && 
        prevLinkedStudentClassIdsRef.current === currentLinkedKey &&
        prevAllowedGuardianIdsRef.current !== '' && 
        prevLinkedStudentClassIdsRef.current !== '') {
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
              const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
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
          } else if (role === 'guardian' && linkedStudentClassIds.size > 0) {
            // For guardians, load teachers assigned to their students' classes
            const classIdsArray = Array.from(linkedStudentClassIds);
            const teacherIdsSet = new Set<string>();
            
            try {
              const classesRes = await fetch(`/api/classes?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
              const classesData = await classesRes.json();
              if (classesRes.ok && classesData.classes) {
                const relevantClasses = classesData.classes.filter((c: any) => classIdsArray.includes(c.id));
                relevantClasses.forEach((classData: any) => {
                  // Check for assigned_teachers array
                  if (classData?.assigned_teachers && Array.isArray(classData.assigned_teachers)) {
                    classData.assigned_teachers.forEach((teacher: any) => {
                      // Handle both object format {id, first_name, ...} and just id
                      const teacherId = teacher?.id || teacher;
                      if (teacherId) {
                        teacherIdsSet.add(teacherId);
                      }
                    });
                  }
                });
              }
            } catch (error) {
              console.error('Error loading classes for teachers:', error);
            }

            if (teacherIdsSet.size > 0) {
              const teacherIdsArray = Array.from(teacherIdsSet);
              const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
              const teachersData = await teachersRes.json();
              if (teachersRes.ok && teachersData.staff) {
                // Filter to only teachers (not principals) and match the IDs from classes
                const filteredTeachers = teachersData.staff
                  .filter((t: any) => {
                    const isTeacher = (t.role || 'teacher') === 'teacher';
                    const isAssigned = teacherIdsArray.includes(t.id);
                    return isTeacher && isAssigned;
                  })
                  .map((t: any) => ({
                    id: t.id,
                    first_name: t.first_name || '',
                    last_name: t.last_name || null,
                    email: t.email || '',
                    role: t.role || 'teacher'
                  }));
                setTeachers(filteredTeachers);
              } else {
                setTeachers([]);
              }
            } else {
              // If no teachers found for specific classes, still try to load all teachers as fallback
              const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
              const teachersData = await teachersRes.json();
              if (teachersRes.ok && teachersData.staff) {
                // Filter to only teachers (not principals)
                const teacherRoleStaff = teachersData.staff.filter((t: any) => (t.role || 'teacher') === 'teacher');
                setTeachers(teacherRoleStaff.map((t: any) => ({
                  id: t.id,
                  first_name: t.first_name || '',
                  last_name: t.last_name || null,
                  email: t.email || '',
                  role: t.role || 'teacher'
                })));
              } else {
                setTeachers([]);
              }
            }
          } else if (role === 'guardian') {
            // For guardians without linked student classes, load all teachers as fallback
            const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const teachersData = await teachersRes.json();
            if (teachersRes.ok && teachersData.staff) {
              // Filter to only teachers (not principals)
              const teacherRoleStaff = teachersData.staff.filter((t: any) => (t.role || 'teacher') === 'teacher');
              setTeachers(teacherRoleStaff.map((t: any) => ({
                id: t.id,
                first_name: t.first_name || '',
                last_name: t.last_name || null,
                email: t.email || '',
                role: t.role || 'teacher'
              })));
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
          if (role === 'teacher' && allowedGuardianIds.size > 0) {
            // For teachers, only load guardians linked to their students
            const guardianIdsArray = Array.from(allowedGuardianIds);
            const guardiansRes = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const guardiansData = await guardiansRes.json();
            if (guardiansRes.ok && guardiansData.guardians) {
              const filteredGuardians = guardiansData.guardians
                .filter((g: any) => guardianIdsArray.includes(g.id))
                .map((g: any) => ({
                  id: g.id,
                  first_name: g.first_name || '',
                  last_name: g.last_name || null,
                  email: g.email || ''
                }));
              setGuardians(filteredGuardians);
            } else {
              setGuardians([]);
            }
          } else {
            // For principals, load all guardians
            const guardiansRes = await fetch(`/api/guardians?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const guardiansData = await guardiansRes.json();
            if (guardiansRes.ok && guardiansData.guardians) {
              setGuardians(guardiansData.guardians.map((g: any) => ({
                id: g.id,
                first_name: g.first_name || '',
                last_name: g.last_name || null,
                email: g.email || ''
              })));
            }
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
    // Size changes trigger re-check, but content comparison prevents unnecessary loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, role, session?.user?.id, allowedGuardianIds.size, linkedStudentClassIds.size]);

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
        const res = await fetch(`/api/messages?userId=${currentSession.user.id}&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.threads) {
          let filteredThreads = json.threads;

          // Filter threads for teacher role - only show principals, other teachers, and allowed guardians
          if (role === 'teacher') {
            filteredThreads = filteredThreads.filter((thread: MessageThreadWithParticipants) => {
              const otherParticipant = thread.other_participant;
              if (!otherParticipant) return false;
              if (otherParticipant.role === 'principal') return true;
              if (otherParticipant.role === 'teacher') return true;
              if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
                return allowedGuardianIds.has(otherParticipant.id);
              }
              return false;
            });
          }

          setThreads(filteredThreads);
          if (filteredThreads.length > 0 && !selectedThread) {
            setSelectedThread(filteredThreads[0]);
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
    // Size changes trigger re-check, but content comparison prevents unnecessary loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, role, allowedGuardianIds.size]);

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
    userId: session?.user?.id || '',
    orgId: orgId || '',
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
      // Filter thread for teacher role if needed
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
          shouldAdd = allowedGuardianIds.has(otherParticipant.id);
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

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(thread => {
      const otherParticipant = thread.other_participant;
      if (!otherParticipant) return false;
      const name = `${otherParticipant.first_name} ${otherParticipant.last_name || ''}`.toLowerCase();
      const email = otherParticipant.email?.toLowerCase() || '';
      return name.includes(query) || email.includes(query);
    });
  }, [threads, searchQuery]);

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

      setSent(true);
      setTimeout(() => setSent(false), 1200);
      setMessageBody('');
      setRecipientId('');
      setShowNewConversation(false);

      // Reload threads to show the new conversation in the list
      const currentSession = session;
      if (currentSession?.user?.id) {
        const threadsRes = await fetch(`/api/messages?userId=${currentSession.user.id}&t=${Date.now()}`, { cache: 'no-store' });
        const threadsData = await threadsRes.json();
        if (threadsRes.ok && threadsData.threads) {
          let filteredThreads = threadsData.threads;
          if (role === 'teacher') {
            filteredThreads = filteredThreads.filter((t: MessageThreadWithParticipants) => {
              const otherParticipant = t.other_participant;
              if (!otherParticipant) return false;
              if (otherParticipant.role === 'principal') return true;
              if (otherParticipant.role === 'teacher') return true;
              if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
                return allowedGuardianIds.has(otherParticipant.id);
              }
              return false;
            });
          }
          setThreads(filteredThreads);
          
          // Find and select the thread (either newly created or existing)
          const targetThread = filteredThreads.find((t: any) => t.id === threadId);
          if (targetThread) {
            setSelectedThread(targetThread);
            // Load messages for the selected thread
            const messagesRes = await fetch(`/api/message-items?messageId=${threadId}&t=${Date.now()}`, { cache: 'no-store' });
            const messagesData = await messagesRes.json();
            if (messagesRes.ok && messagesData.items) {
              setMessages(messagesData.items);
            }
          }
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
    <div className="flex h-[calc(100vh-200px)] rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
      {/* Left Sidebar - Conversations List */}
      <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Header with New Conversation Button */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.msg_title}</h2>
            <button
              onClick={() => {
                setShowNewConversation(!showNewConversation);
                setSelectedThread(null);
              }}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              title={t.new_message}
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          </div>
          
          {/* New Conversation Form */}
          {showNewConversation && (
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.new_message}</span>
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
              <label className="block text-xs text-slate-700 dark:text-slate-300 mb-1">
                {t.to}
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm dark:text-slate-200"
                >
                  <option value="">{t.select_recipient}</option>
                  {role === 'principal' && (
                    <>
                      {teachers.length > 0 && (
                        <optgroup label={t.teacher}>
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
                        <optgroup label={t.teacher}>
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
                      {teachers.length > 0 && (
                        <optgroup label={t.teacher}>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.first_name} {t.last_name || ''} ({t.email})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </label>
              <label className="block text-xs text-slate-700 dark:text-slate-300 mt-2 mb-2">
                {t.message}
                <textarea
                  rows={2}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm dark:text-slate-200 dark:placeholder-slate-400 resize-none"
                  placeholder={t.msg_ph}
                />
              </label>
              <button
                onClick={sendMessage}
                disabled={sending || !messageBody.trim() || !recipientId}
                className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" /> {t.send}
              </button>
              {sent && <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 block text-center">✓ {t.sent}</span>}
            </div>
          )}

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t.search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500">{t.loading}</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">{t.no_threads}</div>
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
                  className={`cursor-pointer p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    selectedThread?.id === thread.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {thread.other_participant
                            ? `${thread.other_participant.first_name} ${thread.other_participant.last_name || ''}`.trim() || thread.other_participant.email
                            : 'Unknown'}
                        </div>
                        {thread.unread && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600"></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>
                          {thread.other_participant?.role === 'principal' ? t.principal : 
                           thread.other_participant?.role === 'teacher' ? t.teacher : t.guardian}
                        </span>
                      </div>
                      {thread.latest_item && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate line-clamp-1">
                          {thread.latest_item.body}
                        </p>
                      )}
                      {thread.latest_item && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(thread.latest_item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
        {selectedThread ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
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
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedThread.other_participant?.role === 'principal' ? t.principal : 
                     selectedThread.other_participant?.role === 'teacher' ? t.teacher : t.guardian}
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
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-blue-600 text-white rounded-br-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
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
                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 pr-12 text-sm dark:text-slate-200 dark:placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-[120px] overflow-y-auto"
                  />
                </div>
                <button
                  onClick={sendChatMessage}
                  disabled={sending || !chatMessageBody.trim()}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquarePlus className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{t.select_recipient}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

