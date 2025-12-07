'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Search, Send, MessageSquarePlus, MessageSquare } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import EmptyState from '@/app/components/EmptyState';

type Recipient = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  role?: string;
};


/**
 * Filters threads to show only allowed participants for teachers
 */
function filterTeacherThreads(
  thread: MessageThreadWithParticipants,
  principals: Recipient[],
  allowedGuardianIds: Set<string>
): boolean {
  const otherParticipant = thread.other_participant;
  if (!otherParticipant) return false;

  // Always show principals
  if (otherParticipant.role === 'principal') return true;

  // Backup check: if participant ID is in principals list
  if (principals.length > 0 && principals.some((p) => p.id === otherParticipant.id)) {
    return true;
  }

  // Show other teachers
  if (otherParticipant.role === 'teacher') return true;

  // For guardians, only show if they're linked to teacher's students
  if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
    return allowedGuardianIds.has(otherParticipant.id);
  }

  return false;
}

export default function TeacherMessagesPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();

  // Messages state
  const [threads, setThreads] = useState<MessageThreadWithParticipants[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThreadWithParticipants | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sent, setSent] = useState(false);
  const [principals, setPrincipals] = useState<Recipient[]>([]);
  const [teachers, setTeachers] = useState<Recipient[]>([]);
  const [guardians, setGuardians] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allowedGuardianIds, setAllowedGuardianIds] = useState<Set<string>>(new Set());
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [chatMessageBody, setChatMessageBody] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; class_id: string | null }>>([]);
  const [messagesCount, setMessagesCount] = useState(0);

  // Load teacher classes and students
  useEffect(() => {

    async function loadTeacherClasses() {
      try {
        const response = await fetch('/api/teacher-classes', { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.classes) {
          setTeacherClasses(data.classes);
          // Load students for these classes
          const allStudents: Array<{ id: string; class_id: string | null }> = [];
          await Promise.all(
            data.classes.map(async (cls: { id: string }) => {
              try {
                const studentsRes = await fetch(`/api/students?classId=${cls.id}`, { cache: 'no-store' });
                const studentsData = await studentsRes.json();
                if (studentsRes.ok && studentsData.students) {
                  studentsData.students.forEach((s: { id: string }) => {
                    allStudents.push({ id: s.id, class_id: cls.id });
                  });
                }
              } catch (error) {
                console.error(`Error loading students for class ${cls.id}:`, error);
              }
            })
          );
          setStudents(allStudents);
        }
      } catch (error) {
        console.error('Error loading teacher classes:', error);
      }
    }

    loadTeacherClasses();
  }, []);

  // Load guardians linked to teacher's students
  useEffect(() => {
    if (students.length === 0) {
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
        await Promise.all(
          studentIds.map(async (studentId) => {
            try {
              const res = await fetch(`/api/guardian-students?studentId=${studentId}`, { cache: 'no-store' });
              const data = await res.json();
              if (res.ok && data.relationships) {
                data.relationships.forEach((rel: { guardian_id?: string }) => {
                  if (rel.guardian_id) {
                    guardianIdsSet.add(rel.guardian_id);
                  }
                });
              }
            } catch (error) {
              console.error(`Error loading guardians for student ${studentId}:`, error);
            }
          })
        );

        setAllowedGuardianIds(guardianIdsSet);
      } catch (error) {
        console.error('Error loading allowed guardians:', error);
        setAllowedGuardianIds(new Set());
      }
    }

    loadAllowedGuardians();
  }, [students]);

  // Load recipients (principals, teachers, and guardians)
  useEffect(() => {

    async function loadRecipients() {
      try {
        // Load all recipients in parallel
        const [principalsRes, teachersRes, guardiansRes] = await Promise.all([
          fetch('/api/principals', { cache: 'no-store' }),
          fetch('/api/staff-management', { cache: 'no-store' }),
          fetch('/api/guardians', { cache: 'no-store' }),
        ]);

        // Process principals
        const principalsData = await principalsRes.json();
        if (principalsRes.ok && principalsData.principals) {
          const principalsList: Recipient[] = principalsData.principals.map((p: Recipient) => ({
            id: p.id,
            first_name: p.first_name || '',
            last_name: p.last_name || null,
            email: p.email || '',
            role: 'principal'
          }));
          setPrincipals(principalsList);
        } else {
          setPrincipals([]);
        }

        // Process teachers
        const teachersData = await teachersRes.json();
        if (teachersRes.ok && teachersData.staff) {
          const teacherRoleStaff: Recipient[] = teachersData.staff
            .filter((t: Recipient) => (t.role || 'teacher') === 'teacher')
            .map((t: Recipient) => ({
              id: t.id,
              first_name: t.first_name || '',
              last_name: t.last_name || null,
              email: t.email || '',
              role: t.role || 'teacher'
            }));
          setTeachers(teacherRoleStaff);
        } else {
          setTeachers([]);
        }

        // Process guardians
        const guardiansData = await guardiansRes.json();
        if (guardiansRes.ok && guardiansData.guardians) {
          const allGuardians: Recipient[] = guardiansData.guardians.map((g: Recipient) => ({
            id: g.id,
            first_name: g.first_name || '',
            last_name: g.last_name || null,
            email: g.email || ''
          }));
          setGuardians(allGuardians);
        } else {
          setGuardians([]);
        }
      } catch (error) {
        console.error('❌ Error loading recipients:', error);
        setError('Failed to load recipients');
      }
    }

    loadRecipients();
  }, []);

  // Load message threads
  useEffect(() => {

    async function loadThreads() {
      setLoadingMessages(true);
      try {
        const res = await fetch('/api/messages', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.threads) {
          // Filter threads for teacher role - only show principals, allowed guardians, and other teachers
          const filteredThreads = json.threads.filter((thread: MessageThreadWithParticipants) =>
            filterTeacherThreads(thread, principals, allowedGuardianIds)
          );

          setThreads(filteredThreads);
          // Auto-select first thread if available
          setSelectedThread(prev => {
            if (prev) return prev; // Keep current selection
            return filteredThreads.length > 0 ? filteredThreads[0] : null;
          });

          // Calculate unread count
          const unreadCount = filteredThreads.filter((t: MessageThreadWithParticipants) => t.unread).length;
          setMessagesCount(unreadCount);
        }
      } catch (error) {
        console.error('❌ Error loading threads:', error);
        setError('Failed to load message threads');
      } finally {
        setLoadingMessages(false);
      }
    }

    loadThreads();
  }, [ allowedGuardianIds, principals]);

  // Load messages for selected thread
  useEffect(() => {
    if (!selectedThread || !session?.user?.id) {
      setMessages([]);
      return;
    }

    const currentThread = selectedThread;
    const currentUserId = session.user.id;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/message-items?messageId=${currentThread.id}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.items) {
          setMessages(json.items);
        }

        // Mark thread as read
        if (currentThread.unread && currentUserId) {
          try {
            const participantRes = await fetch(`/api/message-participants?messageId=${currentThread.id}`, { cache: 'no-store' });
            const participantData = await participantRes.json();
            if (participantRes.ok && participantData.participants) {
              const userParticipant = participantData.participants.find((p: { user_id: string }) => p.user_id === currentUserId);
              if (userParticipant?.id) {
                const updateRes = await fetch('/api/message-participants', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: userParticipant.id,
                    unread: false
                  })
                });
                if (updateRes.ok) {
                  setThreads(prev => prev.map(t => 
                    t.id === currentThread.id ? { ...t, unread: false } : t
                  ));
                  setSelectedThread(prev => prev ? { ...prev, unread: false } : null);
                  setMessagesCount(prev => Math.max(0, prev - 1));
                }
              }
            }
          } catch (error) {
            console.error('Error marking thread as read:', error);
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        setError('Failed to load messages');
      }
    }

    loadMessages();
  }, [selectedThread, session?.user?.id]);

  // Set up Realtime subscriptions for messages
  const threadIds = useMemo(() => threads.map(t => t.id), [threads]);
  
  const handleNewMessage = useCallback((newMessage: MessageItem) => {
    if (selectedThread?.id === newMessage.message_id) {
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    }
    
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
        updatedThreads.splice(threadIndex, 1);
        updatedThreads.unshift(updatedThread);
        return updatedThreads;
      }
      return prev;
    });
  }, [selectedThread]);

  const handleUpdatedParticipant = useCallback((updatedParticipant: { message_id: string; unread: boolean }) => {
    setThreads(prev => prev.map(t => 
      t.id === updatedParticipant.message_id 
        ? { ...t, unread: updatedParticipant.unread, unread_count: updatedParticipant.unread ? 1 : 0 }
        : t
    ));
    
    if (selectedThread?.id === updatedParticipant.message_id) {
      setSelectedThread(prev => prev ? { ...prev, unread: updatedParticipant.unread } : null);
    }

    // Update messages count
    if (updatedParticipant.unread) {
      setMessagesCount(prev => prev + 1);
    } else {
      setMessagesCount(prev => Math.max(0, prev - 1));
    }
  }, [selectedThread]);

  const handleNewThread = useCallback((newThread: MessageThreadWithParticipants) => {
    const shouldAdd = filterTeacherThreads(newThread, principals, allowedGuardianIds);
    
    if (shouldAdd) {
      setThreads(prev => {
        if (prev.some(t => t.id === newThread.id)) {
          return prev;
        }
        return [newThread, ...prev];
      });
      if (newThread.unread) {
        setMessagesCount(prev => prev + 1);
      }
    }
  }, [principals, allowedGuardianIds]);

  const handleUpdatedThread = useCallback((updatedThread: MessageThreadWithParticipants) => {
    setThreads(prev => prev.map(t => 
      t.id === updatedThread.id ? updatedThread : t
    ));
    
    if (selectedThread?.id === updatedThread.id) {
      setSelectedThread(updatedThread);
    }
  }, [selectedThread]);
  
  useMessagesRealtime({
    threadIds,
    onNewMessage: handleNewMessage,
    onUpdatedParticipant: handleUpdatedParticipant,
    onNewThread: handleNewThread,
    onUpdatedThread: handleUpdatedThread,
  });

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    let filtered = threads.filter(thread => 
      filterTeacherThreads(thread, principals, allowedGuardianIds)
    );

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
  }, [threads, searchQuery, allowedGuardianIds, principals]);

  // Send message from chat view
  const sendChatMessage = useCallback(async () => {
    if (!chatMessageBody.trim() || !selectedThread || !session?.user?.id) return;

    setSending(true);
    setError(null);
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
      const textarea = document.querySelector('textarea[placeholder*="msg_ph"]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
      
      if (messageData.item) {
        setMessages(prev => [...prev, messageData.item]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('Error sending message:', err);
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  }, [chatMessageBody, selectedThread, session?.user?.id]);

  // Create new conversation and send first message
  const sendMessage = useCallback(async () => {
    if (!messageBody.trim() || !recipientId || !session?.user?.id) return;

    setSending(true);
    setError(null);
    try {
      let threadId = selectedThread?.id;
      
      if (!threadId || selectedThread?.other_participant?.id !== recipientId) {
        const existingThread = threads.find(
          (t) => t.other_participant?.id === recipientId
        );
        
        if (existingThread) {
          threadId = existingThread.id;
          setSelectedThread(existingThread);
        } else {
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

      // Reload threads
      const threadsRes = await fetch('/api/messages', { cache: 'no-store' });
      const threadsData = await threadsRes.json();
      if (threadsRes.ok && threadsData.threads) {
        const filteredThreads = threadsData.threads.filter((t: MessageThreadWithParticipants) =>
          filterTeacherThreads(t, principals, allowedGuardianIds)
        );

        setThreads(filteredThreads);
        const newThread = filteredThreads.find((t: MessageThreadWithParticipants) => t.id === threadId);
        if (newThread) {
          setSelectedThread(newThread);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('Error sending message:', err);
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  }, [messageBody, recipientId, session?.user?.id, selectedThread, threads, principals, allowedGuardianIds]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <TeacherPageLayout messagesBadge={messagesCount > 0 ? messagesCount : undefined}>
      <TeacherMessagesContent
        t={t}
        lang={lang}
        session={session}
        error={error}
        setError={setError}
        threads={threads}
        selectedThread={selectedThread}
        setSelectedThread={setSelectedThread}
        messages={messages}
        loadingMessages={loadingMessages}
        sending={sending}
        recipientId={recipientId}
        setRecipientId={setRecipientId}
        messageBody={messageBody}
        setMessageBody={setMessageBody}
        sent={sent}
        principals={principals}
        teachers={teachers}
        guardians={guardians}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        allowedGuardianIds={allowedGuardianIds}
        showNewConversation={showNewConversation}
        setShowNewConversation={setShowNewConversation}
        chatMessageBody={chatMessageBody}
        setChatMessageBody={setChatMessageBody}
        messagesEndRef={messagesEndRef}
        filteredThreads={filteredThreads}
        sendChatMessage={sendChatMessage}
        sendMessage={sendMessage}
      />
    </TeacherPageLayout>
  );
}

interface TeacherMessagesContentProps {
  t: any;
  lang: 'en' | 'is';
  session: any;
  error: string | null;
  setError: (error: string | null) => void;
  threads: MessageThreadWithParticipants[];
  selectedThread: MessageThreadWithParticipants | null;
  setSelectedThread: (thread: MessageThreadWithParticipants | null) => void;
  messages: MessageItem[];
  loadingMessages: boolean;
  sending: boolean;
  recipientId: string;
  setRecipientId: (id: string) => void;
  messageBody: string;
  setMessageBody: (body: string) => void;
  sent: boolean;
  principals: Recipient[];
  teachers: Recipient[];
  guardians: Recipient[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  allowedGuardianIds: Set<string>;
  showNewConversation: boolean;
  setShowNewConversation: (show: boolean) => void;
  chatMessageBody: string;
  setChatMessageBody: (body: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  filteredThreads: MessageThreadWithParticipants[];
  sendChatMessage: () => void;
  sendMessage: () => void;
}

function TeacherMessagesContent({
  t,
  lang,
  session,
  error,
  setError,
  threads,
  selectedThread,
  setSelectedThread,
  messages,
  loadingMessages,
  sending,
  recipientId,
  setRecipientId,
  messageBody,
  setMessageBody,
  sent,
  principals,
  teachers,
  guardians,
  searchQuery,
  setSearchQuery,
  allowedGuardianIds,
  showNewConversation,
  setShowNewConversation,
  chatMessageBody,
  setChatMessageBody,
  messagesEndRef,
  filteredThreads,
  sendChatMessage,
  sendMessage,
}: TeacherMessagesContentProps) {
  const { sidebarRef } = useTeacherPageLayout();

  return (
    <>
      <PageHeader
        title={t.msg_title}
        subtitle={t.messages_subtitle}
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />
      
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Panel */}
      <div className="flex h-[calc(100vh-100px)] rounded-ds-lg border border-slate-200 bg-white shadow-ds-card dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
        {/* Left Sidebar - Conversations List */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          {/* Header with New Conversation Button */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-mint-50 dark:bg-slate-900 flex-shrink-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.msg_title}</h2>
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
              <div className="p-3 bg-white dark:bg-slate-800 rounded-ds-md border border-slate-200 dark:border-slate-700 mb-3 overflow-hidden">
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
                    className="mt-1 w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] dark:border-slate-600 dark:bg-slate-900 px-2 py-1.5 text-ds-small dark:text-slate-200 max-w-full focus:border-mint-500 focus:ring-mint-500"
                  >
                    <option value="">{t.select_recipient}</option>
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
                  </select>
                </label>
                <label className="block text-ds-tiny text-slate-700 dark:text-slate-300 mt-2 mb-2 min-w-0">
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
                {sent && <span className="text-ds-tiny text-emerald-600 dark:text-emerald-400 mt-1 block text-center">✓ {t.message_sent}</span>}
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
            {loadingMessages ? (
              <div className="p-4">
                <LoadingSkeleton type="list" rows={5} />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  lang={lang}
                  icon={MessageSquare}
                  title={t.no_threads_title}
                  description={t.no_threads_description}
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
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {thread.other_participant
                                ? `${thread.other_participant.first_name} ${thread.other_participant.last_name || ''}`.trim() || thread.other_participant.email
                                : 'Unknown'}
                            </div>
                            {thread.unread && (
                              <span className="flex-shrink-0 w-2 h-2 rounded-ds-full bg-mint-500"></span>
                            )}
                          </div>
                          {thread.latest_item && (
                            <span className="text-ds-tiny text-slate-400 dark:text-slate-500 flex-shrink-0">
                              {new Date(thread.latest_item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-ds-tiny text-slate-500 dark:text-slate-400 mb-0.5">
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
                  <div className="w-10 h-10 rounded-ds-full bg-mint-500 flex items-center justify-center text-white font-semibold">
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
              <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                  <div className="flex-1 relative">
                    <textarea
                      value={chatMessageBody}
                      onChange={(e) => {
                        setChatMessageBody(e.target.value);
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
                    className="p-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end"
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
    </>
  );
}
