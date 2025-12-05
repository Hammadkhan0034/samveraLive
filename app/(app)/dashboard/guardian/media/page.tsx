'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import GuardianPageLayout, { useGuardianPageLayout } from '@/app/components/shared/GuardianPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';

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

function GuardianMediaContent() {
  const { t, lang } = useLanguage();
  const { sidebarRef } = useGuardianPageLayout();
  const { user } = useRequireAuth();

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
      if (!user?.id) {
        if (isMounted) {
          setLoadingStudents(false);
        }
        return;
      }

      try {
        // Try to load from cache first
        if (typeof window !== 'undefined') {
          const studentsKey = `parent_students_${user.id}`;
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

        // Fetch from API - server will get user_id and org_id from AuthResult
        const studentsRes = await fetch(`/api/guardian-students`);
        
        if (!studentsRes.ok) {
          throw new Error('Failed to fetch guardian students');
        }
        
        const studentsData = await studentsRes.json();
        const relationships = studentsData.relationships || [];
        const studentIds = relationships.map((r: any) => r.student_id).filter(Boolean);

        if (studentIds.length > 0) {
          const studentsDetailsRes = await fetch(`/api/students`);
          
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
                localStorage.setItem(`parent_students_${user.id}`, JSON.stringify(linked));
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
  }, [user]);

  // Fetch photos filtered by linked students' classes
  useEffect(() => {
    let isMounted = true;

    async function fetchPhotos() {
      if (!user?.id || loadingStudents) return;

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
          fetch(`/api/photos?limit=100`, { cache: 'no-store' })
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
            fetch(`/api/photos?classId=${classId}&limit=100`, { cache: 'no-store' })
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
  }, [user, linkedStudents, loadingStudents]);

  const subtitle = linkedStudents.length > 0
    ? 'Viewing photos for your linked students'
    : 'View photos from your organization and linked students';

  return (
    <>
      <PageHeader
        title={t.media || 'Media'}
        subtitle={subtitle}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
      />

      {/* Photos Panel */}
      <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading || loadingStudents ? (
          <LoadingSkeleton type="cards" rows={2} />
        ) : photos.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p>{t.no_photos_uploaded || 'No photos uploaded yet'}</p>
            <p className="text-ds-small mt-1">
              {linkedStudents.length === 0
                ? 'No org-wide photos available. Link a student to view class-specific photos.'
                : 'No photos available for your linked students or organization'}
            </p>
          </div>
        ) : (
          /* Photos Grid */
          <div className="grid grid-cols-1 gap-ds-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-ds-md bg-mint-50 dark:bg-slate-700 cursor-pointer"
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
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-ds-small">
                    {photo.caption && (
                      <p className="truncate font-medium mb-1">{photo.caption}</p>
                    )}
                    <div className="flex items-center justify-between text-ds-tiny opacity-90">
                      <span>
                        {new Date(photo.created_at).toLocaleDateString(
                          lang === 'is' ? 'is-IS' : 'en-US'
                        )}
                      </span>
                      {photo.is_public && (
                        <span className="px-2 py-0.5 bg-white/20 rounded-ds-sm">
                          {t.public || 'Public'}
                        </span>
                      )}
                    </div>
                    {photo.classes && (
                      <p className="text-ds-tiny opacity-75 mt-1 truncate">
                        {photo.classes.name}
                      </p>
                    )}
                    {photo.students && (
                      <p className="text-ds-tiny opacity-75 mt-1 truncate">
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
    </>
  );
}

function GuardianMediaPageContent() {
  return (
    <GuardianPageLayout>
      <GuardianMediaContent />
    </GuardianPageLayout>
  );
}

export default function GuardianMediaPage() {
  return (
    <Suspense fallback={
      <GuardianPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSkeleton type="cards" rows={2} />
        </div>
      </GuardianPageLayout>
    }>
      <GuardianMediaPageContent />
    </Suspense>
  );
}
