'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Plus, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
import { useTeacherClasses } from '@/lib/hooks/useTeacherClasses';
import { useTeacherStudents } from '@/lib/hooks/useTeacherStudents';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import { PhotoUploadModal } from '@/app/components/shared/PhotoUploadModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';

type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

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
  const { session } = useAuth();
  const router = useRouter();

  // Get org, classes, and students
  const { orgId } = useTeacherOrgId();
  const { classes } = useTeacherClasses();
  const { students } = useTeacherStudents(classes, orgId);

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
    if (!orgId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/photos?orgId=${orgId}&limit=100`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to fetch photos');
      }

      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch photos on mount and when orgId changes
  useEffect(() => {
    if (orgId) {
      fetchPhotos();
    }
  }, [orgId]);

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

  const userId = session?.user?.id || '';

  return (
    <TeacherPageLayout mediaBadge={photos.length > 0 ? photos.length : undefined}>
      {/* Media Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            {t.media_title || 'Media'}
          </h2>
          {orgId && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              <Plus className="h-4 w-4" />
              {(t as any).upload_photo || t.upload || 'Upload Photo'}
            </button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 animate-pulse"
              />
            ))}
          </div>
        ) : (
          /* Photos Grid */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p>{t.no_photos_uploaded || 'No photos uploaded yet'}</p>
                <p className="text-sm mt-1">{t.click_upload_photo || 'Click "Upload Photo" to get started'}</p>
              </div>
            ) : (
              photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700"
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
                  
                  {/* Delete button - top right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(photo);
                    }}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title={t.delete_photo || 'Delete Photo'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  
                  {/* Overlay with info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-sm">
                      {photo.caption && (
                        <p className="truncate font-medium mb-1">{photo.caption}</p>
                      )}
                      <div className="flex items-center justify-between text-xs opacity-90">
                        <span>
                          {new Date(photo.created_at).toLocaleDateString()}
                        </span>
                        {photo.is_public && (
                          <span className="px-2 py-0.5 bg-white/20 rounded">{t.public || 'Public'}</span>
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
              ))
            )}
          </div>
        )}
      </div>

      {/* Photo Upload Modal */}
      {orgId && (
        <PhotoUploadModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleUploadSuccess}
          orgId={orgId}
          classes={classes}
          students={students}
          userId={userId}
        />
      )}

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
