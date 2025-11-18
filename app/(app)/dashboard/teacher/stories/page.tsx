'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Timer, Users, Bell, MessageSquare, Camera, Link as LinkIcon, Utensils, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import TeacherSidebar from '@/app/components/shared/TeacherSidebar';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Import translations (same as TeacherDashboard)
const enText = {
  tile_stories: 'Stories',
  tile_stories_desc: 'Create and share stories',
  tile_media: 'Media',
  tile_media_desc: 'Upload and manage photos',
  tile_att: 'Attendance',
  tile_att_desc: 'Track student attendance',
  tile_diaper: 'Diapers',
  tile_diaper_desc: 'Log diaper changes',
  tile_msg: 'Messages',
  tile_msg_desc: 'Communicate with parents and staff',
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
  stories_title: 'Stories',
  add_story: 'Add Story',
  add: 'Add',
  stories_hint: 'Stories expire after 24 hours',
  loading_stories: 'Loading stories…',
  empty_stories: 'No stories yet.',
  col_title: 'Title',
  col_scope: 'Scope',
  col_caption: 'Caption',
  actions: 'Actions',
  class_label: 'Class',
  org_wide: 'Organization-wide',
  no_caption: 'No caption',
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
  delete_story: 'Delete Story',
  delete_story_confirm: 'Are you sure you want to delete this story? This action cannot be undone.',
  cancel: 'Cancel',
} as const;

const isText = {
  tile_stories: 'Sögur',
  tile_stories_desc: 'Búðu til og deildu sögum',
  tile_media: 'Miðlar',
  tile_media_desc: 'Hlaða upp og stjórna myndum',
  tile_att: 'Mæting',
  tile_att_desc: 'Fylgstu með mætingu nemenda',
  tile_diaper: 'Bleia',
  tile_diaper_desc: 'Skrá bleiubreytingar',
  tile_msg: 'Skilaboð',
  tile_msg_desc: 'Samið við foreldra og starfsfólk',
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
  stories_title: 'Sögur',
  add_story: 'Bæta við sögu',
  add: 'Bæta við',
  stories_hint: 'Sögur renna út eftir 24 klukkustundir',
  loading_stories: 'Hleður sögum…',
  empty_stories: 'Engar sögur ennþá.',
  col_title: 'Titill',
  col_scope: 'Umfang',
  col_caption: 'Lýsing',
  actions: 'Aðgerðir',
  class_label: 'Bekkur',
  org_wide: 'Um allan stofnun',
  no_caption: 'Engin lýsing',
  view: 'Skoða',
  edit: 'Breyta',
  delete: 'Eyða',
  delete_story: 'Eyða sögu',
  delete_story_confirm: 'Ertu viss um að þú viljir eyða þessari sögu? Þessa aðgerð er ekki hægt að afturkalla.',
  cancel: 'Hætta við',
} as const;

export default function TeacherStoriesPage() {
  const { lang } = useLanguage();
  const t = useMemo(() => (lang === 'is' ? isText : enText), [lang]);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, isSigningIn } = useRequireAuth('teacher');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Load teacher classes
  useEffect(() => {
    async function loadTeacherClasses() {
      if (!session?.user?.id) return;
      try {
        setLoadingClasses(true);
        const response = await fetch(`/api/teacher-classes?userId=${session.user.id}&t=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.classes) {
          setTeacherClasses(data.classes);
        } else {
          setTeacherClasses([]);
        }
      } catch (error) {
        console.error('Error loading teacher classes:', error);
        setTeacherClasses([]);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadTeacherClasses();
  }, [session?.user?.id]);

  // Stories state
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [storiesByClass, setStoriesByClass] = useState<Record<string, { class: any; stories: any[] }>>({});
  
  // Story viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeStory, setActiveStory] = useState<any>(null);
  const [activeItems, setActiveItems] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const itemStartTimeRef = useRef<number>(0);
  
  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load stories
  useEffect(() => {
    if (!finalOrgId || !session?.user?.id) return;
    
    const loadStories = async () => {
      try {
        setLoading(true);
        const userId = session.user.id;
        const teacherClassIds = teacherClasses.map(c => c.id).filter(Boolean);
        
        const params = new URLSearchParams({ orgId: finalOrgId });
        params.set('audience', 'teacher');
        params.set('teacherAuthorId', userId || '');
        if (teacherClassIds.length > 0) {
          params.set('teacherClassIds', teacherClassIds.join(','));
        }
        
        const res = await fetch(`/api/stories?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.stories) {
          const storiesList = Array.isArray(json.stories) ? json.stories : [];
          setStories(storiesList);
          
          // Group stories by class
          const orgWideStories = storiesList.filter((s: any) => !s.class_id);
          const classSpecificStories = storiesList.filter((s: any) => s.class_id && teacherClassIds.includes(s.class_id));
          
          const grouped: Record<string, { class: any; stories: any[] }> = {};
          
          // Add org-wide stories (principal's stories)
          if (orgWideStories.length > 0) {
            grouped['org-wide'] = {
              class: { id: null, name: 'Organization-wide' },
              stories: orgWideStories
            };
          }
          
          // Group class-specific stories (teacher's own stories)
          classSpecificStories.forEach((story: any) => {
            const classId = story.class_id;
            if (!grouped[classId]) {
              const classInfo = teacherClasses.find(c => c.id === classId);
              grouped[classId] = {
                class: classInfo || { id: classId, name: `Class ${classId.substring(0, 8)}` },
                stories: []
              };
            }
            grouped[classId].stories.push(story);
          });
          
          setStoriesByClass(grouped);
        }
      } catch (e) {
        console.error('Error loading stories:', e);
      } finally {
        setLoading(false);
      }
    };
    
    loadStories();
  }, [finalOrgId, teacherClasses, session?.user?.id]);

  function closeViewer(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setViewerOpen(false);
    setActiveStory(null);
    setActiveItems([]);
    setActiveIndex(0);
    setProgress(0);
    setIsPaused(false);
    pausedTimeRef.current = 0;
    itemStartTimeRef.current = 0;
    startTimeRef.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  function togglePause() {
    if (isPaused) {
      setIsPaused(false);
      if (activeItems.length > 0 && activeIndex < activeItems.length) {
        scheduleNext(activeItems, activeIndex);
      }
    } else {
      pausedTimeRef.current = Date.now();
      setIsPaused(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  function scheduleNext(its: any[], index: number) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!its || its.length === 0) return;
    if (isPaused) return;
    
    const fullDuration = Math.max(its[index]?.duration_ms || 30000, 1000);
    let remainingTime = fullDuration;
    if (itemStartTimeRef.current > 0 && pausedTimeRef.current > 0) {
      const elapsed = pausedTimeRef.current - itemStartTimeRef.current;
      remainingTime = Math.max(fullDuration - elapsed, 0);
      itemStartTimeRef.current = Date.now() - elapsed;
      pausedTimeRef.current = 0;
    } else {
      itemStartTimeRef.current = Date.now();
    }
    
    timerRef.current = setTimeout(() => {
      if (isPaused) return;
      const next = index + 1;
      itemStartTimeRef.current = 0;
      if (next >= its.length) {
        closeViewer();
      } else {
        setActiveIndex(next);
        scheduleNext(its, next);
      }
    }, remainingTime);
  }

  async function openStory(story: any) {
    try {
      setActiveStory(story);
      setViewerOpen(true);
      setIsPaused(false);
      pausedTimeRef.current = 0;
      itemStartTimeRef.current = 0;
      startTimeRef.current = 0;
      setActiveItems([]);
      setActiveIndex(0);
      setProgress(0);
      
      const res = await fetch(`/api/story-items?storyId=${story.id}${finalOrgId ? `&orgId=${finalOrgId}` : ''}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const json = await res.json();
      const its: any[] = Array.isArray(json.items) ? json.items : [];
      
      setActiveItems(its);
      
      // Preload all images
      its.forEach((item) => {
        if (item.url) {
          const img = new window.Image();
          img.src = item.url;
        }
      });
      
      if (its.length > 0) {
        scheduleNext(its, 0);
      }
    } catch (e) {
      console.error('Error loading story items:', e);
      closeViewer();
    }
  }

  function renderActiveItem() {
    if (!activeItems.length) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white/90 text-lg font-medium text-center px-4">
            {activeStory?.title || 'Story'}
          </div>
        </div>
      );
    }
    const it = activeItems[activeIndex];
    const isImage = (it.mime_type || '').startsWith('image/');
    const imageSrc = it.url;
    
    if (isImage && imageSrc) {
      return (
        <>
          <Image 
            src={imageSrc} 
            alt={it.caption || activeStory?.title || ''} 
            fill
            sizes="100vw"
            className="object-cover object-center pointer-events-auto z-[1]"
            onClick={(e) => {
              e.stopPropagation();
              togglePause();
            }}
            priority
          />
        </>
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-white/90 text-lg font-medium text-center px-4">
          {it.caption || activeStory?.title || 'Story'}
        </div>
      </div>
    );
  }

  // Progress bar animation
  useEffect(() => {
    if (!viewerOpen || !activeItems.length || activeIndex >= activeItems.length) return;
    const item = activeItems[activeIndex];
    const duration = Math.max(item.duration_ms || 30000, 1000);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    if (!isPaused) {
      progressIntervalRef.current = setInterval(() => {
        if (itemStartTimeRef.current > 0) {
          const elapsed = Date.now() - itemStartTimeRef.current;
          const percent = Math.min((elapsed / duration) * 100, 100);
          setProgress(percent);
        }
      }, 100);
    }
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [viewerOpen, activeItems, activeIndex, isPaused]);

  function openDeleteModal(story: any) {
    setStoryToDelete(story);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false);
    setStoryToDelete(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!storyToDelete || !session?.user?.id) return;
    
    setDeleting(true);
    setDeleteError(null);
    
    try {
      const res = await fetch(`/api/stories?id=${storyToDelete.id}&authorId=${session.user.id}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Failed to delete story: ${res.status}`);
      }
      
      // Remove from local state
      setStories(prev => prev.filter(s => s.id !== storyToDelete.id));
      
      // Update storiesByClass
      setStoriesByClass(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key].stories = updated[key].stories.filter((s: any) => s.id !== storyToDelete.id);
        });
        // Remove empty groups
        Object.keys(updated).forEach(key => {
          if (updated[key].stories.length === 0) {
            delete updated[key];
          }
        });
        return updated;
      });
      
      closeDeleteModal();
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  // Define tiles array (excluding stories, attendance, diapers, messages, and media as they're handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'messages', title: t.tile_msg, desc: t.tile_msg_desc, Icon: MessageSquare, route: '/dashboard/teacher/messages' },
      { id: 'media', title: t.tile_media, desc: t.tile_media_desc, Icon: Camera, route: '/dashboard/teacher/media' },
      { id: 'announcements', title: t.tile_announcements, desc: t.tile_announcements_desc, Icon: Bell, route: '/dashboard/teacher?tab=announcements' },
      { id: 'students', title: t.tile_students, desc: t.tile_students_desc, Icon: Users, route: '/dashboard/teacher?tab=students' },
      { id: 'guardians', title: t.tile_guardians || 'Guardians', desc: t.tile_guardians_desc || 'Manage guardians', Icon: Users, route: '/dashboard/teacher?tab=guardians' },
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher?tab=link_student' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
    ], [t]);

  // Show loading state while checking authentication
  if (authLoading || (isSigningIn && !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading stories page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Safety check: if user is still not available after loading, don't render
  if (!authLoading && !isSigningIn && !user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden md:pt-14">
      <div className="flex flex-1 overflow-hidden h-full">
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
          }}
          mediaTile={{
            title: t.tile_media,
            desc: t.tile_media_desc,
          }}
          storiesTile={{
            title: t.tile_stories,
            desc: t.tile_stories_desc,
          }}
          announcementsTile={{
            title: t.tile_announcements,
            desc: t.tile_announcements_desc,
          }}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-2 md:p-6 lg:p-8">
            {/* Stories Panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.stories_title}</h2>
                <button 
                  onClick={() => router.push('/dashboard/add-story')}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <Plus className="h-4 w-4" />
                  {t.add_story}
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto py-1">
                <button 
                  onClick={() => router.push('/dashboard/add-story')}
                  className="flex w-20 flex-col items-center gap-1"
                >
                  <span className="rounded-full bg-gradient-to-tr from-slate-300 to-slate-400 p-0.5">
                    <span className="block rounded-full bg-white p-0.5">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed">
                        <Plus className="h-5 w-5" />
                      </span>
                    </span>
                  </span>
                  <span className="truncate text-xs text-slate-600 dark:text-slate-400">{t.add}</span>
                </button>
                
                {loading ? (
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">Loading...</div>
                ) : (
                  Object.values(storiesByClass).map((group) => (
                    group.stories.map((story) => (
                      <button
                        key={story.id}
                        onClick={() => openStory(story)}
                        className="flex w-20 flex-col items-center gap-1"
                      >
                        <span className="rounded-full bg-gradient-to-tr from-rose-400 to-amber-400 p-0.5">
                          <span className="block rounded-full bg-white p-0.5">
                            <span className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs text-slate-600 dark:text-slate-300">
                              {story.title ? story.title.charAt(0).toUpperCase() : 'S'}
                            </span>
                          </span>
                        </span>
                        <span className="truncate text-xs text-slate-600 dark:text-slate-400 max-w-[80px]" title={group.class.name}>
                          {group.class.name}
                        </span>
                      </button>
                    ))
                  )).flat()
                )}
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{t.stories_hint}</p>
              
              {/* Stories Table */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {loading && stories.length === 0 ? (
                  <div className="p-6 text-slate-600 dark:text-slate-400">{t.loading_stories || 'Loading stories…'}</div>
                ) : stories.length === 0 ? (
                  <div className="p-6 text-center text-slate-600 dark:text-slate-400">{t.empty_stories || 'No stories yet.'}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-black text-white">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white">{t.col_title}</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white">{t.col_scope}</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white">{t.col_caption}</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white">{t.actions || 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {stories.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                            <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                              {s.title || '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                              {s.class_id ? t.class_label : t.org_wide}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                              {s.caption || t.no_caption}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openStory(s)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                  title={t.view}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>{t.view}</span>
                                </button>
                                <button
                                  onClick={() => router.push(`/dashboard/edit-story/${s.id}`)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                  title={t.edit || 'Edit'}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  <span>{t.edit || 'Edit'}</span>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(s)}
                                  className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                                  title={t.delete || 'Delete'}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>{t.delete || 'Delete'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              {/* Story Viewer */}
              {viewerOpen && activeStory && (
                <div 
                  className="fixed inset-0 z-50 bg-black" 
                  style={{ width: '100vw', height: '100vh', top: 0, left: 0, right: 0, bottom: 0 }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      closeViewer(e);
                    }
                  }}
                >
                  <div className="relative w-full h-full bg-black overflow-hidden" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
                    {/* Progress bars */}
                    <div className="absolute top-2 left-2 right-2 z-10 flex gap-1">
                      {activeItems.map((_, idx) => {
                        const isCompleted = idx < activeIndex;
                        const isActive = idx === activeIndex;
                        const fillPercent = isCompleted ? 100 : isActive ? progress : 0;
                        
                        return (
                          <div key={idx} className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-white"
                              style={{ width: `${fillPercent}%`, transition: 'width 0.1s linear' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Story content */}
                    <div 
                      className="absolute inset-0 w-full h-full" 
                      style={{ 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        width: '100vw', 
                        height: '100vh',
                        overflow: 'hidden'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderActiveItem()}
                    </div>
                    
                    {/* Close button */}
                    <button 
                      className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeViewer(e);
                      }}
                      type="button"
                      style={{ zIndex: 1000 }}
                    >
                      ✕
                    </button>
                    
                    {/* Pause/Play button */}
                    <button
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-12 h-12 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors bg-black/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePause();
                      }}
                      type="button"
                    >
                      {isPaused ? '▶' : '⏸'}
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={confirmDelete}
                title={t.delete_story || 'Delete Story'}
                message={t.delete_story_confirm || 'Are you sure you want to delete this story? This action cannot be undone.'}
                loading={deleting}
                error={deleteError}
                confirmButtonText={t.delete || 'Delete'}
                cancelButtonText={t.cancel || 'Cancel'}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

