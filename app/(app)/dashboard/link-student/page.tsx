'use client';

import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import LinkStudentGuardian from '../../../components/LinkStudentGuardian';
import { useRequireAuth } from '../../../../lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import TeacherLayout from '@/app/components/shared/TeacherLayout';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import Loading from '@/app/components/shared/Loading';

export default function LinkStudentPage() {
  const { user, loading, isSigningIn, session } = useRequireAuth(['teacher', 'principal']);
  const { t, lang } = useLanguage();
  const router = useRouter();

  // Only show loading if we're actually loading and don't have a user yet
  if (loading && !user && isSigningIn) {
    return <Loading fullScreen text="Loading link student page..." />;
  }

  if (!user) return null;

  // Check if user is a teacher or principal
  const userMetadata = user.user_metadata || session?.user?.user_metadata;
  const role = (userMetadata?.role || userMetadata?.user_role || userMetadata?.app_role || userMetadata?.activeRole || '').toString().toLowerCase();
  const isTeacher = role === 'teacher' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('teacher'));
  const isPrincipal = role === 'principal' || (userMetadata?.roles && Array.isArray(userMetadata.roles) && userMetadata.roles.includes('principal'));

  // Content for teacher layout (with gradient background and back button)
  const teacherContent = (
    <div className="h-full bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-10 md:px-6 mt-14">
        {/* Header with Back button */}
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.tile_link_student || 'Link Student'}
          </h1>
        </div>
        <LinkStudentGuardian lang={lang} />
      </div>
    </div>
  );

  // Content for principal layout (matching students/guardians page structure)
  function PrincipalLinkStudentContent() {
    const { sidebarRef } = usePrincipalPageLayout();

    return (
      <>
        {/* Content Header */}
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => sidebarRef.current?.open()}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {t.tile_link_student || 'Link Student'}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t.tile_link_student_desc || 'Link a guardian to a student'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ProfileSwitcher />
          </div>
        </div>

        {/* Link Student Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <LinkStudentGuardian lang={lang} />
        </div>
      </>
    );
  }

  // Wrap with appropriate layout based on user role
  if (isTeacher) {
    return <TeacherLayout hideHeader={true}>{teacherContent}</TeacherLayout>;
  }

  if (isPrincipal) {
    return (
      <PrincipalPageLayout>
        <PrincipalLinkStudentContent />
      </PrincipalPageLayout>
    );
  }

  // Fallback for other roles (return teacher content without layout)
  return teacherContent;
}


