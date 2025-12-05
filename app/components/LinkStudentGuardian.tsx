'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Link as LinkIcon, X, Check, UserSearch, GraduationCap } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import EmptyState from './EmptyState';

type Lang = 'en' | 'is';

type PersonResult = {
  id: string;
  label: string;
  email: string;
  role: 'guardian' | 'student';
  guardian_id: string | null;
  student_id: string | null;
  student_user_id?: string | null;
};

const TEXTS = {
  en: {
    title: 'Link Guardian to Student',
    guardianSearchLabel: 'Find Guardian',
    studentSearchLabel: 'Find Student',
    emailTab: 'Email',
    nameTab: 'Name',
    placeholderEmail: 'Search by email…',
    placeholderName: 'Search by name…',
    selectGuardian: 'Select a guardian',
    selectStudent: 'Select a student',
    selected: 'Selected',
    linkButton: 'Link Guardian ↔ Student',
    confirmTitle: 'Confirm Link',
    confirmText: 'Are you sure you want to link this guardian and student?',
    yes: 'Yes, Link',
    no: 'Cancel',
    roleGuardian: 'Guardian',
    roleStudent: 'Student',
    success: 'Linked successfully',
    error: 'Failed to link, please try again',
    emptyStateGuardian: 'Search for a guardian by email or name',
    emptyStateGuardianTitle: 'Find Guardian',
    emptyStateGuardianDescription: 'Search by email or name to find a guardian',
    emptyStateStudent: 'Search for a student by email or name',
    emptyStateStudentTitle: 'Find Student',
    emptyStateStudentDescription: 'Search by email or name to find a student',
  },
  is: {
    title: 'Tengja forráðamann við nemanda',
    guardianSearchLabel: 'Finna forráðamann',
    studentSearchLabel: 'Finna nemanda',
    emailTab: 'Tölvupóstur',
    nameTab: 'Nafn',
    placeholderEmail: 'Leita eftir tölvupósti…',
    placeholderName: 'Leita eftir nafni…',
    selectGuardian: 'Veldu forráðamann',
    selectStudent: 'Veldu nemanda',
    selected: 'Valið',
    linkButton: 'Tengja forráðamann ↔ nemanda',
    confirmTitle: 'Staðfesta tengingu',
    confirmText: 'Viltu staðfesta að tengja forráðamann og nemanda?',
    yes: 'Já, tengja',
    no: 'Hætta við',
    roleGuardian: 'Forráðamaður',
    roleStudent: 'Nemandi',
    success: 'Tengingu lokið',
    error: 'Tókst ekki að tengja, reyndu aftur',
    emptyStateGuardian: 'Leitaðu að forráðamanni eftir tölvupósti eða nafni',
    emptyStateGuardianTitle: 'Finna forráðamann',
    emptyStateGuardianDescription: 'Leitaðu eftir tölvupósti eða nafni til að finna forráðamann',
    emptyStateStudent: 'Leitaðu að nemanda eftir tölvupósti eða nafni',
    emptyStateStudentTitle: 'Finna nemanda',
    emptyStateStudentDescription: 'Leitaðu eftir tölvupósti eða nafni til að finna nemanda',
  },
} as const;

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function LinkStudentGuardian({ lang = 'en' }: { lang?: Lang }) {
  const { user } = useAuth();
  const t = useMemo(() => TEXTS[lang] || TEXTS.en, [lang]);

  const [modeGuardian, setModeGuardian] = useState<'email' | 'name'>('any' as any);
  const [modeStudent, setModeStudent] = useState<'email' | 'name'>('any' as any);
  const [qGuardian, setQGuardian] = useState('');
  const [qStudent, setQStudent] = useState('');
  const dqGuardian = useDebounced(qGuardian, 250);
  const dqStudent = useDebounced(qStudent, 250);

  const [guardianResults, setGuardianResults] = useState<PersonResult[]>([]);
  const [studentResults, setStudentResults] = useState<PersonResult[]>([]);
  const [loadingGuardian, setLoadingGuardian] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);

  const [selectedGuardian, setSelectedGuardian] = useState<PersonResult | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<PersonResult | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!dqGuardian) {
        setGuardianResults([]);
        return;
      }
      setLoadingGuardian(true);
      try {
        const params = new URLSearchParams({ q: dqGuardian, role: 'guardian', mode: (modeGuardian || 'any') as any, limit: '10' });
        const res = await fetch(`/api/search-people?${params.toString()}`);
        const json = await res.json();
        if (!ignore) setGuardianResults(json.results || []);
      } catch {
        if (!ignore) setGuardianResults([]);
      } finally {
        if (!ignore) setLoadingGuardian(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [dqGuardian, modeGuardian]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!dqStudent) {
        setStudentResults([]);
        return;
      }
      setLoadingStudent(true);
      try {
        const params = new URLSearchParams({ q: dqStudent, role: 'student', mode: (modeStudent || 'any') as any, limit: '10' });
        const res = await fetch(`/api/search-people?${params.toString()}`);
        const json = await res.json();
        if (!ignore) setStudentResults(json.results || []);
      } catch {
        if (!ignore) setStudentResults([]);
      } finally {
        if (!ignore) setLoadingStudent(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [dqStudent, modeStudent]);

  async function onConfirmLink() {
    if (!selectedGuardian?.guardian_id || !selectedStudent?.student_id) return;
    setLinking(true);
    setMessage(null);
    try {
      const res = await fetch('/api/guardian-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardian_id: selectedGuardian.guardian_id, student_id: selectedStudent.student_id }),
      });
      if (!res.ok) throw new Error(await res.text());
      
      setMessage(t.success);
      setConfirmOpen(false);
      // Reset both sides after successful link
      setSelectedGuardian(null);
      setSelectedStudent(null);
      setQGuardian('');
      setQStudent('');
      setGuardianResults([]);
      setStudentResults([]);
    } catch {
      setMessage(t.error);
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="rounded-ds-lg p-0 sm:p-2 dark:border-slate-700 dark:bg-slate-800 pb-8 sm:pb-12">
      
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-ds-small font-medium text-slate-700 dark:text-slate-300">{t.guardianSearchLabel}</label>
          <div className="mb-2 flex gap-2">
            <button className={`px-2 sm:px-3 py-1 rounded-ds-md text-ds-tiny sm:text-ds-small border transition-colors ${modeGuardian === 'email' ? 'bg-mint-500 text-white border-mint-500' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-mint-50 dark:hover:bg-slate-600'}`} onClick={() => setModeGuardian('email')}>{t.emailTab}</button>
            <button className={`px-2 sm:px-3 py-1 rounded-ds-md text-ds-tiny sm:text-ds-small border transition-colors ${modeGuardian === 'name' ? 'bg-mint-500 text-white border-mint-500' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-mint-50 dark:hover:bg-slate-600'}`} onClick={() => setModeGuardian('name')}>{t.nameTab}</button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={qGuardian}
              onChange={(e) => setQGuardian(e.target.value)}
              placeholder={modeGuardian === 'email' ? t.placeholderEmail : t.placeholderName}
              className="w-full rounded-ds-md border border-input-stroke bg-input-fill py-2 pl-8 sm:pl-9 pr-3 text-ds-small text-slate-900 placeholder:text-slate-400 focus:border-mint-200 focus:outline-none focus:ring-2 focus:ring-mint-200/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-mint-300"
            />
          </div>
          {!qGuardian && (
            <div>
              <EmptyState 
                lang={lang} 
                icon={UserSearch}
                title={t.emptyStateGuardianTitle}
                description={t.emptyStateGuardianDescription}
              />
            </div>
          )}
          {qGuardian && (
            <div className="mt-2 max-h-48 sm:max-h-56 overflow-auto rounded-ds-md border border-slate-200 dark:border-slate-700">
              {loadingGuardian && <div className="p-2 sm:p-3 text-ds-small text-slate-500">Loading…</div>}
              {!loadingGuardian && guardianResults.length === 0 && (
                <div className="p-2 sm:p-3 text-ds-small text-slate-500">No results</div>
              )}
              {!loadingGuardian && guardianResults.map((r) => (
                <button
                  key={`${r.role}-${r.id}`}
                  className={`flex w-full items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 text-left text-ds-small hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 ${selectedGuardian?.id === r.id ? 'bg-slate-50 dark:bg-slate-700' : ''}`}
                  onClick={() => setSelectedGuardian(r)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.label}</div>
                    <div className="text-ds-tiny text-slate-500 truncate">{r.email}</div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-1.5 sm:px-2 py-0.5 text-ds-tiny font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 flex-shrink-0">{t.roleGuardian}</span>
                </button>
              ))}
            </div>
          )}
          {selectedGuardian && (
            <div className="mt-2 flex items-center gap-2 text-ds-small text-slate-700 dark:text-slate-200 flex-wrap">
              <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span className="flex-shrink-0">{t.selected}:</span>
              <span className="font-medium truncate flex-1 min-w-0">{selectedGuardian.label}</span>
              <button className="ml-auto text-slate-500 hover:text-slate-700 active:text-slate-900 flex-shrink-0" onClick={() => setSelectedGuardian(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-ds-small font-medium text-slate-700 dark:text-slate-300">{t.studentSearchLabel}</label>
          <div className="mb-2 flex gap-2">
            <button className={`px-2 sm:px-3 py-1 rounded-ds-md text-ds-tiny sm:text-ds-small border transition-colors ${modeStudent === 'email' ? 'bg-mint-500 text-white border-mint-500' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-mint-50 dark:hover:bg-slate-600'}`} onClick={() => setModeStudent('email')}>{t.emailTab}</button>
            <button className={`px-2 sm:px-3 py-1 rounded-ds-md text-ds-tiny sm:text-ds-small border transition-colors ${modeStudent === 'name' ? 'bg-mint-500 text-white border-mint-500' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-mint-50 dark:hover:bg-slate-600'}`} onClick={() => setModeStudent('name')}>{t.nameTab}</button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={qStudent}
              onChange={(e) => setQStudent(e.target.value)}
              placeholder={modeStudent === 'email' ? t.placeholderEmail : t.placeholderName}
              className="w-full rounded-ds-md border border-input-stroke bg-input-fill py-2 pl-8 sm:pl-9 pr-3 text-ds-small text-slate-900 placeholder:text-slate-400 focus:border-mint-200 focus:outline-none focus:ring-2 focus:ring-mint-200/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-mint-300"
            />
          </div>
          {!qStudent && (
            <div>
              <EmptyState 
                lang={lang} 
                icon={GraduationCap}
                title={t.emptyStateStudentTitle}
                description={t.emptyStateStudentDescription}
              />
            </div>
          )}
          {qStudent && (
            <div className="mt-2 max-h-48 sm:max-h-56 overflow-auto rounded-ds-md border border-slate-200 dark:border-slate-700">
              {loadingStudent && <div className="p-2 sm:p-3 text-ds-small text-slate-500">Loading…</div>}
              {!loadingStudent && studentResults.length === 0 && (
                <div className="p-2 sm:p-3 text-ds-small text-slate-500">No results</div>
              )}
              {!loadingStudent && studentResults.map((r) => (
                <button
                  key={`${r.role}-${r.id}`}
                  className={`flex w-full items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 text-left text-ds-small hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 ${selectedStudent?.id === r.id ? 'bg-slate-50 dark:bg-slate-700' : ''}`}
                  onClick={() => setSelectedStudent(r)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.label}</div>
                    <div className="text-ds-tiny text-slate-500 truncate">{r.email}</div>
                  </div>
                  <span className="rounded-full bg-sky-100 px-1.5 sm:px-2 py-0.5 text-ds-tiny font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-200 flex-shrink-0">{t.roleStudent}</span>
                </button>
              ))}
            </div>
          )}
          {selectedStudent && (
            <div className="mt-2 flex items-center gap-2 text-ds-small text-slate-700 dark:text-slate-200 flex-wrap">
              <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span className="flex-shrink-0">{t.selected}:</span>
              <span className="font-medium truncate flex-1 min-w-0">{selectedStudent.label}</span>
              <button className="ml-auto text-slate-500 hover:text-slate-700 active:text-slate-900 flex-shrink-0" onClick={() => setSelectedStudent(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <button
          disabled={!selectedGuardian || !selectedStudent}
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-ds-md bg-mint-500 px-3 sm:px-4 py-2 text-ds-small font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400 hover:bg-mint-600 transition-colors"
        >
          <LinkIcon className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">{t.linkButton}</span>
          <span className="sm:hidden">{lang === 'is' ? 'Tengja' : 'Link'}</span>
        </button>
        {message && <span className="text-ds-small text-slate-600 dark:text-slate-300 text-center sm:text-left">{message}</span>}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-ds-lg border border-slate-200 bg-white p-4 sm:p-ds-md shadow-ds-lg dark:border-slate-700 dark:bg-slate-800">
            <h4 className="text-ds-h3 sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.confirmTitle}</h4>
            <p className="mt-2 text-ds-small text-slate-600 dark:text-slate-300">{t.confirmText}</p>
            <div className="mt-4 rounded-ds-md border border-slate-200 p-2 sm:p-3 text-ds-small dark:border-slate-700">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="font-medium flex-shrink-0">{t.roleGuardian}:</span>
                <span className="text-right sm:text-left truncate">{selectedGuardian?.label} ({selectedGuardian?.email})</span>
              </div>
              <div className="mt-2 flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="font-medium flex-shrink-0">{t.roleStudent}:</span>
                <span className="text-right sm:text-left truncate">{selectedStudent?.label} ({selectedStudent?.email})</span>
              </div>
            </div>
            <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <button
                disabled={linking}
                className="rounded-ds-md border border-slate-300 dark:border-slate-600 px-3 sm:px-4 py-2 text-ds-small text-slate-700 hover:bg-mint-50 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => setConfirmOpen(false)}
              >
                {t.no}
              </button>
              <button
                disabled={linking}
                className="inline-flex items-center justify-center gap-2 rounded-ds-md bg-mint-500 px-3 sm:px-4 py-2 text-ds-small font-medium text-white hover:bg-mint-600 disabled:opacity-60 transition-colors"
                onClick={onConfirmLink}
                aria-busy={linking}
              >
                {linking ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Linking…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 flex-shrink-0" />
                    {t.yes}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


