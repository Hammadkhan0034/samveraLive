'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Timer, Users, Bell, MessageSquare, Camera, Utensils, Plus, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import { AddStoryModal } from '@/app/components/shared/AddStoryModal';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import EmptyState from '@/app/components/EmptyState';
import { supabase } from '@/lib/supabaseClient';

type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherStoriesPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

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
  
  // Add story modal state
  const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);

  // Load stories function
  const loadStories = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      const userId = session.user.id;
      const teacherClassIds = teacherClasses.map(c => c.id).filter(Boolean);
      
      const params = new URLSearchParams();
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

  // Load stories on mount and when dependencies change
  useEffect(() => {
    loadStories();
  }, [teacherClasses, session?.user?.id]);

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

  function goToNextItem() {
    if (activeIndex < activeItems.length - 1) {
      setActiveIndex(activeIndex + 1);
      scheduleNext(activeItems, activeIndex + 1);
    }
  }

  function goToPrevItem() {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
      scheduleNext(activeItems, activeIndex - 1);
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
      
      const res = await fetch(`/api/story-items?storyId=${story.id}`, { 
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
      // Check if URL is from Supabase Storage
      const isSupabaseUrl = imageSrc.includes('supabase.co') || imageSrc.includes('supabase');
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
            unoptimized={isSupabaseUrl}
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

  return (
    <TeacherPageLayout>
      {/* Stories Panel */}
      <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                <h2 className="text-ds-small sm:text-ds-h3 font-medium text-slate-900 dark:text-slate-100">{t.stories_title}</h2>
                <button
                  onClick={() => setIsAddStoryModalOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 px-3 sm:px-4 py-1.5 sm:py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 active:bg-mint-700 dark:active:bg-slate-500"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{t.add_story}</span>
                  <span className="sm:hidden">{t.add || 'Add'}</span>
                </button>
              </div>

              <div className="flex gap-2 sm:gap-ds-sm overflow-x-auto py-1 -mx-3 sm:-mx-0 px-3 sm:px-0">
                <button
                  onClick={() => setIsAddStoryModalOpen(true)}
                  className="flex w-16 sm:w-20 flex-col items-center gap-1 flex-shrink-0"
                >
                  <span className="rounded-ds-full bg-gradient-to-tr from-mint-300 to-mint-400 p-0.5">
                    <span className="block rounded-ds-full bg-white p-0.5">
                      <span className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-ds-full border border-dashed">
                        <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                    </span>
                  </span>
                  <span className="truncate text-ds-tiny text-slate-600 dark:text-slate-400 max-w-[64px] sm:max-w-[80px]">{t.add}</span>
                </button>

                {loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex w-16 sm:w-20 flex-col items-center gap-1 flex-shrink-0">
                        <span className="rounded-ds-full bg-gradient-to-tr from-mint-300 to-mint-400 p-0.5">
                          <span className="block rounded-ds-full bg-white p-0.5">
                            <span className="h-12 w-12 sm:h-16 sm:w-16 rounded-ds-full bg-mint-100 dark:bg-slate-600 animate-pulse"></span>
                          </span>
                        </span>
                        <span className="h-3 w-12 sm:w-16 bg-mint-100 dark:bg-slate-600 rounded-ds-sm animate-pulse"></span>
                      </div>
                    ))}
                  </>
                ) : (
                  Object.values(storiesByClass).map((group) => (
                    group.stories.map((story) => (
                      <button
                        key={story.id}
                        onClick={() => openStory(story)}
                        className="flex w-16 sm:w-20 flex-col items-center gap-1 flex-shrink-0"
                      >
                        <span className="rounded-ds-full bg-gradient-to-tr from-rose-400 to-amber-400 p-0.5">
                          <span className="block rounded-ds-full bg-white p-0.5">
                            <span className="h-12 w-12 sm:h-16 sm:w-16 rounded-ds-full bg-mint-100 dark:bg-slate-600 flex items-center justify-center text-ds-tiny sm:text-xs text-slate-600 dark:text-slate-300 font-medium">
                              {story.title ? story.title.charAt(0).toUpperCase() : 'S'}
                            </span>
                          </span>
                        </span>
                        <span className="truncate text-ds-tiny text-slate-600 dark:text-slate-400 max-w-[64px] sm:max-w-[80px]" title={group.class.name}>
                          {group.class.name}
                        </span>
                      </button>
                    ))
                  )).flat()
                )}
              </div>
              <p className="mt-3 sm:mt-4 text-ds-tiny sm:text-sm text-slate-600 dark:text-slate-400">{t.stories_hint}</p>
              
              {/* Stories Table */}
              <div className="mt-4 sm:mt-6 rounded-t-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {loading && stories.length === 0 ? (
                  <div className="p-3 sm:p-6">
                    <LoadingSkeleton type="table" rows={5} />
                  </div>
                ) : stories.length === 0 ? (
                  <div className="p-4 sm:p-6">
                    <EmptyState
                      icon={FileText}
                      title={t.no_stories_title}
                      description={t.no_stories_description}
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-mint-500 text-white">
                        <tr>
                          <th className="px-2 sm:px-4 py-2 text-left text-ds-tiny sm:text-ds-small font-semibold text-white rounded-tl-ds-md">{t.col_title}</th>
                          <th className="px-2 sm:px-4 py-2 text-left text-ds-tiny sm:text-ds-small font-semibold text-white hidden md:table-cell">{t.col_scope}</th>
                          <th className="px-2 sm:px-4 py-2 text-left text-ds-tiny sm:text-ds-small font-semibold text-white hidden lg:table-cell">{t.col_caption}</th>
                          <th className="px-2 sm:px-4 py-2 text-left text-ds-tiny sm:text-ds-small font-semibold text-white rounded-tr-ds-md">{t.actions || 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {stories.map((s) => {
                          const classInfo = s.class_id ? teacherClasses.find(c => c.id === s.class_id) : null;
                          const className = classInfo ? classInfo.name : (s.class_id ? `Class ${s.class_id.substring(0, 8)}` : null);
                          return (
                          <tr key={s.id} className="hover:bg-mint-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-2 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {s.title || '—'}
                            </td>
                            <td className="px-2 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400 hidden md:table-cell whitespace-nowrap">
                              {s.class_id ? (className || t.class_label) : t.org_wide}
                            </td>
                            <td className="px-2 sm:px-4 py-2 text-ds-tiny sm:text-ds-small text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                              <span className="truncate block max-w-[200px]">{s.caption || t.no_caption}</span>
                            </td>
                            <td className="px-2 sm:px-4 py-2">
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                <button
                                  onClick={() => openStory(s)}
                                  className="inline-flex items-center gap-0.5 sm:gap-1 rounded-ds-md border border-slate-300 px-1.5 sm:px-2 py-1 text-ds-tiny sm:text-ds-small hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors active:bg-mint-100 dark:active:bg-slate-500"
                                  title={t.view}
                                >
                                  <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                  <span className="hidden sm:inline">{t.view}</span>
                                </button>
                                <button
                                  onClick={() => router.push(`/dashboard/edit-story/${s.id}`)}
                                  className="inline-flex items-center gap-0.5 sm:gap-1 rounded-ds-md border border-slate-300 px-1.5 sm:px-2 py-1 text-ds-tiny sm:text-ds-small hover:bg-mint-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors active:bg-mint-100 dark:active:bg-slate-500"
                                  title={t.edit || 'Edit'}
                                >
                                  <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                  <span className="hidden sm:inline">{t.edit || 'Edit'}</span>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(s)}
                                  className="inline-flex items-center gap-0.5 sm:gap-1 rounded-ds-md border border-red-300 px-1.5 sm:px-2 py-1 text-ds-tiny sm:text-ds-small text-red-600 hover:bg-red-50 dark:border-red-600 dark:bg-slate-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors active:bg-red-100 dark:active:bg-red-900/30"
                                  title={t.delete || 'Delete'}
                                >
                                  <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                  <span className="hidden sm:inline">{t.delete || 'Delete'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
                  {/* Centered Story Container with left/right gaps (Instagram style) */}
                  <div 
                    className="relative bg-black overflow-hidden rounded-lg mx-auto"
                    style={{ 
                      width: '95%',
                      maxWidth: '500px',
                      height: '85vh',
                      maxHeight: '800px',
                      position: 'relative'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Progress bars */}
                    <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 right-1.5 sm:right-2 z-10 flex gap-0.5 sm:gap-1">
                      {activeItems.map((_, idx) => {
                        const isCompleted = idx < activeIndex;
                        const isActive = idx === activeIndex;
                        const fillPercent = isCompleted ? 100 : isActive ? progress : 0;
                        
                        return (
                          <div key={idx} className="h-0.5 sm:h-1 flex-1 rounded-full bg-white/20 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-white"
                              style={{ width: `${fillPercent}%`, transition: 'width 0.1s linear' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Left click area for previous */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1/3 z-20 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevItem();
                      }}
                      style={{ zIndex: 20 }}
                    />

                    {/* Right click area for next */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-1/3 z-20 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextItem();
                      }}
                      style={{ zIndex: 20 }}
                    />
                    
                    {/* Story content */}
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
                    
                    {/* Close button */}
                    <button 
                      className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-30 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors text-base sm:text-lg" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeViewer(e);
                      }}
                      type="button"
                      style={{ zIndex: 30 }}
                    >
                      ✕
                    </button>
                    
                    {/* Pause/Play button */}
                    <button
                      className="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors bg-black/30 text-base sm:text-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePause();
                      }}
                      type="button"
                      style={{ zIndex: 30 }}
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
                confirmButtonText={t.delete || 'Delete'}
                cancelButtonText={t.cancel || 'Cancel'}
              />
            </div>
    </TeacherPageLayout>
  );
}

