'use client';

import React, { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, Eye, Menu } from 'lucide-react';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { AddStoryModal } from '@/app/components/shared/AddStoryModal';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';

function toLocalInput(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return '';
  }
}

// Translations removed - using centralized translations from @/lib/translations

type Story = {
  id: string;
  org_id: string;
  class_id: string | null;
  author_id: string | null;
  title: string | null;
  caption: string | null;
  is_public: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

function StoriesPageContent() {
  const { t } = useLanguage();
  const { user } = useRequireAuth();
  const router = useRouter();

  const userMetadata = user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  const classId = userMetadata?.class_id || null;

  // Determine user role to conditionally show/hide create button
  const roleRaw = String(
    userMetadata?.role || userMetadata?.user_type || userMetadata?.account_type || userMetadata?.type || userMetadata?.activeRole || ''
  ).toLowerCase();
  const isTeacher = /teacher/.test(roleRaw);
  const isGuardian = /guardian/.test(roleRaw);
  const isPrincipal = /principal|admin|head/.test(roleRaw);
  const canCreateStory = isTeacher || isPrincipal;

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);
  const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);
  type StoryItem = {
    id: string;
    story_id: string;
    order_index: number;
    url: string | null;
    duration_ms: number | null;
    caption: string | null;
    mime_type: string | null;
  };
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [activeItems, setActiveItems] = useState<StoryItem[]>([]);
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
  const [storyToDelete, setStoryToDelete] = useState<Story | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  
  // Hydrate from cache instantly on mount
  useEffect(() => {
    if (orgId && user?.id) {
      try {
        const cacheKey = `stories_cache_${orgId}_${user.id}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Story[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Show all cached stories (no filtering)
            setStories(parsed);
            setHydratedFromCache(true);
            setLoading(false); // Don't show loading if we have cache
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [orgId, user?.id]);

  useEffect(() => {
    if (orgId) {
      loadStories();
    }
  }, [orgId, classId, teacherClassIds.length]); // Reload when teacher classes are loaded
  
  // Open story viewer if storyId is in query params
  useEffect(() => {
    const storyId = searchParams?.get('storyId');
    if (storyId && stories.length > 0 && !viewerOpen) {
      const story = stories.find(s => s.id === storyId);
      if (story) {
        openStoryViewer(story);
      }
    }
  }, [searchParams, stories, viewerOpen]);

  // Preload images for smooth transitions
  useEffect(() => {
    if (!viewerOpen || !activeItems.length) return;
    
    // Preload current and next images
    activeItems.forEach((item, idx) => {
      if (idx <= activeIndex + 1 && item.url) {
        const img = new window.Image();
        img.src = item.url;
      }
    });
  }, [viewerOpen, activeItems, activeIndex]);

  // Animate progress bar for current story item
  useEffect(() => {
    if (!viewerOpen || !activeItems.length || activeIndex >= activeItems.length) return;

    const item = activeItems[activeIndex];
    const duration = Math.max(item.duration_ms || 30000, 1000); // Default 30s

    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (isPaused) {
      // When paused, keep current progress but don't animate
      return;
    }

    // If resuming, adjust start time to account for elapsed time
    if (pausedTimeRef.current > 0 && startTimeRef.current > 0) {
      const elapsedBeforePause = pausedTimeRef.current - startTimeRef.current;
      startTimeRef.current = Date.now() - elapsedBeforePause;
      pausedTimeRef.current = 0;
    } else {
      // Starting fresh
      setProgress(0);
      startTimeRef.current = Date.now();
    }

    const updateInterval = 16; // ~60fps

    progressIntervalRef.current = setInterval(() => {
      if (isPaused) {
        pausedTimeRef.current = Date.now();
        return;
      }
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, updateInterval);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [viewerOpen, activeItems, activeIndex, isPaused]);

  // Load teacher's classes if teacher
  useEffect(() => {
    const roleRaw = String(
      userMetadata?.role || userMetadata?.user_type || userMetadata?.account_type || userMetadata?.type || userMetadata?.activeRole || ''
    ).toLowerCase();
    const isTeacher = /teacher/.test(roleRaw);
    
    if (isTeacher && user?.id) {
      const fetchTeacherClasses = async () => {
        try {
          const res = await fetch(`/api/teacher-classes?userId=${user.id}&t=${Date.now()}`, { cache: 'no-store' });
          const json = await res.json();
          if (res.ok && json.classes) {
            const classIds = Array.isArray(json.classes) ? json.classes.map((c: any) => c.id).filter(Boolean) : [];
            setTeacherClassIds(classIds);
          }
        } catch (e) {
          console.error('Error fetching teacher classes:', e);
        }
      };
      fetchTeacherClasses();
    }
  }, [user?.id, userMetadata]);

  async function loadStories() {
    if (!orgId) return;
    // Don't show loading if we already have cached data
    if (!hydratedFromCache) {
      setLoading(true);
    }
    setError(null);
    try {
      // audience-aware fetching
      const roleRaw = String(
        userMetadata?.role || userMetadata?.user_type || userMetadata?.account_type || userMetadata?.type || userMetadata?.activeRole || ''
      ).toLowerCase();
      const isTeacher = /teacher/.test(roleRaw);
      const isGuardian = /guardian/.test(roleRaw);
      const isPrincipal = /principal|admin|head/.test(roleRaw);

      const params = new URLSearchParams({ orgId });
      if (isTeacher) {
        params.set('audience', 'teacher');
        params.set('teacherAuthorId', user?.id || '');
        if (teacherClassIds.length > 0) {
          params.set('teacherClassIds', teacherClassIds.join(','));
        } else if (classId) {
          // Fallback to metadata class_id if teacher classes not loaded yet
          params.set('teacherClassIds', classId);
        }
      } else if (isGuardian) {
        params.set('audience', 'guardian');
        params.set('parentUserId', user?.id || '');
        // try to gather potential class ids from metadata (fallback)
        const parentClassIds: string[] = ([] as string[])
          .concat(userMetadata?.class_ids || [])
          .concat(userMetadata?.child_class_ids || [])
          .concat(classId ? [classId] : []);
        if (parentClassIds.length > 0) params.set('parentClassIds', parentClassIds.join(','));
      } else if (isPrincipal) {
        params.set('audience', 'principal');
        if (user?.id) {
          params.set('principalAuthorId', user.id);
        }
      }
      const res = await fetch(`/api/stories?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);
      const storiesList = Array.isArray(json.stories) ? json.stories : [];
      // Show all stories returned by API (no additional filtering needed)
      setStories(storiesList);
      
      // Cache stories for instant load next time
      if (user?.id) {
        try {
          const cacheKey = `stories_cache_${orgId}_${user.id}`;
          localStorage.setItem(cacheKey, JSON.stringify(storiesList));
        } catch (e) {
          // Ignore cache errors
        }
      }
      
      // Preload images for all stories in background
      // This ensures instant display when user clicks on a story
      storiesList.forEach((story: Story) => {
        // Fetch story items for preloading in background (no blocking)
        fetch(`/api/story-items?storyId=${story.id}${orgId ? `&orgId=${orgId}` : ''}`, { cache: 'no-store' })
          .then(res => res.json())
          .then(json => {
            const items = Array.isArray(json.items) ? json.items : [];
            items.forEach((item: any) => {
              if (item.url) {
                const img = new window.Image();
                img.src = item.url;
              }
            });
          })
          .catch(err => {
            // Silently fail - preloading is optional
          });
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setHydratedFromCache(false); // Reset after first load
    }
  }


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
    // Remove storyId from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('storyId');
      window.history.replaceState({}, '', url.toString());
    }
  }

  function togglePause() {
    if (isPaused) {
      // Resume - continue from where we left off
      setIsPaused(false);
    } else {
      // Pause - save current time and pause
      pausedTimeRef.current = Date.now();
      setIsPaused(true);
      // Clear the timer that advances to next item
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  async function openStoryViewer(s: Story) {
    try {
      // Show viewer immediately - no delay like WhatsApp
      // Set viewer open and story first - this shows the UI instantly
      setActiveStory(s);
      setViewerOpen(true);
      setIsPaused(false);
      pausedTimeRef.current = 0;
      itemStartTimeRef.current = 0;
      startTimeRef.current = 0;
      
      // Set empty items initially so renderActiveItem shows story title immediately
      // This prevents any loading state
      setActiveItems([]);
      setActiveIndex(0);
      setProgress(0);
      
      // Fetch items in background - no blocking
      const res = await fetch(`/api/story-items?storyId=${s.id}${orgId ? `&orgId=${orgId}` : ''}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const json = await res.json();
      const its: StoryItem[] = Array.isArray(json.items) ? json.items : [];
      
      // Debug: Log items to see what we're getting
      console.log('Story items loaded:', its.map(it => ({
        type: it.mime_type,
        hasUrl: !!it.url,
        url: it.url?.substring(0, 50)
      })));
      
      // Update items immediately when loaded - triggers instant render
      setActiveItems(its);
      
      // Preload all images for instant display
      its.forEach((item) => {
        if (item.url) {
          const img = new window.Image();
          img.src = item.url;
        }
      });
      
      // Start timer immediately - no delay
      if (its.length > 0) {
        scheduleNext(its, 0);
      }
    } catch (e) {
      console.error('Error loading story items:', e);
      closeViewer();
    }
  }

  function scheduleNext(its: StoryItem[], index: number) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!its || its.length === 0) return;
    if (isPaused) return; // Don't schedule if paused
    
    const fullDuration = Math.max(its[index]?.duration_ms || 30000, 1000); // Default 30s
    
    // Calculate remaining time if resuming from pause
    let remainingTime = fullDuration;
    if (itemStartTimeRef.current > 0 && pausedTimeRef.current > 0) {
      const elapsed = pausedTimeRef.current - itemStartTimeRef.current;
      remainingTime = Math.max(fullDuration - elapsed, 0);
      itemStartTimeRef.current = Date.now() - elapsed; // Adjust start time
      pausedTimeRef.current = 0;
    } else {
      itemStartTimeRef.current = Date.now();
    }
    
    timerRef.current = setTimeout(() => {
      if (isPaused) return; // Don't advance if paused
      const next = index + 1;
      itemStartTimeRef.current = 0; // Reset for next item
      if (next >= its.length) {
        // Auto-advance to next story or close
        const currentStoryIndex = stories.findIndex(st => st.id === activeStory?.id);
        if (currentStoryIndex >= 0 && currentStoryIndex < stories.length - 1) {
          // Open next story
          openStoryViewer(stories[currentStoryIndex + 1]);
        } else {
          closeViewer();
        }
      } else {
        setActiveIndex(next);
        scheduleNext(its, next);
      }
    }, remainingTime);
  }

  // Re-schedule when pause state changes
  useEffect(() => {
    if (viewerOpen && activeItems.length > 0 && !isPaused && activeIndex < activeItems.length) {
      scheduleNext(activeItems, activeIndex);
    }
  }, [isPaused, viewerOpen]);

  function renderActiveItem() {
    // Always show story title prominently when items are not loaded yet - no loading state
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
    
    // Use url (Supabase Storage URL)
    const imageSrc = it.url;
    
    if (isImage && imageSrc) {
      return (
        <div className="absolute inset-0 w-full h-full bg-black cursor-pointer" style={{ 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}>
          <Image 
            src={imageSrc} 
            alt={it.caption || activeStory?.title || ''} 
            fill
            sizes="100vw"
            className="object-cover object-center pointer-events-auto z-[1]"
            onError={(e) => {
              console.error('❌ Image load error');
              console.error('Full URL:', imageSrc);
              console.error('Error event:', e);
              // TODO: Review error handling - next/image handles errors differently
            }}
            onLoad={() => {
              console.log('Image loaded successfully');
            }}
            priority
          />
          {it.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pointer-events-none">
              <div className="text-white text-sm font-medium">{it.caption}</div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div 
        className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center p-6 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          togglePause();
        }}
      >
        <div className="text-white text-center text-lg leading-relaxed whitespace-pre-wrap break-words max-w-2xl px-4">
          {it.caption || activeStory?.title || ''}
        </div>
      </div>
    );
  }


  function openDeleteModal(story: Story) {
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
    if (!storyToDelete || !user?.id) return;
    
    setDeleting(true);
    setDeleteError(null);
    
    try {
      const res = await fetch(`/api/stories?id=${storyToDelete.id}&authorId=${user.id}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Failed to delete story: ${res.status}`);
      }
      
      // Remove from local state
      setStories(prev => prev.filter(s => s.id !== storyToDelete.id));
      
      // Clear cache
      if (orgId && user.id) {
        try {
          const cacheKey = `stories_cache_${orgId}_${user.id}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached) as Story[];
            const updated = parsed.filter(s => s.id !== storyToDelete.id);
            localStorage.setItem(cacheKey, JSON.stringify(updated));
          }
        } catch (e) {
          // Ignore cache errors
        }
      }
      
      closeDeleteModal();
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  

  const totalPages = Math.ceil(stories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStories = stories.slice(startIndex, startIndex + itemsPerPage);

  // Content for teacher/parent layout (with gradient background and back button)
  const teacherContent = (
    <div className="min-h-screen bg-mint-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-ds-md flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between mt-14">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <div>
              <h1 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.stories_title}</h1>
              <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          {canCreateStory && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsAddStoryModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white transition-colors"
              >
                <Plus className="h-4 w-4" /> {t.create_story}
              </button>
            </div>
          )}
        </div>

          {error && (
            <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
            {loading && stories.length === 0 ? (
              <LoadingSkeleton type="table" rows={10} />
            ) : stories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">{t.empty}</p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-ds-md">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-mint-500">
                      <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-md">
                        {t.col_title}
                      </th>
                      <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                        {t.col_scope}
                      </th>
                      <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                        {t.col_caption}
                      </th>
                      <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-md">
                        {t.actions}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stories.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="text-left py-2 px-4 text-ds-small text-slate-900 dark:text-slate-100">
                          {s.title || '—'}
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                          {s.class_id ? t.class_label : t.org_wide}
                        </td>
                        <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                          {s.caption || t.no_caption}
                        </td>
                        <td className="text-left py-2 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openStoryViewer(s)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              title={t.view}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>{t.view}</span>
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/edit-story/${s.id}`)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              title={t.edit}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>{t.edit}</span>
                            </button>
                            <button
                              onClick={() => openDeleteModal(s)}
                              className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1 text-ds-small text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                              title={t.delete}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t.delete}</span>
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

          {viewerOpen && activeStory && (
            <div 
              className="fixed inset-0 z-50 bg-black flex items-center justify-center" 
              style={{ width: '100vw', height: '100vh', top: 0, left: 0, right: 0, bottom: 0 }}
              onClick={(e) => {
                // Close on background click (outside story content)
                if (e.target === e.currentTarget) {
                  closeViewer(e);
                }
              }}
            >
              <div className="relative w-full h-full bg-black overflow-hidden max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto rounded-lg shadow-lg" style={{ width: '90%', height: '90vh', maxHeight: '800px', position: 'relative' }}>
                {/* Progress bars at top */}
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
                <div 
                  className="absolute inset-0 w-full h-full" 
                  style={{ 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    width: '100%', 
                    height: '100%',
                    overflow: 'hidden'
                  }}
                  onClick={(e) => {
                    // Handle click for pause/play (center zone)
                    const target = e.currentTarget as HTMLElement;
                    const containerRect = target.getBoundingClientRect();
                    const containerWidth = containerRect.width;
                    const clickX = e.clientX - containerRect.left;
                    const leftZone = containerWidth / 3;
                    const rightZone = (containerWidth * 2) / 3;
                    
                    if (clickX < leftZone) {
                      // Left zone - previous
                      if (activeIndex > 0) {
                        setActiveIndex(activeIndex - 1);
                        setProgress(0);
                        scheduleNext(activeItems, activeIndex - 1);
                      }
                    } else if (clickX > rightZone) {
                      // Right zone - next
                      if (activeIndex < activeItems.length - 1) {
                        setActiveIndex(activeIndex + 1);
                        setProgress(0);
                        scheduleNext(activeItems, activeIndex + 1);
                      }
                    } else {
                      // Center zone - pause/play
                      togglePause();
                    }
                  }}
                >
                  {renderActiveItem()}
                </div>
                <button 
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors" 
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
                <button
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-12 h-12 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors bg-black/30"
                  onClick={togglePause}
                >
                  {isPaused ? '▶' : '⏸'}
                </button>
              </div>
            </div>
          )}

      </main>

      {/* Add Story Modal */}
      <AddStoryModal
        isOpen={isAddStoryModalOpen}
        onClose={() => setIsAddStoryModalOpen(false)}
        onSuccess={() => {
          setIsAddStoryModalOpen(false);
          loadStories();
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={t.delete_story || 'Delete Story'}
        message={t.delete_story_confirm || 'Are you sure you want to delete this story? This action cannot be undone.'}
        loading={deleting}
        error={deleteError}
        confirmButtonText={t.delete_confirm || 'Delete'}
        cancelButtonText={t.cancel || 'Cancel'}
      />
    </div>
  );

  // Content for principal layout (matching students/guardians page structure)
  function PrincipalStoriesContent() {
    const { sidebarRef } = usePrincipalPageLayout();

    return (
      <>
        {/* Content Header */}
        <div className="mb-ds-sm flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-ds-sm">
            {/* Mobile menu button */}
            <button
              onClick={() => sidebarRef?.current?.open()}
              className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-ds-h1 font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t.stories_title}</h2>
              <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">{t.subtitle || 'View and manage stories'}</p>
            </div>
          </div>

          <div className="flex items-center gap-ds-sm">
            <ProfileSwitcher />
            {canCreateStory && (
              <button
                onClick={() => setIsAddStoryModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 hover:bg-mint-600 px-4 py-2 text-ds-small text-white transition-colors"
              >
                <Plus className="h-4 w-4" /> {t.create_story}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Stories Table */}
        <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          {loading && stories.length === 0 ? (
            <LoadingSkeleton type="table" rows={10} />
          ) : stories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">{t.empty || 'No stories yet.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-hidden border border-slate-200 dark:border-slate-700 rounded-ds-md">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-mint-500">
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tl-ds-md">
                      {t.col_title}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                      {t.col_scope}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300">
                      {t.col_caption}
                    </th>
                    <th className="text-left py-2 px-4 text-ds-small font-medium text-white dark:text-slate-300 rounded-tr-ds-md">
                      {t.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStories.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-mint-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="text-left py-2 px-4 text-ds-small text-slate-900 dark:text-slate-100">
                        {s.title || '—'}
                      </td>
                      <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                        {s.class_id ? t.class_label : t.org_wide}
                      </td>
                      <td className="text-left py-2 px-4 text-ds-small text-slate-600 dark:text-slate-400">
                        {s.caption || t.no_caption}
                      </td>
                      <td className="text-left py-2 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openStoryViewer(s)}
                            className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            title={t.view}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{t.view}</span>
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/edit-story/${s.id}`)}
                            className="inline-flex items-center gap-1 rounded-ds-sm border border-slate-300 px-2 py-1 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            title={t.edit}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>{t.edit}</span>
                          </button>
                          <button
                            onClick={() => openDeleteModal(s)}
                            className="inline-flex items-center gap-1 rounded-ds-sm border border-red-300 px-2 py-1 text-ds-small text-red-600 hover:bg-red-50 transition-colors dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20"
                            title={t.delete}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t.delete}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination controls */}
          {stories.length > itemsPerPage && (
            <div className="mt-4 w-full flex justify-end gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {t.prev || 'Prev'}
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`inline-flex items-center rounded-ds-md px-3 py-1.5 text-ds-small transition-colors ${currentPage === idx + 1 ? 'bg-mint-500 text-white border border-mint-500' : 'border border-slate-400 hover:bg-mint-50 dark:border-slate-600 dark:text-slate-200'}`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center rounded-ds-md border border-slate-400 px-3 py-1.5 text-ds-small disabled:opacity-50 hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {t.next || 'Next'}
              </button>
            </div>
          )}
        </div>

        {/* Story Viewer */}
        {viewerOpen && activeStory && (
          <div 
            className="fixed inset-0 z-50 bg-black flex items-center justify-center" 
            style={{ width: '100vw', height: '100vh', top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeViewer(e);
              }
            }}
          >
            <div className="relative w-full h-full bg-black overflow-hidden max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto rounded-lg shadow-lg" style={{ width: '90%', height: '90vh', maxHeight: '800px', position: 'relative' }}>
              {/* Progress bars at top */}
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
              <div 
                className="absolute inset-0 w-full h-full" 
                style={{ 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  width: '100%', 
                  height: '100%',
                  overflow: 'hidden'
                }}
                onClick={(e) => {
                  const target = e.currentTarget as HTMLElement;
                  const containerRect = target.getBoundingClientRect();
                  const containerWidth = containerRect.width;
                  const clickX = e.clientX - containerRect.left;
                  const leftZone = containerWidth / 3;
                  const rightZone = (containerWidth * 2) / 3;
                  
                  if (clickX < leftZone) {
                    if (activeIndex > 0) {
                      setActiveIndex(activeIndex - 1);
                      setProgress(0);
                      scheduleNext(activeItems, activeIndex - 1);
                    }
                  } else if (clickX > rightZone) {
                    if (activeIndex < activeItems.length - 1) {
                      setActiveIndex(activeIndex + 1);
                      setProgress(0);
                      scheduleNext(activeItems, activeIndex + 1);
                    }
                  } else {
                    togglePause();
                  }
                }}
              >
                {renderActiveItem()}
              </div>
              <button 
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors" 
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
              <button
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-12 h-12 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors bg-black/30"
                onClick={togglePause}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            </div>
          </div>
        )}

        {/* Add Story Modal */}
        <AddStoryModal
          isOpen={isAddStoryModalOpen}
          onClose={() => setIsAddStoryModalOpen(false)}
          onSuccess={() => {
            setIsAddStoryModalOpen(false);
            loadStories();
          }}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
          title={t.delete_story || 'Delete Story'}
          message={t.delete_story_confirm || 'Are you sure you want to delete this story? This action cannot be undone.'}
          loading={deleting}
          error={deleteError}
          confirmButtonText={t.delete_confirm || 'Delete'}
          cancelButtonText={t.cancel || 'Cancel'}
        />
      </>
    );
  }

  // Wrap with appropriate layout based on user role
  if (isPrincipal) {
    return (
      <PrincipalPageLayout>
        <PrincipalStoriesContent />
      </PrincipalPageLayout>
    );
  }

  // Fallback for other roles (return teacher content)
  return teacherContent;
}

export default function StoriesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-mint-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="mb-ds-md mt-14">
            <div className="h-10 w-20 animate-pulse bg-mint-200 dark:bg-slate-700 rounded-ds-md"></div>
          </div>
          <LoadingSkeleton type="table" rows={10} />
        </div>
      </div>
    }>
      <StoriesPageContent />
    </Suspense>
  );
}
