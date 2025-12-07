'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Check, Users } from 'lucide-react';
import EmptyState from './EmptyState';

type Lang = 'en' | 'is';

type TeacherResult = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
};

interface TeacherSelectionProps {
  onSelectionChange: (teacherIds: string[]) => void;
  excludeTeacherIds?: string[];
  lang?: Lang;
  asPage?: boolean;
  initialSelectedIds?: string[];
}

const TEXTS = {
  en: {
    title: 'Add Teachers',
    searchLabel: 'Search Teachers',
    placeholder: 'Search by email or name…',
    selectedTeachers: 'Added Teachers',
    noTeachersSelected: 'No teachers selected',
    emptyState: 'Search for teachers by email or name',
    emptyStateTitle: 'Search for Teachers',
    emptyStateDescription: 'Enter a name or email to find teachers',
    loading: 'Loading…',
    noResults: 'No teachers found',
    roleTeacher: 'Teacher',
    remove: 'Remove',
  },
  is: {
    title: 'Bæta við kennurum',
    searchLabel: 'Leita að kennurum',
    placeholder: 'Leita eftir tölvupósti eða nafni…',
    selectedTeachers: 'Bættir kennarar',
    noTeachersSelected: 'Engir kennarar valdir',
    emptyState: 'Leitaðu að kennurum eftir tölvupósti eða nafni',
    emptyStateTitle: 'Leita að kennurum',
    emptyStateDescription: 'Sláðu inn nafn eða tölvupóst til að finna kennara',
    loading: 'Hleður…',
    noResults: 'Engir kennarar fundust',
    roleTeacher: 'Kennari',
    remove: 'Fjarlægja',
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

export default function TeacherSelection({
  onSelectionChange,
  excludeTeacherIds = [],
  lang = 'en',
  asPage = false,
  initialSelectedIds = [],
}: TeacherSelectionProps) {
  const t = useMemo(() => TEXTS[lang] || TEXTS.en, [lang]);
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);

  const [teacherResults, setTeacherResults] = useState<TeacherResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set(initialSelectedIds));

  // Initialize selected teachers from initialSelectedIds
  useEffect(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      setSelectedTeacherIds(new Set(initialSelectedIds));
    }
  }, [JSON.stringify(initialSelectedIds)]);

  // Stabilize excludeTeacherIds so the search effect does not re-run on every render
  const excludeIdsKey = useMemo(() => {
    const uniqueSorted = Array.from(new Set(excludeTeacherIds)).sort();
    return uniqueSorted.join(',');
  }, [JSON.stringify(excludeTeacherIds)]);

  // Fetch teachers when search query changes
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!dq) {
        setTeacherResults([]);
        return;
      }
      setLoading(true);
      try {
        const excludeIdsParam = excludeIdsKey;
        const params = new URLSearchParams({
          q: dq,
          mode: 'any',
          limit: '25',
        });
        if (excludeIdsParam) {
          params.append('excludeIds', excludeIdsParam);
        }
        const res = await fetch(`/api/search-teachers?${params.toString()}`);
        const json = await res.json();
        if (!ignore) {
          setTeacherResults(json.results || []);
        }
      } catch (err) {
        console.error('Error searching teachers:', err);
        if (!ignore) setTeacherResults([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [dq, excludeIdsKey]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange(Array.from(selectedTeacherIds));
  }, [selectedTeacherIds, onSelectionChange]);

  function toggleTeacher(teacherId: string) {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  }

  function removeTeacher(teacherId: string) {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      next.delete(teacherId);
      return next;
    });
  }

  // Get selected teachers for display
  const selectedTeachers = useMemo(() => {
    return teacherResults.filter((t) => selectedTeacherIds.has(t.id));
  }, [teacherResults, selectedTeacherIds]);

  const containerClass = asPage
    ? 'min-h-screen bg-mint-100 dark:bg-slate-900 p-ds-md'
    : 'rounded-ds-lg border border-slate-200 bg-white p-ds-md shadow-ds-card dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className={containerClass}>
      <div className="mb-4">
        <h3 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">{t.title}</h3>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-ds-small font-medium text-slate-700 dark:text-slate-300">
          {t.searchLabel}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.placeholder}
            className="w-full rounded-ds-md border border-[#D8EBD8] bg-[#F5FFF7] py-2 pl-9 pr-3 text-ds-small text-slate-900 placeholder:text-slate-400 focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        {!q && (
          <div className="mt-2">
            <EmptyState 
              icon={Users}
              title={t.emptyStateTitle}
              description={t.emptyStateDescription}
            />
          </div>
        )}
        {q && (
          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            {loading && (
              <div className="p-3 text-sm text-slate-500 dark:text-slate-400">{t.loading}</div>
            )}
            {!loading && teacherResults.length === 0 && (
              <div className="p-3 text-sm text-slate-500 dark:text-slate-400">{t.noResults}</div>
            )}
            {!loading &&
              teacherResults.map((teacher) => {
                const isSelected = selectedTeacherIds.has(teacher.id);
                return (
                  <button
                    key={teacher.id}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${
                      isSelected ? 'bg-slate-50 dark:bg-slate-700' : ''
                    }`}
                    onClick={() => toggleTeacher(teacher.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {teacher.full_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {teacher.email}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                      {t.roleTeacher}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {selectedTeacherIds.size > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
          <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t.selectedTeachers} ({selectedTeacherIds.size})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedTeachers.length > 0 ? (
              selectedTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm dark:bg-slate-800"
                >
                  <span className="text-slate-900 dark:text-slate-100">{teacher.full_name}</span>
                  <button
                    onClick={() => removeTeacher(teacher.id)}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    aria-label={t.remove}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {t.noTeachersSelected}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

