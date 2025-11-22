'use client';

import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useTeacherOrgId } from '@/lib/hooks/useTeacherOrgId';
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
  const { orgId: finalOrgId } = useTeacherOrgId();

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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              {t.announcements_title}
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Plus className="h-4 w-4" />
              {t.create_announcement}
            </button>
          </div>
          <AnnouncementList
            teacherClassIds={teacherClassIds}
            orgId={finalOrgId}
            lang={lang}
          />
        </div>
      </div>

      {/* Announcement Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowForm(false)}>
          <div 
            className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t.create_announcement}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <AnnouncementForm
                classId={classId}
                orgId={finalOrgId}
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

