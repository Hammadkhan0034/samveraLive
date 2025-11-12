'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Send, Paperclip, Search } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';

type Lang = 'is' | 'en';

interface GuardianMessagesPanelProps {
  t: typeof enText;
  lang?: Lang;
}

const enText = {
  msg_title: 'Messages',
  msg_hint: 'Chat with principal and teachers.',
  inbox: 'Inbox',
  unread: 'new',
  new_message: 'New message',
  to: 'To',
  message: 'Message',
  msg_ph: 'Write a message...',
  send: 'Send',
  attach: 'Attach',
  sent: 'Sent',
  select_recipient: 'Select recipient',
  no_threads: 'No messages yet',
  no_messages: 'No messages in this thread',
  loading: 'Loading...',
  error_loading: 'Error loading messages',
  send_message: 'Send message',
  search_placeholder: 'Search conversations...',
  teacher: 'Teacher',
  guardian: 'Guardian',
  principal: 'Principal',
};

const isText = {
  msg_title: 'Skilaboð',
  msg_hint: 'Spjalla við stjórnanda og kennara.',
  inbox: 'Innhólf',
  unread: 'nýtt',
  new_message: 'Ný skilaboð',
  to: 'Til',
  message: 'Skilaboð',
  msg_ph: 'Skrifa skilaboð...',
  send: 'Senda',
  attach: 'Hengja við',
  sent: 'Sent',
  select_recipient: 'Veldu viðtakanda',
  no_threads: 'Engin skilaboð enn',
  no_messages: 'Engin skilaboð í þessum þræði',
  loading: 'Hleður...',
  error_loading: 'Villa við að hlaða skilaboðum',
  send_message: 'Senda skilaboð',
  search_placeholder: 'Leita í samtalum...',
  teacher: 'Kennari',
  guardian: 'Forráðamaður',
  principal: 'Stjórnandi',
};

export default function GuardianMessagesPanel({ t, lang = 'en' }: GuardianMessagesPanelProps) {
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
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedStudentClassIds, setLinkedStudentClassIds] = useState<Set<string>>(new Set());

  const userMetadata = session?.user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const guardianId = session?.user?.id;

  // Load guardian's linked students and their class IDs
  useEffect(() => {
    if (!orgId || !guardianId) {
      setLinkedStudentClassIds(new Set());
      return;
    }

    async function loadLinkedStudents() {
      try {
        // Get guardian's linked students
        const studentsRes = await fetch(`/api/guardian-students?guardianId=${guardianId}&t=${Date.now()}`, { cache: 'no-store' });
        const studentsData = await studentsRes.json();
        if (studentsRes.ok && studentsData.relationships) {
          const studentIds = studentsData.relationships.map((r: any) => r.student_id).filter(Boolean);
          
          if (studentIds.length > 0) {
            // Get students with their class_ids
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
  }, [orgId, guardianId]);

  // Load principals separately to ensure they always load
  useEffect(() => {
    if (!orgId) return;

    async function loadPrincipalsOnly() {
      try {
        const principalsRes = await fetch(`/api/principals?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
        const principalsData = await principalsRes.json();
        if (principalsRes.ok && principalsData.principals && Array.isArray(principalsData.principals)) {
          setPrincipals(principalsData.principals.map((p: any) => ({
            id: p.id,
            first_name: p.first_name || '',
            last_name: p.last_name || null,
            email: p.email || '',
            role: 'principal'
          })));
          console.log('✅ Loaded principals for guardian (separate effect):', principalsData.principals.length);
        } else {
          console.warn('⚠️ Failed to load principals:', { ok: principalsRes.ok, data: principalsData });
          setPrincipals([]);
        }
      } catch (error) {
        console.error('❌ Error loading principals:', error);
        setPrincipals([]);
      }
    }

    loadPrincipalsOnly();
  }, [orgId]);

  // Load recipients (principals and teachers)
  useEffect(() => {
    if (!orgId) return;

    async function loadRecipients() {
      setLoadingRecipients(true);
      try {
        // Load principals - always try to load, even if it fails
        try {
          const principalsRes = await fetch(`/api/principals?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
          const principalsData = await principalsRes.json();
          if (principalsRes.ok && principalsData.principals && Array.isArray(principalsData.principals)) {
            setPrincipals(principalsData.principals.map((p: any) => ({
              id: p.id,
              first_name: p.first_name || '',
              last_name: p.last_name || null,
              email: p.email || '',
              role: 'principal'
            })));
            console.log('✅ Loaded principals for guardian:', principalsData.principals.length);
          } else {
            console.warn('⚠️ Failed to load principals:', { ok: principalsRes.ok, data: principalsData });
            // Don't clear principals if they were already loaded
          }
        } catch (error) {
          console.error('❌ Error loading principals:', error);
          // Don't clear principals if they were already loaded
        }

        // Load teachers - only those assigned to guardian's students' classes
        const teacherIdsSet = new Set<string>();
        
        if (linkedStudentClassIds.size > 0) {
          const classIdsArray = Array.from(linkedStudentClassIds);
          console.log('📚 Loading teachers for guardian - student class IDs:', classIdsArray);
          
          // Fetch all classes once, then filter
          try {
            const classesRes = await fetch(`/api/classes?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const classesData = await classesRes.json();
            if (classesRes.ok && classesData.classes) {
              // Filter to only classes where guardian's students are enrolled
              const relevantClasses = classesData.classes.filter((c: any) => classIdsArray.includes(c.id));
              console.log('📚 Found relevant classes:', relevantClasses.length, 'out of', classesData.classes.length);
              
              // Extract teacher IDs from all relevant classes
              relevantClasses.forEach((classData: any) => {
                if (classData?.assigned_teachers && Array.isArray(classData.assigned_teachers)) {
                  classData.assigned_teachers.forEach((teacher: any) => {
                    if (teacher?.id) {
                      teacherIdsSet.add(teacher.id);
                    }
                  });
                }
                // Also check class_memberships if available
                if (classData?.class_memberships && Array.isArray(classData.class_memberships)) {
                  classData.class_memberships.forEach((membership: any) => {
                    if (membership?.teacher_id) {
                      teacherIdsSet.add(membership.teacher_id);
                    }
                  });
                }
              });
              console.log('👨‍🏫 Found teacher IDs from classes:', teacherIdsSet.size);
            } else {
              console.warn('⚠️ Failed to load classes:', classesData);
            }
          } catch (error) {
            console.error('❌ Error loading classes for teachers:', error);
          }
        }

        // If we found teachers, fetch their details
        if (teacherIdsSet.size > 0) {
          const teacherIdsArray = Array.from(teacherIdsSet);
          const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
          const teachersData = await teachersRes.json();
          if (teachersRes.ok && teachersData.staff) {
            // Filter to only include teachers assigned to guardian's students' classes
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
            console.log('✅ Loaded teachers for guardian:', filteredTeachers.length);
          } else {
            console.warn('⚠️ Failed to load teachers from staff-management:', teachersData);
            // Fallback: try to load all teachers if class-based filtering fails
            setTeachers([]);
          }
        } else {
          console.warn('⚠️ No teachers found for guardian\'s students classes. linkedStudentClassIds:', linkedStudentClassIds.size);
          // Fallback: load all teachers if no class-based teachers found
          try {
            const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
            const teachersData = await teachersRes.json();
            if (teachersRes.ok && teachersData.staff) {
              // Filter to only teachers (not principals)
              const teacherRoleStaff = teachersData.staff
                .filter((t: any) => (t.role || 'teacher') === 'teacher')
                .map((t: any) => ({
                  id: t.id,
                  first_name: t.first_name || '',
                  last_name: t.last_name || null,
                  email: t.email || '',
                  role: t.role || 'teacher'
                }));
              setTeachers(teacherRoleStaff);
              console.log('✅ Fallback: Loaded all teachers for guardian:', teacherRoleStaff.length);
            } else {
              setTeachers([]);
            }
          } catch (error) {
            console.error('❌ Error in fallback teacher loading:', error);
            setTeachers([]);
          }
        }
      } catch (error) {
        console.error('Error loading recipients:', error);
      } finally {
        setLoadingRecipients(false);
      }
    }

    loadRecipients();
  }, [orgId, linkedStudentClassIds]);

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
          setThreads(json.threads);
          // Auto-select first thread if available
          if (json.threads.length > 0 && !selectedThread) {
            setSelectedThread(json.threads[0]);
          }
        }
      } catch (error) {
        console.error('Error loading threads:', error);
      } finally {
        setLoading(false);
      }
    }

    loadThreads();
  }, [session?.user?.id]);

  // Set recipientId when thread is selected
  useEffect(() => {
    if (selectedThread?.other_participant?.id) {
      setRecipientId(selectedThread.other_participant.id);
    }
  }, [selectedThread]);

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
      setThreads(prev => {
        // Check if thread already exists (avoid duplicates)
        if (prev.some(t => t.id === newThread.id)) {
          return prev;
        }
        // Add new thread at the beginning
        return [newThread, ...prev];
      });
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

  // Combined recipients list
  const allRecipients = useMemo(() => {
    const principalList = principals.map(p => ({ ...p, type: 'principal' as const }));
    const teacherList = teachers.map(t => ({ ...t, type: 'teacher' as const }));
    return [...principalList, ...teacherList];
  }, [principals, teachers]);

  async function sendMessage() {
    if (!messageBody.trim() || !recipientId || !session?.user?.id) return;

    setSending(true);
    try {
      // Check if thread already exists with this recipient
      let threadId = selectedThread?.id;
      
      if (!threadId || selectedThread?.other_participant?.id !== recipientId) {
        // Create new thread
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

      // Send message
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
      // Don't clear recipientId if replying to existing thread - keep it set so dropdown shows the recipient
      // Only clear if this was a new thread
      if (!selectedThread || selectedThread.other_participant?.id !== recipientId) {
        setRecipientId('');
      }

      // Reload threads and messages
      const currentSession = session;
      if (currentSession?.user?.id) {
        const threadsRes = await fetch(`/api/messages?userId=${currentSession.user.id}&t=${Date.now()}`, { cache: 'no-store' });
        const threadsData = await threadsRes.json();
        if (threadsRes.ok && threadsData.threads) {
          setThreads(threadsData.threads);
          const newThread = threadsData.threads.find((t: any) => t.id === threadId);
          if (newThread) {
            setSelectedThread(newThread);
            // Update recipientId to match the selected thread
            if (newThread.other_participant?.id) {
              setRecipientId(newThread.other_participant.id);
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
                      {thread.other_participant?.role === 'principal' ? t.principal : t.teacher}
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
                {loadingRecipients ? (
                  <option value="" disabled>Loading recipients...</option>
                ) : (
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
                    {!loadingRecipients && principals.length === 0 && teachers.length === 0 && (
                      <option value="" disabled>No recipients available</option>
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

