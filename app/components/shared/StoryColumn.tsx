'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

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

type StoryWithPreview = Story & {
  previewUrl: string | null;
};

type StoryItem = {
  id: string;
  story_id: string;
  order_index: number;
  url: string | null;
  duration_ms: number | null;
  caption: string | null;
  mime_type: string | null;
};

interface StoryColumnProps {
  lang?: 'en' | 'is';
  orgId?: string | null;
  userId?: string | null;
  userRole?: 'principal' | 'teacher' | 'parent';
  teacherClassIds?: string[];
  parentClassIds?: string[];
}

export default function StoryColumn({
  lang = 'en',
  orgId,
  userId,
  userRole,
  teacherClassIds = [],
  parentClassIds = [],
}: StoryColumnProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { session } = useAuth();
  const [stories, setStories] = useState<StoryWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);

  // Story viewer state
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

  // Helper to validate UUID format
  const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Get effective orgId and userId from session if not provided
  const rawOrgId = orgId || (session?.user?.user_metadata as any)?.org_id || (session?.user?.user_metadata as any)?.organization_id || (session?.user?.user_metadata as any)?.orgId;
  // Only use orgId if it's a valid UUID (skip legacy "1" values)
  const effectiveOrgId = rawOrgId && isValidUUID(rawOrgId) ? rawOrgId : null;
  const effectiveUserId = userId || session?.user?.id;

  // Determine user role from session if not provided
  const effectiveUserRole = useMemo(() => {
    if (userRole) return userRole;
    const userMetadata = session?.user?.user_metadata as any;
    const roleRaw = String(
      userMetadata?.role || userMetadata?.user_type || userMetadata?.account_type || userMetadata?.type || userMetadata?.activeRole || ''
    ).toLowerCase();
    if (/principal|admin|head/.test(roleRaw)) return 'principal';
    if (/teacher/.test(roleRaw)) return 'teacher';
    if (/parent|guardian/.test(roleRaw)) return 'parent';
    return 'parent'; // default
  }, [userRole, session]);

  // Hydrate from cache instantly on mount
  useEffect(() => {
    if (effectiveOrgId && effectiveUserId) {
      try {
        const cacheKey = `stories_column_cache_${effectiveOrgId}_${effectiveUserId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as StoryWithPreview[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStories(parsed);
            setHydratedFromCache(true);
            setLoading(false); // Don't show loading if we have cache
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [effectiveOrgId, effectiveUserId]);

  // Fetch stories
  useEffect(() => {
    if (!effectiveOrgId) {
      setLoading(false);
      setError(null); // Don't show error for missing/invalid orgId
      return;
    }

    // For teachers, API requires either teacherClassIds or teacherAuthorId
    // Skip the call if we don't have either (session might not be loaded yet)
    if (effectiveUserRole === 'teacher' && !effectiveUserId && teacherClassIds.length === 0) {
      setLoading(false);
      setError(null); // Don't show error, just don't fetch
      console.log('⚠️ StoryColumn: Skipping API call - teacher needs either userId or teacherClassIds', {
        effectiveUserId,
        teacherClassIdsLength: teacherClassIds.length,
        hasSession: !!session
      });
      return;
    }

    async function loadStories() {
      // Don't show loading if we already have cached data
      if (!hydratedFromCache) {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams({ orgId: effectiveOrgId });
        
        if (effectiveUserRole === 'teacher') {
          params.set('audience', 'teacher');
          
          // API requires either teacherClassIds or teacherAuthorId for teachers
          // Ensure we have at least one before making the call
          const hasTeacherAuthorId = effectiveUserId && typeof effectiveUserId === 'string' && effectiveUserId.trim() !== '';
          const hasTeacherClassIds = teacherClassIds.length > 0;
          
          if (!hasTeacherAuthorId && !hasTeacherClassIds) {
            console.error('❌ StoryColumn: Cannot fetch stories - teacher needs either userId or teacherClassIds', {
              effectiveUserId,
              teacherClassIdsLength: teacherClassIds.length,
              hasSession: !!session
            });
            setError(null); // Don't show error to user
            setLoading(false);
            return;
          }
          
          // Always set teacherAuthorId if available (required by API validation)
          if (hasTeacherAuthorId) {
            params.set('teacherAuthorId', effectiveUserId);
          }
          // Also include teacherClassIds if available
          if (hasTeacherClassIds) {
            const classIdsString = teacherClassIds.join(',');
            params.set('teacherClassIds', classIdsString);
            console.log('📤 StoryColumn: Sending teacherClassIds to API:', {
              teacherClassIds,
              classIdsString,
              userId: effectiveUserId
            });
          } else {
            console.log('⚠️ StoryColumn: No teacherClassIds provided, using teacherAuthorId only');
          }
        } else if (effectiveUserRole === 'parent') {
          params.set('audience', 'parent');
          if (effectiveUserId) {
            params.set('parentUserId', effectiveUserId);
          }
          if (parentClassIds.length > 0) {
            params.set('parentClassIds', parentClassIds.join(','));
          }
        } else if (effectiveUserRole === 'principal') {
          params.set('audience', 'principal');
          if (effectiveUserId) {
            params.set('principalAuthorId', effectiveUserId);
          }
        }

        const res = await fetch(`/api/stories?${params.toString()}`, { cache: 'no-store' });
        
        // Clone response for error handling (response body can only be read once)
        const resClone = res.clone();
        
        let json: any;
        try {
          json = await res.json();
        } catch (e) {
          // If JSON parsing fails, try to get text from cloned response
          try {
            const text = await resClone.text();
            console.error('❌ Stories API: Failed to parse JSON response:', {
              status: res.status,
              statusText: res.statusText,
              rawResponse: text.substring(0, 500), // First 500 chars
              params: params.toString()
            });
            throw new Error(`Invalid response from server (${res.status}): ${text.substring(0, 200)}`);
          } catch (textError) {
            console.error('❌ Stories API: Failed to parse response:', {
              status: res.status,
              statusText: res.statusText,
              parseError: e,
              params: params.toString()
            });
            throw new Error(`Invalid response from server (${res.status})`);
          }
        }
        
        if (!res.ok) {
          const errorMessage = json.error || (typeof json.details === 'string' ? json.details : (json.details ? JSON.stringify(json.details) : null)) || `Failed with status ${res.status}`;
          console.error('❌ Stories API error:', {
            status: res.status,
            statusText: res.statusText,
            error: errorMessage,
            details: json.details,
            fullResponse: json,
            params: params.toString(),
            url: `/api/stories?${params.toString()}`
          });
          throw new Error(errorMessage);
        }

        const storiesList = Array.isArray(json.stories) ? json.stories : [];
        
        // Fetch preview images for each story
        const storiesWithPreviews = await Promise.all(
          storiesList.map(async (story: Story) => {
            try {
              const itemsRes = await fetch(`/api/story-items?storyId=${story.id}&orgId=${effectiveOrgId}`, { cache: 'no-store' });
              const itemsJson = await itemsRes.json();
              const items = Array.isArray(itemsJson.items) ? itemsJson.items : [];
              
              // Find first image item
              const firstImageItem = items.find((item: any) => 
                item.mime_type && item.mime_type.startsWith('image/') && item.url
              );
              
              return {
                ...story,
                previewUrl: firstImageItem?.url || null,
              };
            } catch (e) {
              return {
                ...story,
                previewUrl: null,
              };
            }
          })
        );

        setStories(storiesWithPreviews);
        
        // Cache stories for instant load next time
        if (effectiveOrgId && effectiveUserId) {
          try {
            const cacheKey = `stories_column_cache_${effectiveOrgId}_${effectiveUserId}`;
            localStorage.setItem(cacheKey, JSON.stringify(storiesWithPreviews));
          } catch (e) {
            // Ignore cache errors
          }
        }
      } catch (e: any) {
        setError(e.message);
        console.error('Error loading stories:', e);
      } finally {
        setLoading(false);
        setHydratedFromCache(false); // Reset after first load
      }
    }

    loadStories();
  }, [effectiveOrgId, effectiveUserId, effectiveUserRole, teacherClassIds.join(','), parentClassIds.join(','), hydratedFromCache]);

  const handleStoryClick = (story: StoryWithPreview) => {
    openStoryViewer(story);
  };

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
    } else {
      pausedTimeRef.current = Date.now();
      setIsPaused(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  async function openStoryViewer(s: StoryWithPreview) {
    try {
      setActiveStory(s);
      setViewerOpen(true);
      setIsPaused(false);
      pausedTimeRef.current = 0;
      itemStartTimeRef.current = 0;
      startTimeRef.current = 0;
      setActiveItems([]);
      setActiveIndex(0);
      setProgress(0);
      
      const res = await fetch(`/api/story-items?storyId=${s.id}${effectiveOrgId ? `&orgId=${effectiveOrgId}` : ''}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const json = await res.json();
      const its: StoryItem[] = Array.isArray(json.items) ? json.items : [];
      
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

  // Detect click zone (left, center, right) - relative to story container
  function getClickZone(e: React.MouseEvent): 'left' | 'center' | 'right' {
    const target = e.currentTarget as HTMLElement;
    const containerRect = target.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const clickX = e.clientX - containerRect.left; // Relative to container
    
    const leftZone = containerWidth / 3;
    const rightZone = (containerWidth * 2) / 3;
    
    if (clickX < leftZone) return 'left';
    if (clickX > rightZone) return 'right';
    return 'center';
  }

  // Navigation functions
  function goToPreviousStory() {
    if (!activeStory) return;
    const currentStoryIndex = stories.findIndex(st => st.id === activeStory.id);
    if (currentStoryIndex > 0) {
      openStoryViewer(stories[currentStoryIndex - 1]);
    }
  }

  function goToNextStory() {
    if (!activeStory) return;
    const currentStoryIndex = stories.findIndex(st => st.id === activeStory.id);
    if (currentStoryIndex >= 0 && currentStoryIndex < stories.length - 1) {
      openStoryViewer(stories[currentStoryIndex + 1]);
    } else {
      closeViewer();
    }
  }

  function goToPreviousItem() {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
      setProgress(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      startTimeRef.current = Date.now();
      if (activeItems.length > 0) {
        scheduleNext(activeItems, activeIndex - 1);
      }
    } else {
      // At first item, go to previous story
      goToPreviousStory();
    }
  }

  function goToNextItem() {
    if (activeIndex < activeItems.length - 1) {
      setActiveIndex(activeIndex + 1);
      setProgress(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      startTimeRef.current = Date.now();
      scheduleNext(activeItems, activeIndex + 1);
    } else {
      // At last item, go to next story
      goToNextStory();
    }
  }

  // Handle story viewer click based on zone
  function handleStoryViewerClick(e: React.MouseEvent) {
    e.stopPropagation();
    const zone = getClickZone(e);
    
    if (zone === 'center') {
      togglePause();
    } else if (zone === 'left') {
      goToPreviousItem();
    } else if (zone === 'right') {
      goToNextItem();
    }
  }

  function scheduleNext(its: StoryItem[], index: number) {
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
        const currentStoryIndex = stories.findIndex(st => st.id === activeStory?.id);
        if (currentStoryIndex >= 0 && currentStoryIndex < stories.length - 1) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, viewerOpen, activeItems.length, activeIndex]);

  // Animate progress bar for current story item
  useEffect(() => {
    if (!viewerOpen || !activeItems.length || activeIndex >= activeItems.length) return;

    const item = activeItems[activeIndex];
    const duration = Math.max(item.duration_ms || 30000, 1000);

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (isPaused) {
      return;
    }

    if (pausedTimeRef.current > 0 && startTimeRef.current > 0) {
      const elapsedBeforePause = pausedTimeRef.current - startTimeRef.current;
      startTimeRef.current = Date.now() - elapsedBeforePause;
      pausedTimeRef.current = 0;
    } else {
      setProgress(0);
      startTimeRef.current = Date.now();
    }

    const updateInterval = 16;

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

  // Handle ESC key to close viewer
  useEffect(() => {
    if (!viewerOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeViewer();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen]);

  // Prevent body scroll when viewer is open
  useEffect(() => {
    if (viewerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [viewerOpen]);

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
        <div 
          className="absolute inset-0 w-full h-full bg-black cursor-pointer" 
          style={{ 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}
          onClick={handleStoryViewerClick}
        >
          <Image 
            src={imageSrc} 
            alt={it.caption || activeStory?.title || ''}
            fill
            sizes="100vw"
            className="object-cover object-center pointer-events-none z-[1]"
            onError={(e) => {
              console.error('Image load error');
              // TODO: Review error handling - next/image handles errors differently
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
        onClick={handleStoryViewerClick}
      >
        <div className="text-white text-center text-base leading-relaxed">{it.caption || activeStory?.title || ''}</div>
      </div>
    );
  }

  const handleCreateStory = () => {
    router.push('/dashboard/add-story');
  };

  const canCreateStory = effectiveUserRole === 'teacher' || effectiveUserRole === 'principal';

  // Only show loading skeleton if no cache exists and we're actually loading
  if (loading && stories.length === 0 && !hydratedFromCache) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && stories.length === 0) {
    return null; // Don't show error, just hide component
  }

  if (stories.length === 0 && !canCreateStory) {
    return null; // Don't show empty state if no stories and can't create
  }

  return (
    <div className="mb-6">
      <div 
        className="flex items-center gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {/* Create Story Button (for teachers/principals) */}
        {canCreateStory && (
          <button
            onClick={handleCreateStory}
            className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group"
            title={t.create_story || 'Create Story'}
          >
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:border-slate-400 dark:group-hover:border-slate-500 transition-colors">
              <Plus className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 text-center max-w-[64px] truncate">
              {t.create_story || 'Create'}
            </span>
          </button>
        )}

        {/* Story Items */}
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => handleStoryClick(story)}
            className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group"
            title={story.title || 'Story'}
          >
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-slate-300 dark:border-slate-600 group-hover:border-blue-500 dark:group-hover:border-blue-400 transition-colors">
              {story.previewUrl ? (
                <Image
                  src={story.previewUrl}
                  alt={story.title || 'Story'}
                  fill
                  sizes="64px"
                  className="object-cover rounded-full"
                  onError={(e) => {
                    // TODO: Review error handling - next/image handles errors differently
                    console.error('Image load error for story preview');
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 dark:from-blue-600 dark:to-purple-600 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 text-center max-w-[64px] truncate">
              {story.title || 'Story'}
            </span>
          </button>
        ))}

        {/* Empty state message (only if can create but no stories) */}
        {stories.length === 0 && canCreateStory && (
          <div className="flex-shrink-0 flex items-center text-sm text-slate-500 dark:text-slate-400 px-4">
            {t.no_stories || 'No stories yet'}
          </div>
        )}
      </div>

      {/* Story Viewer Modal */}
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
          {/* Centered Story Container */}
          <div 
            className="relative bg-black overflow-hidden rounded-lg"
            style={{ 
              width: '90%',
              maxWidth: '500px',
              height: '90vh',
              maxHeight: '800px',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                overflow: 'hidden'
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
    </div>
  );
}

