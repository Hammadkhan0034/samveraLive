'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import AnnouncementForm from '@/app/components/AnnouncementForm';
import AnnouncementList from '@/app/components/AnnouncementList';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';

function PrincipalAnnouncementsContent() {
  const { t, lang } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();

  // State for form visibility
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title={t.announcements || 'Announcements'}
        subtitle={t.announcements_subtitle || 'View and manage school announcements'}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 px-3 sm:px-4 py-1.5 sm:py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 active:bg-mint-700 dark:active:bg-slate-500"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{t.create_announcement}</span>
            <span className="sm:hidden">{t.create || 'Create'}</span>
          </button>
        }
      />

      {/* Announcements Panel */}
      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <AnnouncementList
            userRole="principal"
            lang={lang}
          />
        </div>
      </div>

      {/* Announcement Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-xl rounded-ds-lg bg-white dark:bg-slate-800 shadow-ds-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-ds-lg">
              <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
                {t.create_announcement}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:bg-mint-200 dark:active:bg-slate-600 transition-colors"
                aria-label="Close form"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-ds-md">
              <AnnouncementForm
                classId={undefined}
                showClassSelector={true}
                onSuccess={() => {
                  // Trigger refresh event instead of reload
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('announcements-refresh'));
                  }
                  // Hide form after successful submission
                  setShowForm(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PrincipalAnnouncementsPage() {
  return (
    <PrincipalPageLayout>
      <PrincipalAnnouncementsContent />
    </PrincipalPageLayout>
  );
}
