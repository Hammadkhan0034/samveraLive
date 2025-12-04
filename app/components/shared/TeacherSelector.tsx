'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useDebounce } from '@/lib/hooks/useDebounce';

export interface Teacher {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
}

interface TeacherSelectorProps {
  teachers?: Teacher[]; // Optional for backward compatibility / pre-fetched data
  value: string[];
  onChange: (teacherIds: string[]) => void;
  label?: string;
  className?: string;
}

export function TeacherSelector({
  teachers = [],
  value,
  onChange,
  label,
  className,
}: TeacherSelectorProps) {
  const { t } = useLanguage();

  // Internal state for teacher IDs, initialized from value prop
  const [teacherIds, setTeacherIds] = useState<string[]>(() => {
    return value.length > 0 ? value : [''];
  });

  // Store selected teacher data (id, name, email) for display
  const [selectedTeacherData, setSelectedTeacherData] = useState<Map<string, Teacher>>(new Map());

  // Track previous value to detect actual external changes
  const prevValueRef = useRef<string>(JSON.stringify(value));

  // Sync internal state with value prop changes (only when value changes externally)
  useEffect(() => {
    const currentValueStr = JSON.stringify(value);
    const prevValueStr = prevValueRef.current;

    // Get current non-empty teacher IDs from our state (kept for parity with GuardianSelector)
    const currentNonEmpty = teacherIds.filter((id) => id && id.trim() !== '');

    // If value hasn't changed externally, just update selected teacher data if needed
    if (currentValueStr === prevValueStr) {
      setSelectedTeacherData((prev) => {
        const next = new Map(prev);
        value.forEach((teacherId) => {
          if (teacherId && !next.has(teacherId)) {
            const teacher = teachers.find((tch) => String(tch.id) === String(teacherId));
            if (teacher) {
              next.set(teacherId, teacher);
            }
          }
        });
        return next;
      });
      return;
    }

    // Value changed externally - update our state
    prevValueRef.current = currentValueStr;

    // Preserve any empty slots we have (for adding new teachers)
    const emptySlots = teacherIds.filter((id) => !id || id.trim() === '');

    if (value.length > 0) {
      // Merge: value from prop + any empty slots we're maintaining
      setTeacherIds([...value, ...emptySlots]);

      // Initialize selected teacher data from teachers prop for pre-selected teachers
      setSelectedTeacherData((prev) => {
        const next = new Map(prev);
        value.forEach((teacherId) => {
          if (teacherId && !next.has(teacherId)) {
            const teacher = teachers.find((tch) => String(tch.id) === String(teacherId));
            if (teacher) {
              next.set(teacherId, teacher);
            }
          }
        });
        return next;
      });
    } else {
      // If value is empty, keep empty slots if we have them, otherwise start with one
      setTeacherIds(emptySlots.length > 0 ? emptySlots : ['']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, teachers]);

  // Notify parent of changes
  const handleTeacherIdsChange = (newIds: string[]) => {
    setTeacherIds(newIds);
    // Filter out empty strings before calling onChange
    const filtered = newIds.filter((id) => id && id.trim() !== '');
    onChange(filtered.length > 0 ? filtered : []);
  };

  // Searchable Teacher Dropdown Component
  const TeacherSearchDropdown = ({ teacherId, index }: { teacherId: string; index: number }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const debouncedQuery = useDebounce(searchQuery, 250);

    // Filter out teachers that are already selected in other dropdowns
    // Use useMemo to create a stable reference
    const selectedTeacherIds = useMemo(() => {
      return teacherIds.filter((id, i) => i !== index && id && id.trim() !== '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teacherIds.join(','), index]);

    // Get selected teacher from stored data or fallback to teachers prop
    const selectedTeacher = (() => {
      // Explicitly check for empty string or falsy values
      if (!teacherId || teacherId.trim() === '') return undefined;

      // First check stored data
      const stored = selectedTeacherData.get(teacherId);
      if (stored) return stored;

      // Fallback to teachers prop (for backward compatibility)
      return teachers.find((tch) => String(tch.id) === String(teacherId));
    })();

    // Fetch teachers from API when debounced query changes or when dropdown opens with empty query
    useEffect(() => {
      // Only fetch if dropdown is open
      if (!isOpen) {
        return;
      }

      // Abort controller to cancel in-flight requests
      const abortController = new AbortController();

      setIsLoading(true);
      setSearchError(null);

      const fetchTeachers = async () => {
        try {
          // If query is empty, fetch latest teachers (no query param)
          // Otherwise, search with the query
          const queryParam = debouncedQuery.trim()
            ? `?q=${encodeURIComponent(debouncedQuery)}`
            : '';

          const response = await fetch(`/api/search-teachers${queryParam}`, {
            cache: 'no-store',
            signal: abortController.signal,
          });

          if (!response.ok) {
            const json = await response.json().catch(() => ({}));
            throw new Error(json.error || `Failed with ${response.status}`);
          }

          const json = await response.json();
          const results: Teacher[] = (json.teachers || []).map((t: any) => ({
            id: t.id,
            first_name: t.first_name || '',
            last_name: t.last_name || '',
            email: t.email || null,
            full_name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || 'Unknown',
          }));

          // Filter out already selected teachers
          const available = results.filter((teacher) => !selectedTeacherIds.includes(teacher.id));

          setFilteredTeachers(available);
        } catch (error) {
          // Ignore abort errors
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          console.error('Error searching teachers:', error);
          setSearchError(error instanceof Error ? error.message : 'Failed to search teachers');
          setFilteredTeachers([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchTeachers();

      // Cleanup: abort request if component unmounts or query changes
      return () => {
        abortController.abort();
      };
    }, [debouncedQuery, selectedTeacherIds, isOpen]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (isOpen && !target.closest(`.teacher-search-dropdown-${index}`)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, index]);

    const handleSelect = (teacher: Teacher) => {
      // Store teacher data for display
      setSelectedTeacherData((prev) => {
        const next = new Map(prev);
        next.set(teacher.id, teacher);
        return next;
      });

      const currentIds = teacherIds.length > 0 ? [...teacherIds] : [''];
      currentIds[index] = teacher.id;
      const filtered = currentIds.filter((id) => id && id.trim() !== '');
      handleTeacherIdsChange(filtered.length > 0 ? filtered : ['']);
      setIsOpen(false);
      setSearchQuery('');
    };

    const handleClear = () => {
      // Remove teacher data from stored data
      if (teacherId) {
        setSelectedTeacherData((prev) => {
          const next = new Map(prev);
          next.delete(teacherId);
          return next;
        });
      }

      const newTeacherIds = teacherIds.filter((_, i) => i !== index);
      handleTeacherIdsChange(newTeacherIds.length > 0 ? newTeacherIds : ['']);
      setSearchQuery('');
      setIsOpen(false);
    };

    return (
      <div className={`teacher-search-dropdown-${index} relative flex-1`}>
        {selectedTeacher ? (
          <div className="flex items-center gap-2 rounded-ds-md border border-input-stroke dark:border-slate-600 bg-input-fill dark:bg-slate-700 p-2">
            <span className="flex-1 text-ds-small text-ds-text-primary dark:text-slate-200">
              {selectedTeacher.full_name ||
                `${selectedTeacher.first_name || ''} ${selectedTeacher.last_name || ''}`.trim() ||
                selectedTeacher.email ||
                'Unknown'}
              {selectedTeacher.email && (
                <span className="ml-2 text-ds-tiny text-ds-text-muted dark:text-slate-400">
                  ({selectedTeacher.email})
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={t.remove || 'Remove'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full h-10 rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm pr-8 text-ds-body bg-input-fill text-ds-text-primary focus:border-mint-500 focus:outline-none focus:ring-1 focus:ring-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder={(t as any).select_teacher || 'Search and select a teacher...'}
            />
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        {isOpen && !selectedTeacher && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-ds-md border border-slate-200 bg-white shadow-ds-md dark:border-slate-700 dark:bg-slate-800">
            {isLoading && (
              <div className="p-3 text-ds-small text-ds-text-muted dark:text-slate-400">Searching...</div>
            )}
            {!isLoading && searchError && (
              <div className="p-3 text-ds-small text-red-600 dark:text-red-400">{searchError}</div>
            )}
            {!isLoading && !searchError && filteredTeachers.length === 0 && (
              <div className="p-3 text-ds-small text-ds-text-muted dark:text-slate-400">
                {searchQuery.trim() ? 'No teachers found' : 'No teachers available'}
              </div>
            )}
            {!isLoading && !searchError && filteredTeachers.length > 0 && (
              <div className="py-1">
                {filteredTeachers.map((teacher) => {
                  const name =
                    teacher.full_name ||
                    `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() ||
                    teacher.email ||
                    'Unknown';
                  return (
                    <button
                      key={teacher.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(teacher);
                      }}
                      className="w-full px-3 py-2 text-left text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">{name}</div>
                      {teacher.email && (
                        <div className="text-ds-tiny text-ds-text-muted dark:text-slate-400">
                          {teacher.email}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <label className="block text-ds-small font-medium text-ds-text-primary dark:text-slate-300 mb-ds-xs">
        {label || (t as any).teachers || 'Teachers'}
      </label>
      <div className="space-y-ds-sm">
        {teacherIds.map((teacherId, index) => (
          <div key={index} className="flex gap-ds-sm items-center">
            <TeacherSearchDropdown teacherId={teacherId} index={index} />
            {teacherIds.length > 1 || (teacherIds.length === 1 && teacherIds[0]) ? (
              <button
                type="button"
                onClick={() => {
                  const newTeacherIds = teacherIds.filter((_, i) => i !== index);
                  handleTeacherIdsChange(newTeacherIds.length > 0 ? newTeacherIds : ['']);
                }}
                className="rounded-ds-md p-2 hover:bg-red-50 dark:hover:bg-slate-700 text-red-600 dark:text-red-400"
                aria-label={t.remove || 'Remove'}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const currentIds = teacherIds.length > 0 ? teacherIds : [''];
            handleTeacherIdsChange([...currentIds, '']);
          }}
          className="w-full rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-2 text-ds-small text-ds-text-primary hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
        >
          {(t as any).add_another_teacher || '+ Add Another Teacher'}
        </button>
      </div>
    </div>
  );
}


