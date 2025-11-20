'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';
import { useRouter } from 'next/navigation';
import { SquareCheck as CheckSquare, Baby, MessageSquare, Camera, Timer, Users, Plus, Send, Paperclip, Bell, X, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link as LinkIcon, Mail, Utensils, Menu } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';
import TeacherPageLayout, { useTeacherPageLayout } from '@/app/components/shared/TeacherPageLayout';

type Lang = 'is' | 'en';
type TileId = 'attendance' | 'diapers' | 'messages' | 'media' | 'stories' | 'announcements' | 'students' | 'guardians' | 'link_student' | 'menus';

// Small helpers
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

// Diapers Page Header Component
function DiapersPageHeader({ title }: { title: string }) {
  const { sidebarRef } = useTeacherPageLayout();
  
  return (
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <ProfileSwitcher />
      </div>
    </div>
  );
}

export default function TeacherDiapersPage() {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const router = useRouter();

  return (
    <TeacherPageLayout>
      {/* Content Header */}
      <DiapersPageHeader title={t.di_title} />
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{t.di_hint}</p>
      {/* Diapers Panel */}
      <section>
        <DiaperPanel t={t} />
      </section>
    </TeacherPageLayout>
  );
}

/* -------------------- Diapers Panel -------------------- */

function DiaperPanel({ t }: { t: typeof enText | typeof isText }) {
  const [child, setChild] = useState('');
  const [kind, setKind] = useState<'wet' | 'dirty' | 'mixed'>('wet');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    // mock save
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setChild('');
    setKind('wet');
    setTime('');
    setNotes('');
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
     
      <form onSubmit={save} className="grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.child}
          <input
            value={child}
            onChange={(e) => setChild(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={`${t.child} 1`}
            required
          />
        </label>
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.di_type}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="wet">{t.di_wet}</option>
            <option value="dirty">{t.di_dirty}</option>
            <option value="mixed">{t.di_mixed}</option>
          </select>
        </label>
        <label className="text-sm text-slate-700 dark:text-slate-300">
          {t.time}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            required
          />
        </label>
        <label className="text-sm md:col-span-3 text-slate-700 dark:text-slate-300">
          {t.notes}
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
            placeholder={t.di_notes_ph}
          />
        </label>
        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">
            {t.save}
          </button>
          {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">✓ {t.saved}</span>}
        </div>
      </form>
    </div>
  );
}

// Translations removed - using centralized translations from @/lib/translations

