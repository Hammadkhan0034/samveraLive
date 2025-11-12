'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Send, Paperclip, Search } from 'lucide-react';
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

  const userMetadata = session?.user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const guardianId = session?.user?.id;

  // Load guardians linked to teacher's students (for teacher role)
  useEffect(() => {
    if (role !== 'teacher' || !orgId || students.length === 0) {
      setAllowedGuardianIds(new Set());
      return;
    }

    async function loadAllowedGuardians() {
      try {
        const studentIds = students.map(s => s.id).filter(Boolean);
        if (studentIds.length === 0) {
          setAllowedGuardianIds(new Set());
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

        setAllowedGuardianIds(guardianIdsSet);
      } catch (error) {
        console.error('Error loading allowed guardians:', error);
        setAllowedGuardianIds(new Set());
      }
    }

    loadAllowedGuardians();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, role, JSON.stringify(students.map(s => s.id).sort())]);

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

    async function loadRecipients() {
      setLoadingRecipients(true);
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
            // For teachers, load other teachers (excluding current user)
            const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const teachersData = await teachersRes.json();
            if (teachersRes.ok && teachersData.staff) {
              // Filter to only teachers (not principals) and exclude current user
              const teacherRoleStaff = teachersData.staff
                .filter((t: any) => (t.role || 'teacher') === 'teacher' && t.id !== session?.user?.id);
              setTeachers(teacherRoleStaff.map((t: any) => ({
                id: t.id,
                first_name: t.first_name || '',
                last_name: t.last_name || null,
                email: t.email || '',
                role: t.role || 'teacher'
              })));
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
                  if (classData?.assigned_teachers && Array.isArray(classData.assigned_teachers)) {
                    classData.assigned_teachers.forEach((teacher: any) => {
                      if (teacher?.id) {
                        teacherIdsSet.add(teacher.id);
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
                const filteredTeachers = teachersData.staff
                  .filter((t: any) => teacherIdsArray.includes(t.id))
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
      }
    }

    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, role, session?.user?.id, Array.from(allowedGuardianIds).sort().join(','), Array.from(linkedStudentClassIds).sort().join(',')]);

  // Load message threads
  useEffect(() => {
    if (!session?.user?.id) return;

    async function loadThreads() {
      const currentSession = session;
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
      }
    }

    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, role, Array.from(allowedGuardianIds).sort().join(',')]);

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

  async function sendMessage() {
    if (!messageBody.trim() || !recipientId || !session?.user?.id) return;

    setSending(true);
    try {
      let threadId = selectedThread?.id;
      
      if (!threadId || selectedThread?.other_participant?.id !== recipientId) {
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
          const newThread = filteredThreads.find((t: any) => t.id === threadId);
          if (newThread) {
            setSelectedThread(newThread);
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.msg_title}</h2>
        <div className="text-sm text-slate-500 dark:text-slate-400">{t.msg_hint}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr,380px]">
        {/* Thread list */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-600">
          <div className="border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder={t.search_placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 px-3 py-2 border-b border-slate-200 dark:border-slate-600">
            {t.inbox}
          </div>
          {!loading && filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">{t.no_threads}</div>
          ) : loading ? null : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-600 max-h-[600px] overflow-y-auto">
              {filteredThreads.map((thread) => (
                <li
                  key={thread.id}
                  onClick={() => setSelectedThread(thread)}
                  className={`cursor-pointer p-3 hover:bg-slate-50 dark:hover:bg-slate-700 ${
                    selectedThread?.id === thread.id ? 'bg-slate-100 dark:bg-slate-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {thread.other_participant
                        ? `${thread.other_participant.first_name} ${thread.other_participant.last_name || ''}`.trim() || thread.other_participant.email
                        : 'Unknown'}
                    </div>
                    {thread.unread && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {thread.other_participant?.role === 'principal' ? t.principal : 
                       thread.other_participant?.role === 'teacher' ? t.teacher : t.guardian}
                    </span>
                    {thread.latest_item && (
                      <p className="flex-1 line-clamp-1 text-sm text-slate-600 dark:text-slate-400">
                        {thread.latest_item.body}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Message view and composer */}
        <div className="space-y-4">
          {/* Selected thread messages */}
          {selectedThread && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-600 dark:bg-slate-700 max-h-[400px] overflow-y-auto">
              <div className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                {selectedThread.other_participant
                  ? `${selectedThread.other_participant.first_name} ${selectedThread.other_participant.last_name || ''}`.trim() || selectedThread.other_participant.email
                  : 'Unknown'}
              </div>
              {messages.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">{t.no_messages}</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-lg ${
                        msg.author_id === session?.user?.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 ml-auto text-right'
                          : 'bg-slate-100 dark:bg-slate-600'
                      }`}
                    >
                      <p className="text-sm text-slate-900 dark:text-slate-100">{msg.body}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Composer */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-600 dark:bg-slate-700">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">{t.new_message}</div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
              {t.to}
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
            <label className="block text-sm text-slate-700 dark:text-slate-300 mt-2">
              {t.message}
              <textarea
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-400"
                placeholder={t.msg_ph}
              />
            </label>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={sendMessage}
                disabled={sending || !messageBody.trim() || !recipientId}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}

