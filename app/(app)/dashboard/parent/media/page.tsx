'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';

interface Photo {
  id: string;
  org_id: string;
  class_id: string | null;
  student_id: string | null;
  upload_id: string;
  author_id: string | null;
  caption: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string | null;
  url: string | null;
  uploads?: {
    id: string;
    bucket: string;
    path: string;
    filename: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    width: number | null;
    height: number | null;
  };
  users?: {
    id: string;
    first_name: string;
    last_name: string | null;
  } | null;
  classes?: {
    id: string;
    name: string;
  } | null;
  students?: {
    id: string;
    first_name: string;
    last_name: string | null;
  } | null;
}

interface LinkedStudent {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  classes?: { name: string; id: string } | null;
  class_id?: string | null;
}

export default function ParentMediaPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

  // State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Fetch linked students
  useEffect(() => {
    let isMounted = true;

    async function loadLinkedStudents() {
      if (!session?.user?.id) {
        if (isMounted) {
          setLoadingStudents(false);
        }
        return;
      }

      const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
      const guardianId = session?.user?.id;

      if (!orgId || !guardianId) {
        if (isMounted) {
          setLoadingStudents(false);
        }
        return;
      }

      try {
        // Try to load from cache first
        if (typeof window !== 'undefined') {
          const studentsKey = `parent_students_${guardianId}`;
          const cached = localStorage.getItem(studentsKey);
          if (cached) {
            const parsed = JSON.parse(cached) as LinkedStudent[];
            if (Array.isArray(parsed)) {
              if (isMounted) {
                setLinkedStudents(parsed);
                setLoadingStudents(false);
              }
            }
          }
        }

        // Fetch from API
        const studentsRes = await fetch(`/api/guardian-students?guardianId=${guardianId}`);
        
        if (!studentsRes.ok) {
          throw new Error('Failed to fetch guardian students');
        }
        
        const studentsData = await studentsRes.json();
        const relationships = studentsData.relationships || [];
        const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);

        if (studentIds.length > 0) {
          const studentsDetailsRes = await fetch(`/api/students?orgId=${orgId}`);
          
          if (!studentsDetailsRes.ok) {
            throw new Error('Failed to fetch students');
          }
          
          const studentsDetails = await studentsDetailsRes.json();
          const allStudents = studentsDetails.students || [];
          
          const linked = allStudents
            .filter((s: any) => studentIds.includes(s.id))
            .map((s: any) => ({
              id: s.id,
              first_name: s.users?.first_name || s.first_name || '',
              last_name: s.users?.last_name || s.last_name || null,
              email: s.users?.email || null,
              classes: s.classes || null,
              class_id: s.class_id || s.classes?.id || null,
            }));

          if (isMounted) {
            setLinkedStudents(linked);
            // Cache for instant load next time
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem(`parent_students_${guardianId}`, JSON.stringify(linked));
              }
            } catch {}
            setLoadingStudents(false);
          }
        } else {
          if (isMounted) {
            setLinkedStudents([]);
            setLoadingStudents(false);
          }
        }
      } catch (e: any) {
        console.error('Error loading linked students:', e);
        if (isMounted) {
          setLinkedStudents([]);
          setLoadingStudents(false);
        }
      }
    }

    loadLinkedStudents();

    return () => {
      isMounted = false;
    };
  }, [session]);

  // Fetch photos filtered by linked students' classes
  useEffect(() => {
    let isMounted = true;

    async function fetchPhotos() {
      if (!session?.user?.id || loadingStudents) return;

      const orgId = (session?.user?.user_metadata as any)?.org_id as string | undefined;
      if (!orgId) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      // Get unique class IDs from linked students
      const classIds = Array.from(
        new Set(
          linkedStudents
            .map((s) => s.class_id)
            .filter((id): id is string => !!id)
        )
      );

      try {
        setIsLoading(true);
        setError(null);

        const photoPromises: Promise<Photo[]>[] = [];

        // Always fetch org-wide photos (where class_id is null) - these show to all teachers and parents
        photoPromises.push(
          fetch(`/api/photos?orgId=${orgId}&limit=100`, { cache: 'no-store' })
            .then(async (response) => {
              if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || data.details || 'Failed to fetch photos');
              }
              const data = await response.json();
              // Filter to only org-wide photos (class_id is null)
              return ((data.photos || []) as Photo[]).filter((photo: Photo) => !photo.class_id);
            })
        );

        // Fetch class-specific photos for linked students' classes
        classIds.forEach((classId) => {
          photoPromises.push(
            fetch(`/api/photos?orgId=${orgId}&classId=${classId}&limit=100`, { cache: 'no-store' })
              .then(async (response) => {
                if (!response.ok) {
                  const data = await response.json();
                  throw new Error(data.error || data.details || 'Failed to fetch photos');
                }
                const data = await response.json();
                return (data.photos || []) as Photo[];
              })
          );
        });

        const photoArrays = await Promise.all(photoPromises);
        // Flatten and deduplicate by photo ID
        const allPhotos = photoArrays.flat();
        const uniquePhotos = Array.from(
          new Map(allPhotos.map((photo: Photo) => [photo.id, photo])).values()
        ) as Photo[];

        // Sort by created_at descending
        uniquePhotos.sort((a: Photo, b: Photo) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (isMounted) {
          setPhotos(uniquePhotos);
        }
      } catch (err) {
        console.error('Error fetching photos:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load photos');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchPhotos();

    return () => {
      isMounted = false;
    };
  }, [session, linkedStudents, loadingStudents]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 mt-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> {t.back || 'Back'}
            </button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {t.media || 'Media'}
              </h1>
              {linkedStudents.length > 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Viewing photos for your linked students
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Photos Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {/* Error State */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading || loadingStudents ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 animate-pulse"
                />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p>{t.no_photos_uploaded || 'No photos uploaded yet'}</p>
              <p className="text-sm mt-1">
                {linkedStudents.length === 0 
                  ? 'No org-wide photos available. Link a student to view class-specific photos.'
                  : 'No photos available for your linked students or organization'}
              </p>
            </div>
          ) : (
            /* Photos Grid */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700 cursor-pointer"
                  onClick={() => {
                    // Optional: Open photo in modal or full screen
                    if (photo.url) {
                      window.open(photo.url, '_blank');
                    }
                  }}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Photo'}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                    </div>
                  )}
                  
                  {/* Overlay with info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-sm">
                      {photo.caption && (
                        <p className="truncate font-medium mb-1">{photo.caption}</p>
                      )}
                      <div className="flex items-center justify-between text-xs opacity-90">
                        <span>
                          {new Date(photo.created_at).toLocaleDateString(
                            lang === 'is' ? 'is-IS' : 'en-US'
                          )}
                        </span>
                        {photo.is_public && (
                          <span className="px-2 py-0.5 bg-white/20 rounded">
                            {t.public || 'Public'}
                          </span>
                        )}
                      </div>
                      {photo.classes && (
                        <p className="text-xs opacity-75 mt-1 truncate">
                          {photo.classes.name}
                        </p>
                      )}
                      {photo.students && (
                        <p className="text-xs opacity-75 mt-1 truncate">
                          {photo.students.first_name} {photo.students.last_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

