'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useRequireAuth } from '@/lib/hooks/useAuth';
import { ArrowLeft, Users } from 'lucide-react';
import TeacherSelection from '@/app/components/TeacherSelection';

type Lang = 'is' | 'en';

function CreateClassPageContent() {
  const { t, lang } = useLanguage();
  const { user, loading } = useRequireAuth('principal');
  const { session } = useAuth?.() || {} as any;
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get('id');
  const isEditMode = !!classId;

  // Try to get org_id from multiple possible locations
  const userMetadata = session?.user?.user_metadata || user?.user_metadata;
  const orgId = userMetadata?.org_id || userMetadata?.organization_id || userMetadata?.orgId;
  
  // If no org_id in metadata, we need to get it from the database
  const [dbOrgId, setDbOrgId] = useState<string | null>(null);
  
  // Fetch org_id from database if not in metadata
  useEffect(() => {
    if ((session?.user?.id || user?.id) && !orgId) {
      const fetchUserOrgId = async () => {
        try {
          const userId = session?.user?.id || user?.id;
          const response = await fetch(`/api/user-org-id?user_id=${userId}`);
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
  }, [session?.user?.id, user?.id, orgId]);
  
  // Fallback to default org ID if not found in metadata
  const finalOrgId = orgId || dbOrgId || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID;

  // Form state
  const [newClass, setNewClass] = useState({ name: '', description: '', capacity: '', org_id: '' });
  const [loadingClass, setLoadingClass] = useState(false);
  const [loadingClassData, setLoadingClassData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTeacherIdsRef = useRef<string[]>([]);
  const [initialTeacherIds, setInitialTeacherIds] = useState<string[]>([]);

  // Initialize org_id in form when available
  useEffect(() => {
    if (finalOrgId) {
      setNewClass(prev => ({ ...prev, org_id: finalOrgId || '' }));
    }
  }, [finalOrgId]);

  // Load class data when editing
  useEffect(() => {
    if (classId && finalOrgId) {
      loadClassData();
    }
  }, [classId, finalOrgId]);

  async function loadClassData() {
    if (!classId || !finalOrgId) return;
    
    try {
      setLoadingClassData(true);
      setError(null);
      
      // Fetch all classes and find the one with matching ID
      const response = await fetch(`/api/classes?orgId=${finalOrgId}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load class data');
      }
      
      const classData = data.classes?.find((cls: any) => cls.id === classId);
      
      if (classData) {
        setNewClass({
          name: classData.name || '',
          description: classData.code || '',
          capacity: '',
          org_id: classData.org_id || finalOrgId || ''
        });
        
        // Set selected teachers
        if (classData.assigned_teachers && Array.isArray(classData.assigned_teachers)) {
          const teacherIds = classData.assigned_teachers.map((teacher: any) => teacher.id || teacher.user_id).filter(Boolean);
          selectedTeacherIdsRef.current = teacherIds;
          setInitialTeacherIds(teacherIds);
        }
      } else {
        setError('Class not found');
      }
    } catch (err: any) {
      console.error('❌ Error loading class data:', err);
      setError(err.message || 'Failed to load class data');
    } finally {
      setLoadingClassData(false);
    }
  }

  // Show loading ONLY if we have no user yet
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!newClass.name.trim()) {
      setError('Class name is required');
      return;
    }

    if (!session?.user?.id) {
      setError('User session not found. Please log in again.');
      return;
    }

    try {
      setLoadingClass(true);

      const userId = session.user.id;

      if (isEditMode && classId) {
        // Update existing class
        const response = await fetch('/api/classes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: classId,
            name: newClass.name,
            code: newClass.description || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update class');
        }

        // Handle teacher assignments for edit mode
        // Note: This is a simplified approach. You may want to update teacher assignments separately
        if (selectedTeacherIdsRef.current.length > 0 && classId) {
          const assignmentPromises = selectedTeacherIdsRef.current.map(async (teacherId) => {
            try {
              const assignResponse = await fetch('/api/assign-teacher-class', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: teacherId,
                  classId: classId,
                }),
              });

              if (!assignResponse.ok) {
                const assignData = await assignResponse.json();
                console.warn(`Failed to assign teacher ${teacherId} to class:`, assignData.error);
              }
            } catch (err) {
              console.error(`Error assigning teacher ${teacherId} to class:`, err);
            }
          });

          await Promise.allSettled(assignmentPromises);
        }

        // Trigger refresh
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('classes_data_updated', 'true');
            window.dispatchEvent(new Event('classes-refresh'));
          }
        } catch {}

        // Redirect back to classes list
        router.push('/dashboard/principal/classes?updated=true&name=' + encodeURIComponent(newClass.name));
      } else {
        // Create new class
        const response = await fetch('/api/classes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newClass.name,
            code: newClass.description || null,
            created_by: userId,
            org_id: newClass.org_id || finalOrgId
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create class');
        }

        const createdClassId = data.class?.id;
        if (!createdClassId) {
          throw new Error('Class created but no class ID returned');
        }

        // Assign selected teachers to the class
        if (selectedTeacherIdsRef.current.length > 0 && createdClassId) {
          const assignmentPromises = selectedTeacherIdsRef.current.map(async (teacherId) => {
            try {
              const assignResponse = await fetch('/api/assign-teacher-class', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: teacherId,
                  classId: createdClassId,
                }),
              });

              if (!assignResponse.ok) {
                const assignData = await assignResponse.json();
                console.warn(`Failed to assign teacher ${teacherId} to class:`, assignData.error);
              }
            } catch (err) {
              console.error(`Error assigning teacher ${teacherId} to class:`, err);
            }
          });

          await Promise.allSettled(assignmentPromises);
        }

        // Trigger refresh
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('classes_data_updated', 'true');
            window.dispatchEvent(new Event('classes-refresh'));
          }
        } catch {}

        // Redirect back to classes list
        router.push('/dashboard/principal/classes?created=true&name=' + encodeURIComponent(newClass.name));
      }
    } catch (error: any) {
      setError(error.message || `An error occurred while ${isEditMode ? 'updating' : 'creating'} the class`);
    } finally {
      setLoadingClass(false);
    }
  }

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
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {isEditMode ? t.edit_class : t.add_class}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {isEditMode ? t.edit_class_subtitle : t.create_class_subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading banner removed per requirements */}

        {/* Create/Edit Class Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <form onSubmit={handleAddClass} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.class_name}
              </label>
              <input
                type="text"
                value={newClass.name}
                onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t.class_name_placeholder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.class_description}
              </label>
              <textarea
                value={newClass.description}
                onChange={(e) => setNewClass(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t.class_description_placeholder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.class_capacity}
              </label>
              <input
                type="number"
                value={newClass.capacity}
                onChange={(e) => setNewClass(prev => ({ ...prev, capacity: e.target.value }))}
                placeholder={t.class_capacity_placeholder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                min="1"
              />
            </div>

            {finalOrgId && !isEditMode && (
              <div>
                <TeacherSelection
                  orgId={finalOrgId}
                  onSelectionChange={(ids) => { selectedTeacherIdsRef.current = ids; }}
                  lang={lang}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard/principal/classes')}
                disabled={loadingClass}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={loadingClass}
                className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 dark:bg-black"
              >
                {loadingClass ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEditMode ? t.updating : t.creating}
                  </>
                ) : (
                  isEditMode ? t.update_class : t.create_class
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

export default function CreateClassPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <CreateClassPageContent />
    </Suspense>
  );
}
