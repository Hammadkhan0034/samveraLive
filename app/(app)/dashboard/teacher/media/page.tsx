'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Plus, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import { PhotoUploadModal } from '@/app/components/shared/PhotoUploadModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import EmptyState from '@/app/components/EmptyState';

type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'menus';

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

export default function TeacherMediaPage() {
  const { t, lang } = useLanguage();


  // Get classes and students
  const { classes } = useTeacherClasses();
  const { students } = useTeacherStudents(classes);

  // State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch photos
  const fetchPhotos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get teacher's assigned class IDs
      const teacherClassIds = classes.map((cls) => cls.id).filter(Boolean);

      const photoPromises: Promise<Photo[]>[] = [];

      // Always fetch org-wide photos (where class_id is null) - these show to all teachers
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

      // Fetch class-specific photos for teacher's assigned classes
      teacherClassIds.forEach((classId) => {
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

      setPhotos(uniquePhotos);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch photos on mount and when classes change
  useEffect(() => {
    fetchPhotos();
  }, [classes]);

  // Handle successful upload
  const handleUploadSuccess = () => {
    fetchPhotos();
  };

  // Handle delete photo
  const handleDeleteClick = (photo: Photo) => {
    setPhotoToDelete(photo);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!photoToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/photos?photoId=${photoToDelete.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete photo');
      }

      // Remove photo from state
      setPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
      setIsDeleteModalOpen(false);
      setPhotoToDelete(null);
    } catch (err) {
      console.error('Error deleting photo:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete photo');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TeacherPageLayout mediaBadge={photos.length > 0 ? photos.length : undefined}>
      {/* Media Panel */}
      <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <h2 className="text-ds-small sm:text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
            {t.media_title || 'Media'}
          </h2>
          <button
            onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-ds-md border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 active:bg-mint-100 dark:active:bg-slate-600"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{(t as any).upload_photo || t.upload || 'Upload Photo'}</span>
              <span className="sm:hidden">{t.upload || 'Upload'}</span>
            </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-3 sm:mb-4 rounded-ds-md bg-red-50 border border-red-200 px-3 sm:px-4 py-2 sm:py-3 text-ds-tiny sm:text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-ds-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-ds-md overflow-hidden bg-mint-100 dark:bg-slate-700 animate-pulse"
              />
            ))}
          </div>
        ) : (
          /* Photos Grid */
          <div className="grid grid-cols-2 gap-2 sm:gap-ds-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  lang={lang}
                  icon={ImageIcon}
                  title={t.no_photos_title}
                  description={t.no_photos_description}
                />
              </div>
            ) : (
              photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-ds-md bg-slate-100 dark:bg-slate-700"
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Photo'}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                    </div>
                  )}
                  
                  {/* Delete button - top right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(photo);
                    }}
                    className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-ds-full p-1.5 sm:p-2 opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                    title={t.delete_photo || 'Delete Photo'}
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>

                  {/* Overlay with info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 text-white text-ds-tiny sm:text-ds-small">
                      {photo.caption && (
                        <p className="truncate font-medium mb-0.5 sm:mb-1">{photo.caption}</p>
                      )}
                      <div className="flex items-center justify-between text-ds-tiny opacity-90">
                        <span>
                          {new Date(photo.created_at).toLocaleDateString()}
                        </span>
                        {photo.is_public && (
                          <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-ds-sm text-ds-tiny">{t.public || 'Public'}</span>
                        )}
                      </div>
                      {photo.classes && (
                        <p className="text-ds-tiny opacity-75 mt-0.5 sm:mt-1 truncate">
                          {photo.classes.name}
                        </p>
                      )}
                      {photo.students && (
                        <p className="text-ds-tiny opacity-75 mt-0.5 sm:mt-1 truncate">
                          {photo.students.first_name} {photo.students.last_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleUploadSuccess}
        classes={classes}
        students={students}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPhotoToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t.delete_photo || 'Delete Photo'}
        message={t.delete_photo_confirm || 'Are you sure you want to delete this photo? This action cannot be undone.'}
        loading={isDeleting}
        error={deleteError}
      />
    </TeacherPageLayout>
  );
}
