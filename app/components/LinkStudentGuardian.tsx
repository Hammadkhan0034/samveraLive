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
  const orgIdFromMeta = (user?.user_metadata as any)?.org_id as string | undefined;
  const [resolvedOrgId, setResolvedOrgId] = useState<string | undefined>(orgIdFromMeta || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID);

  // Fallback: fetch org_id for current user if not in metadata
  useEffect(() => {
    let ignore = false;
    async function fetchOrg() {
      if (resolvedOrgId || !user?.id) return;
      try {
        const res = await fetch(`/api/user-org-id?user_id=${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && data?.org_id) setResolvedOrgId(data.org_id);
      } catch {}
    }
    fetchOrg();
    return () => { ignore = true; };
  }, [user?.id, resolvedOrgId]);

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
      if (!resolvedOrgId || !dqGuardian) {
        setGuardianResults([]);
        return;
      }
      setLoadingGuardian(true);
      try {
        const params = new URLSearchParams({ q: dqGuardian, orgId: resolvedOrgId, role: 'guardian', mode: (modeGuardian || 'any') as any, limit: '10' });
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
  }, [dqGuardian, modeGuardian, resolvedOrgId]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!resolvedOrgId || !dqStudent) {
        setStudentResults([]);
        return;
      }
      setLoadingStudent(true);
      try {
        const params = new URLSearchParams({ q: dqStudent, orgId: resolvedOrgId, role: 'student', mode: (modeStudent || 'any') as any, limit: '10' });
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
  }, [dqStudent, modeStudent, resolvedOrgId]);

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 pb-12">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.title}</h3>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.guardianSearchLabel}</label>
          <div className="mb-2 flex gap-2">
            <button className={`px-3 py-1 rounded-md text-sm border ${modeGuardian === 'email' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`} onClick={() => setModeGuardian('email')}>{t.emailTab}</button>
            <button className={`px-3 py-1 rounded-md text-sm border ${modeGuardian === 'name' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`} onClick={() => setModeGuardian('name')}>{t.nameTab}</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={qGuardian}
              onChange={(e) => setQGuardian(e.target.value)}
              placeholder={modeGuardian === 'email' ? t.placeholderEmail : t.placeholderName}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {loadingGuardian && <div className="p-3 text-sm text-slate-500">Loading…</div>}
              {!loadingGuardian && guardianResults.length === 0 && (
                <div className="p-3 text-sm text-slate-500">No results</div>
              )}
              {!loadingGuardian && guardianResults.map((r) => (
                <button
                  key={`${r.role}-${r.id}`}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedGuardian?.id === r.id ? 'bg-slate-50 dark:bg-slate-700' : ''}`}
                  onClick={() => setSelectedGuardian(r)}
                >
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{r.label}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">{t.roleGuardian}</span>
                </button>
              ))}
            </div>
          )}
          {selectedGuardian && (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{t.selected}:</span>
              <span className="font-medium">{selectedGuardian.label}</span>
              <button className="ml-auto text-slate-500 hover:text-slate-700" onClick={() => setSelectedGuardian(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.studentSearchLabel}</label>
          <div className="mb-2 flex gap-2">
            <button className={`px-3 py-1 rounded-md text-sm border ${modeStudent === 'email' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`} onClick={() => setModeStudent('email')}>{t.emailTab}</button>
            <button className={`px-3 py-1 rounded-md text-sm border ${modeStudent === 'name' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`} onClick={() => setModeStudent('name')}>{t.nameTab}</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={qStudent}
              onChange={(e) => setQStudent(e.target.value)}
              placeholder={modeStudent === 'email' ? t.placeholderEmail : t.placeholderName}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {loadingStudent && <div className="p-3 text-sm text-slate-500">Loading…</div>}
              {!loadingStudent && studentResults.length === 0 && (
                <div className="p-3 text-sm text-slate-500">No results</div>
              )}
              {!loadingStudent && studentResults.map((r) => (
                <button
                  key={`${r.role}-${r.id}`}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedStudent?.id === r.id ? 'bg-slate-50 dark:bg-slate-700' : ''}`}
                  onClick={() => setSelectedStudent(r)}
                >
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{r.label}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </div>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">{t.roleStudent}</span>
                </button>
              ))}
            </div>
          )}
          {selectedStudent && (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{t.selected}:</span>
              <span className="font-medium">{selectedStudent.label}</span>
              <button className="ml-auto text-slate-500 hover:text-slate-700" onClick={() => setSelectedStudent(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          disabled={!selectedGuardian || !selectedStudent}
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900"
        >
          <LinkIcon className="h-4 w-4" />{t.linkButton}
        </button>
        {message && <span className="text-sm text-slate-600 dark:text-slate-300">{message}</span>}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t.confirmTitle}</h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.confirmText}</p>
            <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="flex justify-between">
                <span className="font-medium">{t.roleGuardian}:</span>
                <span>{selectedGuardian?.label} ({selectedGuardian?.email})</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="font-medium">{t.roleStudent}:</span>
                <span>{selectedStudent?.label} ({selectedStudent?.email})</span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                disabled={linking}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setConfirmOpen(false)}
              >
                {t.no}
              </button>
              <button
                disabled={linking}
                className="inline-flex items-center gap-2 rounded-lg bg-black dark:bg-white dark:text-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={onConfirmLink}
                aria-busy={linking}
              >
                {linking ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Linking…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
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


