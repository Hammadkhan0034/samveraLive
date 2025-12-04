'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useDebounce } from '@/lib/hooks/useDebounce';

export interface Class {
  id: string;
  name: string;
  code?: string | null;
}

interface ClassSelectorProps {
  classes?: Class[]; // Optional for backward compatibility
  value: string[];
  onChange: (classIds: string[]) => void;
  label?: string;
  className?: string;

  singleSelect?: boolean;
}

export function ClassSelector({
  classes = [], // Default to empty array for backward compatibility
  value,
  onChange,
  label,
  className,
  singleSelect = false,
}: ClassSelectorProps) {
  const { t } = useLanguage();
  
  // Internal state for class IDs, initialized from value prop
  const [classIds, setClassIds] = useState<string[]>(() => {
    if (singleSelect) {
      // In single-select mode, only keep the first value (if any)
      return value.length > 0 ? [value[0]] : [''];
    }
    return value.length > 0 ? value : [''];
  });

  // Store selected class data (id, name, code) for display
  const [selectedClassData, setSelectedClassData] = useState<Map<string, Class>>(new Map());
  
  // Track previous value to detect actual external changes
  const prevValueRef = useRef<string>(JSON.stringify(value));

  // Sync internal state with value prop changes (only when value changes externally)
  useEffect(() => {
    const currentValueStr = JSON.stringify(value);
    const prevValueStr = prevValueRef.current;
    
    // Get current non-empty class IDs from our state
    const currentNonEmpty = classIds.filter(id => id && id.trim() !== '');
    
    // If value hasn't changed externally, just update selected class data if needed
    if (currentValueStr === prevValueStr) {
      // Still update selected class data from classes prop if needed
      setSelectedClassData(prev => {
        const next = new Map(prev);
        const effectiveValue = singleSelect && value.length > 1 ? [value[0]] : value;
        effectiveValue.forEach(classId => {
          if (classId && !next.has(classId)) {
            const cls = classes.find(c => String(c.id) === String(classId));
            if (cls) {
              next.set(classId, cls);
            }
          }
        });
        return next;
      });
      return;
    }
    
    // Value changed externally - update our state
    prevValueRef.current = currentValueStr;
    
    // Preserve any empty slots we have (for adding new classes in multi-select mode)
    const emptySlots = singleSelect
      ? []
      : classIds.filter(id => !id || id.trim() === '');
    
    if (value.length > 0) {
      if (singleSelect) {
        // In single-select mode, only keep the first non-empty value
        setClassIds([value[0]]);
      } else {
        // Merge: value from prop + any empty slots we're maintaining
        setClassIds([...value, ...emptySlots]);
      }
      
      // Initialize selected class data from classes prop for pre-selected classes
      setSelectedClassData(prev => {
        const next = new Map(prev);
        const effectiveValue = singleSelect && value.length > 1 ? [value[0]] : value;
        effectiveValue.forEach(classId => {
          if (classId && !next.has(classId)) {
            const cls = classes.find(c => String(c.id) === String(classId));
            if (cls) {
              next.set(classId, cls);
            }
          }
        });
        return next;
      });
    } else {
      // If value is empty, keep empty slots if we have them, otherwise start with one
      setClassIds(emptySlots.length > 0 ? emptySlots : ['']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, classes]);

  // Notify parent of changes
  const handleClassIdsChange = (newIds: string[]) => {
    // In single-select mode, ensure we only ever keep a single non-empty ID
    const nextIds = singleSelect
      ? newIds.slice(0, 1)
      : newIds;

    setClassIds(nextIds);

    // Filter out empty strings before calling onChange
    const filtered = nextIds.filter(id => id && id.trim() !== '');
    // In single-select mode, also ensure we only send a single ID back up
    const finalIds = singleSelect && filtered.length > 1 ? [filtered[0]] : filtered;

    onChange(finalIds.length > 0 ? finalIds : []);
  };

  // Searchable Class Dropdown Component
  const ClassSearchDropdown = ({ classId, index }: { classId: string; index: number }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const debouncedQuery = useDebounce(searchQuery, 250);

    // Filter out classes that are already selected in other dropdowns
    // Use useMemo to create a stable reference
    const selectedClassIds = useMemo(() => {
      return classIds.filter((id, i) => i !== index && id && id.trim() !== '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classIds.join(','), index]);

    // Get selected class from stored data or fallback to classes prop
    const selectedClass = (() => {
      // Explicitly check for empty string or falsy values
      if (!classId || classId.trim() === '') return undefined;
      
      // First check stored data
      const stored = selectedClassData.get(classId);
      if (stored) return stored;
      
      // Fallback to classes prop (for backward compatibility)
      return classes.find((c) => String(c.id) === String(classId));
    })();

    // Fetch classes from API when debounced query changes or when dropdown opens with empty query
    useEffect(() => {
      // Only fetch if dropdown is open
      if (!isOpen) {
        return;
      }

      // Abort controller to cancel in-flight requests
      const abortController = new AbortController();

      setIsLoading(true);
      setSearchError(null);

      const fetchClasses = async () => {
        try {
          // If query is empty, fetch latest 5 classes (no query param)
          // Otherwise, search with the query
          const queryParam = debouncedQuery.trim() 
            ? `?q=${encodeURIComponent(debouncedQuery)}` 
            : '';
          
          const response = await fetch(`/api/search-classes${queryParam}`, {
            cache: 'no-store',
            signal: abortController.signal,
          });

          if (!response.ok) {
            const json = await response.json().catch(() => ({}));
            throw new Error(json.error || `Failed with ${response.status}`);
          }

          const json = await response.json();
          const results: Class[] = (json.classes || []).map((c: any) => ({
            id: c.id,
            name: c.name || '',
            code: c.code || null,
          }));

          // Filter out already selected classes
          const available = results.filter(
            cls => !selectedClassIds.includes(cls.id)
          );

          setFilteredClasses(available);
        } catch (error) {
          // Ignore abort errors
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          console.error('Error searching classes:', error);
          setSearchError(error instanceof Error ? error.message : 'Failed to search classes');
          setFilteredClasses([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchClasses();

      // Cleanup: abort request if component unmounts or query changes
      return () => {
        abortController.abort();
      };
    }, [debouncedQuery, selectedClassIds, isOpen]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (isOpen && !target.closest(`.class-search-dropdown-${index}`)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, index]);

    const handleSelect = (cls: Class) => {
      // Store class data for display
      setSelectedClassData(prev => {
        const next = new Map(prev);
        next.set(cls.id, cls);
        return next;
      });

      const currentIds = classIds.length > 0 ? [...classIds] : [''];
      currentIds[index] = cls.id;

      if (singleSelect) {
        // In single-select mode we only keep the selected class in the first slot
        handleClassIdsChange([cls.id]);
      } else {
        const filtered = currentIds.filter(id => id && id.trim() !== '');
        handleClassIdsChange(filtered.length > 0 ? filtered : ['']);
      }
      setIsOpen(false);
      setSearchQuery('');
    };

    const handleClear = () => {
      // Remove class data from stored data
      if (classId) {
        setSelectedClassData(prev => {
          const next = new Map(prev);
          next.delete(classId);
          return next;
        });
      }

      const newClassIds = classIds.filter((_, i) => i !== index);
      handleClassIdsChange(newClassIds.length > 0 ? newClassIds : ['']);
      setSearchQuery('');
      setIsOpen(false);
    };

    return (
      <div className={`class-search-dropdown-${index} relative flex-1`}>
        {selectedClass ? (
          <div className="flex items-center gap-2 rounded-ds-md border border-input-stroke dark:border-slate-600 bg-input-fill dark:bg-slate-700 p-2">
            <span className="flex-1 text-ds-small text-ds-text-primary dark:text-slate-200">
              {selectedClass.name || 'Unknown'}
              {selectedClass.code && (
                <span className="ml-2 text-ds-tiny text-ds-text-muted dark:text-slate-400">
                  ({selectedClass.code})
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
              placeholder={(t as any).select_class || 'Search and select a class...'}
            />
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        {isOpen && !selectedClass && (
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
            {!isLoading && !searchError && filteredClasses.length === 0 && (
              <div className="p-3 text-ds-small text-ds-text-muted dark:text-slate-400">
                {searchQuery.trim() ? 'No classes found' : 'No classes available'}
              </div>
            )}
            {!isLoading && !searchError && filteredClasses.length > 0 && (
              <div className="py-1">
                {filteredClasses.map((cls) => {
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(cls);
                      }}
                      className="w-full px-3 py-2 text-left text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {cls.name || 'Unknown'}
                      </div>
                      {cls.code && (
                        <div className="text-ds-tiny text-ds-text-muted dark:text-slate-400">
                          {cls.code}
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
        {label || (t as any).classes || 'Classes'}
      </label>
      <div className="space-y-ds-sm">
        {(singleSelect ? classIds.slice(0, 1) : classIds).map((classId, index) => (
          <div key={index} className="flex gap-ds-sm items-center">
            <ClassSearchDropdown classId={classId} index={index} />
            {!singleSelect && (classIds.length > 1 || (classIds.length === 1 && classIds[0])) ? (
              <button
                type="button"
                onClick={() => {
                  const newClassIds = classIds.filter((_, i) => i !== index);
                  handleClassIdsChange(newClassIds.length > 0 ? newClassIds : ['']);
                }}
                className="rounded-ds-md p-2 hover:bg-red-50 dark:hover:bg-slate-700 text-red-600 dark:text-red-400"
                aria-label={t.remove || 'Remove'}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
        {!singleSelect && (
          <button
            type="button"
            onClick={() => {
              const currentIds = classIds.length > 0 ? classIds : [''];
              handleClassIdsChange([...currentIds, '']);
            }}
            className="w-full rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-2 text-ds-small text-ds-text-primary hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
          >
            {(t as any).add_another_class || '+ Add Another Class'}
          </button>
        )}
      </div>
    </div>
  );
}

