'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Timer, Users, Bell, MessageSquare, Camera, Link as LinkIcon, Utensils, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCurrentUserOrgId } from '@/lib/hooks/useCurrentUserOrgId';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import { supabase } from '@/lib/supabaseClient';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Translations removed - using centralized translations from @/lib/translations

export default function TeacherStoriesPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

  // Use universal hook to get org_id (checks metadata first, then API, handles logout if missing)
  const { orgId: finalOrgId } = useCurrentUserOrgId();

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

  // Define tiles array (excluding stories, attendance, diapers, messages, and media as they're handled separately)
  const tiles: Array<{
    id: TileId;
    title: string;
    desc: string;
    Icon: React.ElementType;
    badge?: string | number;
    route?: string;
  }> = useMemo(() => [
      { id: 'link_student', title: t.tile_link_student || 'Link Student', desc: t.tile_link_student_desc || 'Link a guardian to a student', Icon: LinkIcon, route: '/dashboard/teacher?tab=link_student' },
      { id: 'menus', title: t.tile_menus || 'Menus', desc: t.tile_menus_desc || 'Manage daily menus', Icon: Utensils, route: '/dashboard/teacher?tab=menus' },
    ], [t, lang]);

  return (
    <TeacherPageLayout>
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
                  <>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex w-20 flex-col items-center gap-1">
                        <span className="rounded-full bg-gradient-to-tr from-slate-300 to-slate-400 p-0.5">
                          <span className="block rounded-full bg-white p-0.5">
                            <span className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-600 animate-pulse"></span>
                          </span>
                        </span>
                        <span className="h-3 w-16 bg-slate-200 dark:bg-slate-600 rounded animate-pulse"></span>
                      </div>
                    ))}
                  </>
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
              <div className="mt-6 rounded-t-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {loading && stories.length === 0 ? (
                  <div className="p-6">
                    <LoadingSkeleton type="table" rows={5} />
                  </div>
                ) : stories.length === 0 ? (
                  <div className="p-6 text-center text-slate-600 dark:text-slate-400">{t.empty_stories || 'No stories yet.'}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-black text-white">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white rounded-tl-xl">{t.col_title}</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white">{t.col_scope}</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white">{t.col_caption}</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-white rounded-tr-xl">{t.actions || 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {stories.map((s) => {
                          const classInfo = s.class_id ? teacherClasses.find(c => c.id === s.class_id) : null;
                          const className = classInfo ? classInfo.name : (s.class_id ? `Class ${s.class_id.substring(0, 8)}` : null);
                          return (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                            <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                              {s.title || '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                              {s.class_id ? (className || t.class_label) : t.org_wide}
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
                      width: '90%',
                      maxWidth: '500px',
                      height: '90vh',
                      maxHeight: '800px',
                      position: 'relative'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                      className="absolute top-2 right-2 z-30 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors" 
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
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 w-12 h-12 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors bg-black/30"
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

