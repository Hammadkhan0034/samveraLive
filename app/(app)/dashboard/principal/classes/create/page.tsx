'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import Loading from '@/app/components/shared/Loading';
import { ClassFormModal, type ClassData } from '@/app/components/shared/ClassFormModal';

function CreateClassPageContent() {
  const { user, loading } = useAuth?.() || ({} as any);
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get('id');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialClassData, setInitialClassData] = useState<ClassData | null>(null);
  const [loadingClassData, setLoadingClassData] = useState(false);

  // Load class data when editing
  useEffect(() => {
    async function loadClassData() {
    if (!classId) return;

    try {
      setLoadingClassData(true);

      // Fetch all classes and find the one with matching ID
      const response = await fetch(`/api/classes?t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load class data');
      }

      const classData = data.classes?.find((cls: any) => cls.id === classId);

      if (classData) {
        setInitialClassData({
          id: classData.id,
          name: classData.name || '',
          code: classData.code || '',
          assigned_teachers: classData.assigned_teachers || [],
        });
        setIsModalOpen(true);
      } else {
        // Class not found, redirect back
        router.push('/dashboard/principal/classes');
      }
    } catch (err: any) {
      console.error('❌ Error loading class data:', err);
      // On error, redirect back
      router.push('/dashboard/principal/classes');
    } finally {
      setLoadingClassData(false);
    }
    }

    if (classId) {
      loadClassData();
    } else {
      // For create mode, open modal immediately
      setIsModalOpen(true);
    }
  }, [classId, router]);

  const handleClose = () => {
    setIsModalOpen(false);
    router.push('/dashboard/principal/classes');
  };

  const handleSuccess = () => {
    // Modal will close itself, but we also want to ensure navigation
    // The modal already handles the refresh events
  };

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

  if (loadingClassData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading class data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ClassFormModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        initialData={initialClassData}
      />
    </>
  );
}

// Translations removed - using centralized translations from @/lib/translations

export default function CreateClassPage() {
  return (
    <PrincipalPageLayout>
      <Suspense fallback={<Loading fullScreen variant="sand" />}>
        <CreateClassPageContent />
      </Suspense>
    </PrincipalPageLayout>
  );
}
