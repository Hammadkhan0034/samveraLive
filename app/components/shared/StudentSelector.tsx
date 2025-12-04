'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useDebounce } from '@/lib/hooks/useDebounce';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface StudentSelectorProps {
  students?: Student[]; // Optional for backward compatibility / preloaded options
  value: string[];
  onChange: (studentIds: string[]) => void;
  label?: string;
  className?: string;
}

export function StudentSelector({
  students = [],
  value,
  onChange,
  label,
  className,
}: StudentSelectorProps) {
  const { t } = useLanguage();

  // Internal state for student IDs, initialized from value prop
  const [studentIds, setStudentIds] = useState<string[]>(() => {
    return value.length > 0 ? value : [''];
  });

  // Store selected student data (id, first_name, last_name) for display
  const [selectedStudentData, setSelectedStudentData] = useState<
    Map<string, Student>
  >(new Map());

  // Track previous value to detect actual external changes
  const prevValueRef = useRef<string>(JSON.stringify(value));

  // Sync internal state with value prop changes (only when value changes externally)
  useEffect(() => {
    const currentValueStr = JSON.stringify(value);
    const prevValueStr = prevValueRef.current;

    // Get current non-empty student IDs from our state
    const currentNonEmpty = studentIds.filter(
      (id) => id && id.trim() !== '',
    );

    // If value hasn't changed externally, just update selected student data if needed
    if (currentValueStr === prevValueStr) {
      setSelectedStudentData((prev) => {
        const next = new Map(prev);
        value.forEach((studentId) => {
          if (studentId && !next.has(studentId)) {
            const student = students.find(
              (s) => String(s.id) === String(studentId),
            );
            if (student) {
              next.set(studentId, student);
            }
          }
        });
        return next;
      });
      return;
    }

    // Value changed externally - update our state
    prevValueRef.current = currentValueStr;

    // Preserve any empty slots we have (for adding new students)
    const emptySlots = studentIds.filter((id) => !id || id.trim() === '');

    if (value.length > 0) {
      // Merge: value from prop + any empty slots we're maintaining
      setStudentIds([...value, ...emptySlots]);

      // Initialize selected student data from students prop for pre-selected students
      setSelectedStudentData((prev) => {
        const next = new Map(prev);
        value.forEach((studentId) => {
          if (studentId && !next.has(studentId)) {
            const student = students.find(
              (s) => String(s.id) === String(studentId),
            );
            if (student) {
              next.set(studentId, student);
            }
          }
        });
        return next;
      });
    } else {
      // If value is empty, keep empty slots if we have them, otherwise start with one
      setStudentIds(emptySlots.length > 0 ? emptySlots : ['']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, students]);

  // Notify parent of changes
  const handleStudentIdsChange = (newIds: string[]) => {
    setStudentIds(newIds);
    // Filter out empty strings before calling onChange
    const filtered = newIds.filter((id) => id && id.trim() !== '');
    onChange(filtered.length > 0 ? filtered : []);
  };

  // Searchable Student Dropdown Component
  const StudentSearchDropdown = ({
    studentId,
    index,
  }: {
    studentId: string;
    index: number;
  }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const debouncedQuery = useDebounce(searchQuery, 250);

    // Filter out students that are already selected in other dropdowns
    // Use useMemo to create a stable reference
    const selectedStudentIds = useMemo(() => {
      return studentIds.filter(
        (id, i) => i !== index && id && id.trim() !== '',
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentIds.join(','), index]);

    // Get selected student from stored data or fallback to students prop
    const selectedStudent = (() => {
      if (!studentId || studentId.trim() === '') return undefined;

      // First check stored data
      const stored = selectedStudentData.get(studentId);
      if (stored) return stored;

      // Fallback to students prop (for backward compatibility)
      return students.find((s) => String(s.id) === String(studentId));
    })();

    // Fetch students from API when debounced query changes or when dropdown opens with empty query
    useEffect(() => {
      if (!isOpen) {
        return;
      }

      const abortController = new AbortController();

      setIsLoading(true);
      setSearchError(null);

      const fetchStudents = async () => {
        try {
          const queryParam = debouncedQuery.trim()
            ? `?q=${encodeURIComponent(debouncedQuery)}`
            : '';

          const response = await fetch(
            `/api/search-students${queryParam}`,
            {
              cache: 'no-store',
              signal: abortController.signal,
            },
          );

          if (!response.ok) {
            const json = await response.json().catch(() => ({}));
            throw new Error(json.error || `Failed with ${response.status}`);
          }

          const json = await response.json();
          const results: Student[] = (json.students || []).map(
            (s: any) => ({
              id: s.id,
              first_name: s.first_name || '',
              last_name: s.last_name || '',
            }),
          );

          // Filter out already selected students
          const available = results.filter(
            (student) => !selectedStudentIds.includes(student.id),
          );

          setFilteredStudents(available);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          console.error('Error searching students:', error);
          setSearchError(
            error instanceof Error
              ? error.message
              : 'Failed to search students',
          );
          setFilteredStudents([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchStudents();

      return () => {
        abortController.abort();
      };
    }, [debouncedQuery, selectedStudentIds, isOpen]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (
          isOpen &&
          !target.closest(`.student-search-dropdown-${index}`)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, index]);

    const handleSelect = (student: Student) => {
      setSelectedStudentData((prev) => {
        const next = new Map(prev);
        next.set(student.id, student);
        return next;
      });

      const currentIds = studentIds.length > 0 ? [...studentIds] : [''];
      currentIds[index] = student.id;
      const filtered = currentIds.filter(
        (id) => id && id.trim() !== '',
      );
      handleStudentIdsChange(filtered.length > 0 ? filtered : ['']);
      setIsOpen(false);
      setSearchQuery('');
    };

    const handleClear = () => {
      if (studentId) {
        setSelectedStudentData((prev) => {
          const next = new Map(prev);
          next.delete(studentId);
          return next;
        });
      }

      const newStudentIds = studentIds.filter((_, i) => i !== index);
      handleStudentIdsChange(
        newStudentIds.length > 0 ? newStudentIds : [''],
      );
      setSearchQuery('');
      setIsOpen(false);
    };

    return (
      <div className={`student-search-dropdown-${index} relative flex-1`}>
        {selectedStudent ? (
          <div className="flex items-center gap-2 rounded-ds-md border border-input-stroke dark:border-slate-600 bg-input-fill dark:bg-slate-700 p-2">
            <span className="flex-1 text-ds-small text-ds-text-primary dark:text-slate-200">
              {`${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`.trim() ||
                'Unknown'}
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
              placeholder={
                (t as any).select_student ||
                'Search and select a student...'
              }
            />
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        {isOpen && !selectedStudent && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-ds-md border border-slate-200 bg-white shadow-ds-md dark:border-slate-700 dark:bg-slate-800">
            {isLoading && (
              <div className="p-3 text-ds-small text-ds-text-muted dark:text-slate-400">
                Searching...
              </div>
            )}
            {!isLoading && searchError && (
              <div className="p-3 text-ds-small text-red-600 dark:text-red-400">
                {searchError}
              </div>
            )}
            {!isLoading &&
              !searchError &&
              filteredStudents.length === 0 && (
                <div className="p-3 text-ds-small text-ds-text-muted dark:text-slate-400">
                  {searchQuery.trim()
                    ? 'No students found'
                    : 'No students available'}
                </div>
              )}
            {!isLoading &&
              !searchError &&
              filteredStudents.length > 0 && (
                <div className="py-1">
                  {filteredStudents.map((student) => {
                    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown';
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelect(student);
                        }}
                        className="w-full px-3 py-2 text-left text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {name}
                        </div>
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
        {label || (t as any).students || 'Students'}
      </label>
      <div className="space-y-ds-sm">
        {studentIds.map((studentId, index) => (
          <div key={index} className="flex gap-ds-sm items-center">
            <StudentSearchDropdown studentId={studentId} index={index} />
            {studentIds.length > 1 ||
            (studentIds.length === 1 && studentIds[0]) ? (
              <button
                type="button"
                onClick={() => {
                  const newStudentIds = studentIds.filter(
                    (_, i) => i !== index,
                  );
                  handleStudentIdsChange(
                    newStudentIds.length > 0 ? newStudentIds : [''],
                  );
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
            const currentIds = studentIds.length > 0 ? studentIds : [''];
            handleStudentIdsChange([...currentIds, '']);
          }}
          className="w-full rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-2 text-ds-small text-ds-text-primary hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
        >
          {(t as any).add_another_student || '+ Add Another Student'}
        </button>
      </div>
    </div>
  );
}


