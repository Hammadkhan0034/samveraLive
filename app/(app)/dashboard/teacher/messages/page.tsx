'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MessageSquare, Camera, Timer, Users, Bell, X, Search, Send, Paperclip, Link as LinkIcon, Mail, Utensils, Menu, MessageSquarePlus } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';
import { MessageThreadWithParticipants, MessageItem } from '@/lib/types/messages';
import { useMessagesRealtime } from '@/lib/hooks/useMessagesRealtime';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

// Import translations (same as TeacherDashboard)
const enText = {
  tile_msg: 'Messages',
  tile_msg_desc: 'Communicate with parents and staff',
  tile_att: 'Attendance',
  tile_att_desc: 'Track student attendance',
  tile_diaper: 'Diapers',
  tile_diaper_desc: 'Log diaper changes',
  tile_media: 'Media',
  tile_media_desc: 'Upload and manage photos',
  tile_stories: 'Stories',
  tile_stories_desc: 'Create and share stories',
  tile_announcements: 'Announcements',
  tile_announcements_desc: 'Share announcements',
  tile_students: 'Students',
  tile_students_desc: 'Manage your students',
  tile_guardians: 'Guardians',
  tile_guardians_desc: 'Manage guardians',
  tile_link_student: 'Link Student',
  tile_link_student_desc: 'Link a guardian to a student',
  tile_menus: 'Menus',
  tile_menus_desc: 'Manage daily menus',
  title: 'Teacher Dashboard',
  today_hint: 'Today',
  msg_title: 'Messages',
  new_message: 'New Message',
  to: 'To',
  select_recipient: 'Select recipient',
  message: 'Message',
  msg_ph: 'Type your message...',
  send: 'Send',
  sent: 'Sent',
  search_placeholder: 'Search conversations...',
  loading: 'Loading...',
  no_threads: 'No conversations yet',
  no_messages: 'No messages yet',
  principal: 'Principal',
  teacher: 'Teacher',
  guardian: 'Guardian',
} as const;

const isText = {
  tile_msg: 'Skilaboð',
  tile_msg_desc: 'Samið við foreldra og starfsfólk',
  tile_att: 'Mæting',
  tile_att_desc: 'Fylgstu með mætingu nemenda',
  tile_diaper: 'Bleia',
  tile_diaper_desc: 'Skrá bleiubreytingar',
  tile_media: 'Miðlar',
  tile_media_desc: 'Hlaða upp og stjórna myndum',
  tile_stories: 'Sögur',
  tile_stories_desc: 'Búðu til og deildu sögum',
  tile_announcements: 'Tilkynningar',
  tile_announcements_desc: 'Deildu tilkynningum',
  tile_students: 'Nemendur',
  tile_students_desc: 'Stjórna nemendum',
  tile_guardians: 'Forráðamenn',
  tile_guardians_desc: 'Stjórna forráðamönnum',
  tile_link_student: 'Tengja nemanda',
  tile_link_student_desc: 'Tengdu forráðamann við nemanda',
  tile_menus: 'Matseðlar',
  tile_menus_desc: 'Stjórna daglegum matseðlum',
  title: 'Kennarastjórnborð',
  today_hint: 'Í dag',
  msg_title: 'Skilaboð',
  new_message: 'Ný skilaboð',
  to: 'Til',
  select_recipient: 'Veldu viðtakanda',
  message: 'Skilaboð',
  msg_ph: 'Skrifaðu skilaboðin þín...',
  send: 'Senda',
  sent: 'Sent',
  search_placeholder: 'Leita í samtalum...',
  loading: 'Hleður...',
  no_threads: 'Engin samtal ennþá',
  no_messages: 'Engin skilaboð ennþá',
  principal: 'Skólastjóri',
  teacher: 'Kennari',
  guardian: 'Forráðamaður',
} as const;

export default function TeacherMessagesPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isSigningIn } = useRequireAuth('teacher');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Messages state
  const [threads, setThreads] = useState<MessageThreadWithParticipants[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThreadWithParticipants | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
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
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [chatMessageBody, setChatMessageBody] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; class_id: string | null }>>([]);
  const [messagesCount, setMessagesCount] = useState(0);

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata;
  const orgIdFromMetadata = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const orgId = orgIdFromMetadata || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '1db3c97c-de42-4ad2-bb72-cc0b6cda69f7';

  // Show loading state while checking authentication
  if (loading || (isSigningIn && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading messages page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Safety check: if user is still not available after loading, don't render
  if (!loading && !isSigningIn && !user) {
    return null;
  }

  // Load teacher classes
  useEffect(() => {
    if (!session?.user?.id || !orgId) return;

    async function loadTeacherClasses() {
      try {
        const response = await fetch(`/api/teacher-classes?teacherId=${session?.user.id}&orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.classes) {
          setTeacherClasses(data.classes);
          // Load students for these classes
          const allStudents: Array<{ id: string; class_id: string | null }> = [];
          for (const cls of data.classes) {
            try {
              const studentsRes = await fetch(`/api/students?orgId=${orgId}&classId=${cls.id}&t=${Date.now()}`, { cache: 'no-store' });
              const studentsData = await studentsRes.json();
              if (studentsRes.ok && studentsData.students) {
                studentsData.students.forEach((s: any) => {
                  allStudents.push({ id: s.id, class_id: cls.id });
                });
              }
            } catch (error) {
              console.error(`Error loading students for class ${cls.id}:`, error);
            }
          }
          setStudents(allStudents);
        }
      } catch (error) {
        console.error('Error loading teacher classes:', error);
      }
    }

    loadTeacherClasses();
  }, [session?.user?.id, orgId]);

  // Load guardians linked to teacher's students
  useEffect(() => {
    if (!orgId || students.length === 0) {
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
  }, [orgId, students]);

  // Load recipients (principals, teachers, and guardians)
  useEffect(() => {
    if (!orgId) return;

    async function loadRecipients() {
      setLoadingRecipients(true);
      try {
        // Load principals
        const principalsRes = await fetch(`/api/principals?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
        const principalsData = await principalsRes.json();
        if (principalsRes.ok && principalsData.principals) {
          const principalsList = principalsData.principals.map((p: any) => ({
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

        // Load teachers (excluding current user)
        const teachersRes = await fetch(`/api/staff-management?orgId=${orgId}&t=${Date.now()}`, { cache: 'no-store' });
        const teachersData = await teachersRes.json();
        if (teachersRes.ok && teachersData.staff) {
          const teacherRoleStaff = teachersData.staff
            .filter((t: any) => (t.role || 'teacher') === 'teacher' && t.id !== session?.user?.id)
            .map((t: any) => ({
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

        // Load guardians - only those linked to teacher's students
        if (allowedGuardianIds.size > 0) {
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
          }
        } else {
          setGuardians([]);
        }
      } catch (error) {
        console.error('❌ Error loading recipients:', error);
      } finally {
        setLoadingRecipients(false);
      }
    }

    loadRecipients();
  }, [orgId, allowedGuardianIds, session?.user?.id]);

  // Load message threads
  useEffect(() => {
    if (!session?.user?.id) return;

    async function loadThreads() {
      if (!session?.user?.id) return;
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/messages?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.threads) {
          // Filter threads for teacher role - only show principals, allowed guardians, and other teachers
          let filteredThreads = json.threads.filter((thread: MessageThreadWithParticipants) => {
            const otherParticipant = thread.other_participant;
            if (!otherParticipant) {
              return false;
            }

            // ALWAYS show principals
            if (otherParticipant.role === 'principal') {
              return true;
            }

            // Backup check: if participant ID is in principals list
            if (principals.length > 0 && principals.some((p: any) => p.id === otherParticipant.id)) {
              return true;
            }

            // Show other teachers
            if (otherParticipant.role === 'teacher') {
              return true;
            }

            // For guardians, only show if they're linked to teacher's students
            if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
              return allowedGuardianIds.has(otherParticipant.id);
            }

            return false;
          });

          setThreads(filteredThreads);
          // Auto-select first thread if available
          if (filteredThreads.length > 0 && !selectedThread) {
            setSelectedThread(filteredThreads[0]);
          }

          // Calculate unread count
          const unreadCount = filteredThreads.filter((t: MessageThreadWithParticipants) => t.unread).length;
          setMessagesCount(unreadCount);
        }
      } catch (error) {
        console.error('❌ Error loading threads:', error);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, Array.from(allowedGuardianIds).sort().join(','), principals.length]);

  // Load messages for selected thread
  useEffect(() => {
    if (!selectedThread || !session?.user?.id) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      if (!selectedThread) return;
      try {
        const res = await fetch(`/api/message-items?messageId=${selectedThread.id}&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.items) {
          setMessages(json.items);
        }

        // Mark thread as read
        if (selectedThread.unread && session?.user?.id) {
          try {
            const participantRes = await fetch(`/api/message-participants?messageId=${selectedThread.id}`, { cache: 'no-store' });
            const participantData = await participantRes.json();
            if (participantRes.ok && participantData.participants) {
              const userParticipant = participantData.participants.find((p: any) => p.user_id === session.user.id);
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
                    t.id === selectedThread.id ? { ...t, unread: false } : t
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
    },
    onUpdatedParticipant: (updatedParticipant) => {
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
    },
    onNewThread: (newThread) => {
      let shouldAdd = true;
      const otherParticipant = newThread.other_participant;
      if (!otherParticipant) {
        shouldAdd = false;
      } else if (otherParticipant.role === 'principal') {
        shouldAdd = true;
      } else if (principals.length > 0 && principals.some((p: any) => p.id === otherParticipant.id)) {
        shouldAdd = true;
      } else if (otherParticipant.role === 'teacher') {
        shouldAdd = true;
      } else if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
        shouldAdd = allowedGuardianIds.has(otherParticipant.id);
      } else {
        shouldAdd = false;
      }
      
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
    },
    onUpdatedThread: (updatedThread) => {
      setThreads(prev => prev.map(t => 
        t.id === updatedThread.id ? updatedThread : t
      ));
      
      if (selectedThread?.id === updatedThread.id) {
        setSelectedThread(updatedThread);
      }
    },
  });

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    let filtered = threads;

    filtered = filtered.filter(thread => {
      const otherParticipant = thread.other_participant;
      if (!otherParticipant) return false;

      if (otherParticipant.role === 'principal') {
        return true;
      }

      if (principals.length > 0 && principals.some((p: any) => p.id === otherParticipant.id)) {
        return true;
      }

      if (otherParticipant.role === 'teacher') {
        return true;
      }

      if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
        return allowedGuardianIds.has(otherParticipant.id);
      }

      return false;
    });

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

  // Combined recipients list
  const allRecipients = useMemo(() => {
    const principalList = principals.map(p => ({ ...p, type: 'principal' as const }));
    const guardianList = guardians.map(g => ({ ...g, type: 'guardian' as const }));
    return [...principalList, ...guardianList];
  }, [principals, guardians]);

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
      const textarea = document.querySelector('textarea[placeholder*="msg_ph"]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
      
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
      const threadsRes = await fetch(`/api/messages?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
      const threadsData = await threadsRes.json();
      if (threadsRes.ok && threadsData.threads) {
        let filteredThreads = threadsData.threads.filter((t: MessageThreadWithParticipants) => {
          const otherParticipant = t.other_participant;
          if (!otherParticipant) return false;

          if (otherParticipant.role === 'principal') {
            return true;
          }

          if (principals.length > 0 && principals.some((p: any) => p.id === otherParticipant.id)) {
            return true;
          }

          if (otherParticipant.role === 'teacher') {
            return true;
          }

          if (otherParticipant.role === 'guardian' || !otherParticipant.role) {
            return allowedGuardianIds.has(otherParticipant.id);
          }

          return false;
        });

        setThreads(filteredThreads);
        const newThread = filteredThreads.find((t: any) => t.id === threadId);
        if (newThread) {
          setSelectedThread(newThread);
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Define tiles array (excluding messages, attendance, and diapers as they're handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      
      { id: 'media', title: t.tile_media, desc: t.tile_media_desc, Icon: Camera, route: '/dashboard/teacher?tab=media' },
      { id: 'stories', title: t.tile_stories, desc: t.tile_stories_desc, Icon: Timer, route: '/dashboard/teacher?tab=stories' },
      { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell, route: '/dashboard/teacher?tab=announcements' },
      { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users, route: '/dashboard/teacher?tab=students' },
      { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users, route: '/dashboard/teacher?tab=guardians' },
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher?tab=link_student' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
    ], [t]);

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
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Content Header */}
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.msg_title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <ProfileSwitcher />
              </div>
            </div>

            {/* Messages Panel */}
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
                      className="p-2 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors"
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
                        className="w-full rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                  {loadingMessages ? (
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
                            selectedThread?.id === thread.id ? 'bg-slate-100 dark:bg-slate-800/50 border-l-4 border-black' : ''
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
                                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-black"></span>
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
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-semibold">
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
                                      ? 'bg-black text-white rounded-br-sm'
                                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                                  <p className={`text-xs mt-1 ${isOwn ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>
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
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 pr-12 text-sm dark:text-slate-200 dark:placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent max-h-[120px] overflow-y-auto"
                          />
                        </div>
                        <button
                          onClick={sendChatMessage}
                          disabled={sending || !chatMessageBody.trim()}
                          className="p-2 rounded-lg bg-black hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          </div>
        </main>
      </div>
    </div>
  );
}
