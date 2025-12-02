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
      <div className="space-y-6">
        <div className="rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-ds-h3 font-medium text-slate-900 dark:text-slate-100">
              {t.announcements_title}
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-4 py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Plus className="h-4 w-4" />
              {t.create_announcement}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-xl rounded-ds-lg bg-white dark:bg-slate-800 shadow-ds-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-ds-lg">
              <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
                {t.create_announcement}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-ds-md p-1 hover:bg-mint-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-ds-md">
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

