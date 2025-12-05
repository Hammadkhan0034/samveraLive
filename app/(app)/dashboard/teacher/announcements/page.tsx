'use client';

import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import AnnouncementForm from '@/app/components/AnnouncementForm';
import AnnouncementList from '@/app/components/AnnouncementList';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';

interface TeacherClass {
  id: string;
  [key: string]: unknown;
}

export default function TeacherAnnouncementsPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();

  // Teacher classes
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);

  // Load teacher classes
  useEffect(() => {
    async function loadTeacherClasses() {
      if (!session?.user?.id) return;
      try {
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
      }
    }
    loadTeacherClasses();
  }, [session?.user?.id]);

  // Get classId from session metadata
  const classId = (session?.user?.user_metadata as { class_id?: string })?.class_id;

  // Get all teacher class IDs for filtering announcements
  const teacherClassIds = teacherClasses.length > 0
    ? teacherClasses.map(c => c.id).filter(Boolean)
    : (classId ? [classId] : []);

  // State for form visibility
  const [showForm, setShowForm] = useState(false);

  return (
    <TeacherPageLayout>
      {/* Announcements Panel */}
      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-ds-lg border border-slate-200 bg-white p-3 sm:p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            <h2 className="text-ds-small sm:text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
              {t.announcements_title}
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 px-3 sm:px-4 py-1.5 sm:py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 active:bg-mint-700 dark:active:bg-slate-500"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{t.create_announcement}</span>
              <span className="sm:hidden">{t.create || 'Create'}</span>
            </button>
          </div>
          <AnnouncementList
            teacherClassIds={teacherClassIds}
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
                classId={classId}
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
    </TeacherPageLayout>
  );
}

