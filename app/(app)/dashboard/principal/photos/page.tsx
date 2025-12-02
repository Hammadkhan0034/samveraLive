'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Plus, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { PhotoUploadModal } from '@/app/components/shared/PhotoUploadModal';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import type { Student } from '@/lib/types/attendance';

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

function PrincipalPhotosPageContent() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();
  const { sidebarRef } = usePrincipalPageLayout();

  // State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Classes and students for PhotoUploadModal
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Fetch classes
  const fetchClasses = async () => {

    try {
      setLoadingClasses(true);
      const response = await fetch(`/api/classes?t=${Date.now()}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (response.ok && data.classes) {
        setClasses(data.classes.map((cls: any) => ({ id: cls.id, name: cls.name })));
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Fetch students
  const fetchStudents = async () => {

    try {
      setLoadingStudents(true);
      const response = await fetch(`/api/students?t=${Date.now()}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (response.ok && data.students) {
        // Transform students to match Student type expected by PhotoUploadModal
        const transformedStudents: Student[] = data.students.map((s: any) => ({
          id: s.id,
          user_id: s.user_id || s.users?.id || null,
          class_id: s.class_id,
          first_name: s.first_name || s.users?.first_name || '',
          last_name: s.last_name || s.users?.last_name || null,
          dob: s.dob || null,
          gender: s.gender || 'unknown',
          created_at: s.created_at || new Date().toISOString(),
          updated_at: s.updated_at || null,
          users: s.users ? {
            id: s.users.id,
            first_name: s.users.first_name || '',
            last_name: s.users.last_name || null,
            dob: s.users.dob || null,
            gender: s.users.gender || 'unknown',
            phone: s.users.phone || null,
            address: s.users.address || null,
            ssn: s.users.ssn || null,
          } : undefined,
          classes: s.classes ? {
            id: s.classes.id,
            name: s.classes.name || '',
          } : undefined,
        }));
        setStudents(transformedStudents);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Fetch photos
  const fetchPhotos = async () => {

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/photos?limit=100`, {
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

  // Fetch data on mount
  useEffect(() => {
    fetchPhotos();
    fetchClasses();
    fetchStudents();
  }, []);

  // Handle successful upload
  const handleUploadSuccess = () => {
    fetchPhotos();
    // Update photos count in dashboard
    if (typeof window !== 'undefined' && session?.user?.id) {
      window.dispatchEvent(new Event('photos-refresh'));
    }
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
      
      // Update photos count in dashboard
      if (typeof window !== 'undefined' && session?.user?.id) {
        window.dispatchEvent(new Event('photos-refresh'));
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete photo');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Content Header */}
      <div className="mb-ds-sm flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-ds-sm">
          {/* Mobile menu button */}
          <button
            onClick={() => sidebarRef.current?.open()}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-ds-h1 font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.photos || 'Photos'}
          </h2>
        </div>

        <div className="flex items-center gap-ds-sm">
          <ProfileSwitcher />
          <button
            onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Plus className="h-4 w-4" />
              {t.upload_photo || 'Upload Photo'}
            </button>
        </div>
      </div>

        {/* Photos Panel */}
        <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
          {/* Error State */}
          {error && (
            <div className="mb-4 rounded-ds-md bg-red-50 border border-red-200 px-4 py-3 text-ds-small text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-ds-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-ds-md overflow-hidden bg-mint-100 dark:bg-slate-700 animate-pulse"
                />
              ))}
            </div>
          ) : (
            /* Photos Grid */
            <div className="grid grid-cols-1 gap-ds-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {photos.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 text-mint-300 dark:text-slate-600" />
                  <p>{t.no_photos_uploaded || 'No photos uploaded yet'}</p>
                  <p className="text-ds-small mt-1">{t.click_upload_photo || 'Click "Upload Photo" to get started'}</p>
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
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-ds-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title={t.delete_photo || 'Delete Photo'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {/* Overlay with info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-ds-small">
                        {photo.caption && (
                          <p className="truncate font-medium mb-1">{photo.caption}</p>
                        )}
                        <div className="flex items-center justify-between text-ds-tiny opacity-90">
                          <span>
                            {new Date(photo.created_at).toLocaleDateString()}
                          </span>
                          {photo.is_public && (
                            <span className="px-2 py-0.5 bg-white/20 rounded-ds-sm">{t.public || 'Public'}</span>
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
    </>
  );
}

export default function PrincipalPhotosPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalPhotosPageContent />
    </PrincipalPageLayout>
  );
}

