'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useDebounce } from '@/lib/hooks/useDebounce';

export interface Guardian {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
}

interface GuardianSelectorProps {
  guardians?: Guardian[]; // Optional for backward compatibility
  value: string[];
  onChange: (guardianIds: string[]) => void;
  label?: string;
  className?: string;
}

export function GuardianSelector({
  guardians = [], // Default to empty array for backward compatibility
  value,
  onChange,
  label,
  className,
}: GuardianSelectorProps) {
  const { t } = useLanguage();
  
  // Internal state for guardian IDs, initialized from value prop
  const [guardianIds, setGuardianIds] = useState<string[]>(() => {
    return value.length > 0 ? value : [''];
  });

  // Store selected guardian data (id, name, email) for display
  const [selectedGuardianData, setSelectedGuardianData] = useState<Map<string, Guardian>>(new Map());
  
  // Track previous value to detect actual external changes
  const prevValueRef = useRef<string>(JSON.stringify(value));

  // Sync internal state with value prop changes (only when value changes externally)
  useEffect(() => {
    const currentValueStr = JSON.stringify(value);
    const prevValueStr = prevValueRef.current;
    
    // Get current non-empty guardian IDs from our state
    const currentNonEmpty = guardianIds.filter(id => id && id.trim() !== '');
    
    // If value hasn't changed externally, just update selected guardian data if needed
    if (currentValueStr === prevValueStr) {
      // Still update selected guardian data from guardians prop if needed
      setSelectedGuardianData(prev => {
        const next = new Map(prev);
        value.forEach(guardianId => {
          if (guardianId && !next.has(guardianId)) {
            const guardian = guardians.find(g => String(g.id) === String(guardianId));
            if (guardian) {
              next.set(guardianId, guardian);
            }
          }
        });
        return next;
      });
      return;
    }
    
    // Value changed externally - update our state
    prevValueRef.current = currentValueStr;
    
    // Preserve any empty slots we have (for adding new guardians)
    const emptySlots = guardianIds.filter(id => !id || id.trim() === '');
    
    if (value.length > 0) {
      // Merge: value from prop + any empty slots we're maintaining
      setGuardianIds([...value, ...emptySlots]);
      
      // Initialize selected guardian data from guardians prop for pre-selected guardians
      setSelectedGuardianData(prev => {
        const next = new Map(prev);
        value.forEach(guardianId => {
          if (guardianId && !next.has(guardianId)) {
            const guardian = guardians.find(g => String(g.id) === String(guardianId));
            if (guardian) {
              next.set(guardianId, guardian);
            }
          }
        });
        return next;
      });
    } else {
      // If value is empty, keep empty slots if we have them, otherwise start with one
      setGuardianIds(emptySlots.length > 0 ? emptySlots : ['']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, guardians]);

  // Notify parent of changes
  const handleGuardianIdsChange = (newIds: string[]) => {
    setGuardianIds(newIds);
    // Filter out empty strings before calling onChange
    const filtered = newIds.filter(id => id && id.trim() !== '');
    onChange(filtered.length > 0 ? filtered : []);
  };

  // Searchable Guardian Dropdown Component
  const GuardianSearchDropdown = ({ guardianId, index }: { guardianId: string; index: number }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [filteredGuardians, setFilteredGuardians] = useState<Guardian[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const debouncedQuery = useDebounce(searchQuery, 250);

    // Filter out guardians that are already selected in other dropdowns
    // Use useMemo to create a stable reference
    const selectedGuardianIds = useMemo(() => {
      return guardianIds.filter((id, i) => i !== index && id && id.trim() !== '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guardianIds.join(','), index]);

    // Get selected guardian from stored data or fallback to guardians prop
    const selectedGuardian = (() => {
      // Explicitly check for empty string or falsy values
      if (!guardianId || guardianId.trim() === '') return undefined;
      
      // First check stored data
      const stored = selectedGuardianData.get(guardianId);
      if (stored) return stored;
      
      // Fallback to guardians prop (for backward compatibility)
      return guardians.find((g) => String(g.id) === String(guardianId));
    })();

    // Fetch guardians from API when debounced query changes or when dropdown opens with empty query
    useEffect(() => {
      // Only fetch if dropdown is open
      if (!isOpen) {
        return;
      }

      // Abort controller to cancel in-flight requests
      const abortController = new AbortController();

      setIsLoading(true);
      setSearchError(null);

      const fetchGuardians = async () => {
        try {
          // If query is empty, fetch latest 5 guardians (no query param)
          // Otherwise, search with the query
          const queryParam = debouncedQuery.trim() 
            ? `?q=${encodeURIComponent(debouncedQuery)}` 
            : '';
          
          const response = await fetch(`/api/search-guardians${queryParam}`, {
            cache: 'no-store',
            signal: abortController.signal,
          });

          if (!response.ok) {
            const json = await response.json().catch(() => ({}));
            throw new Error(json.error || `Failed with ${response.status}`);
          }

          const json = await response.json();
          const results: Guardian[] = (json.guardians || []).map((g: any) => ({
            id: g.id,
            first_name: g.first_name || '',
            last_name: g.last_name || '',
            email: g.email || null,
            full_name: `${g.first_name || ''} ${g.last_name || ''}`.trim() || g.email || 'Unknown',
          }));

          // Filter out already selected guardians
          const available = results.filter(
            guardian => !selectedGuardianIds.includes(guardian.id)
          );

          setFilteredGuardians(available);
        } catch (error) {
          // Ignore abort errors
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          console.error('Error searching guardians:', error);
          setSearchError(error instanceof Error ? error.message : 'Failed to search guardians');
          setFilteredGuardians([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchGuardians();

      // Cleanup: abort request if component unmounts or query changes
      return () => {
        abortController.abort();
      };
    }, [debouncedQuery, selectedGuardianIds, isOpen]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (isOpen && !target.closest(`.guardian-search-dropdown-${index}`)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, index]);

    const handleSelect = (guardian: Guardian) => {
      // Store guardian data for display
      setSelectedGuardianData(prev => {
        const next = new Map(prev);
        next.set(guardian.id, guardian);
        return next;
      });

      const currentIds = guardianIds.length > 0 ? [...guardianIds] : [''];
      currentIds[index] = guardian.id;
      const filtered = currentIds.filter(id => id && id.trim() !== '');
      handleGuardianIdsChange(filtered.length > 0 ? filtered : ['']);
      setIsOpen(false);
      setSearchQuery('');
    };

    const handleClear = () => {
      // Remove guardian data from stored data
      if (guardianId) {
        setSelectedGuardianData(prev => {
          const next = new Map(prev);
          next.delete(guardianId);
          return next;
        });
      }

      const newGuardianIds = guardianIds.filter((_, i) => i !== index);
      handleGuardianIdsChange(newGuardianIds.length > 0 ? newGuardianIds : ['']);
      setSearchQuery('');
      setIsOpen(false);
    };

    return (
      <div className={`guardian-search-dropdown-${index} relative flex-1`}>
        {selectedGuardian ? (
          <div className="flex items-center gap-2 rounded-ds-md border border-input-stroke dark:border-slate-600 bg-input-fill dark:bg-slate-700 p-2">
            <span className="flex-1 text-ds-small text-ds-text-primary dark:text-slate-200">
              {selectedGuardian.full_name || 
                `${selectedGuardian.first_name || ''} ${selectedGuardian.last_name || ''}`.trim() || 
                selectedGuardian.email || 
                'Unknown'}
              {selectedGuardian.email && (
                <span className="ml-2 text-ds-tiny text-ds-text-muted dark:text-slate-400">
                  ({selectedGuardian.email})
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
              placeholder={(t as any).select_parent || 'Search and select a parent...'}
            />
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        {isOpen && !selectedGuardian && (
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
            {!isLoading && !searchError && filteredGuardians.length === 0 && (
              <div className="p-3 text-ds-small text-ds-text-muted dark:text-slate-400">
                {searchQuery.trim() ? 'No parents found' : 'No parents available'}
              </div>
            )}
            {!isLoading && !searchError && filteredGuardians.length > 0 && (
              <div className="py-1">
                {filteredGuardians.map((guardian) => {
                  const name = guardian.full_name || 
                    `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() || 
                    guardian.email || 
                    'Unknown';
                  return (
                    <button
                      key={guardian.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(guardian);
                      }}
                      className="w-full px-3 py-2 text-left text-ds-small hover:bg-mint-50 dark:hover:bg-slate-700"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {name}
                      </div>
                      {guardian.email && (
                        <div className="text-ds-tiny text-ds-text-muted dark:text-slate-400">
                          {guardian.email}
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
        {label || (t as any).parents_guardians || 'Parents/Guardians'}
      </label>
      <div className="space-y-ds-sm">
        {guardianIds.map((guardianId, index) => (
          <div key={index} className="flex gap-ds-sm items-center">
            <GuardianSearchDropdown guardianId={guardianId} index={index} />
            {guardianIds.length > 1 || (guardianIds.length === 1 && guardianIds[0]) ? (
              <button
                type="button"
                onClick={() => {
                  const newGuardianIds = guardianIds.filter((_, i) => i !== index);
                  handleGuardianIdsChange(newGuardianIds.length > 0 ? newGuardianIds : ['']);
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
            const currentIds = guardianIds.length > 0 ? guardianIds : [''];
            handleGuardianIdsChange([...currentIds, '']);
          }}
          className="w-full rounded-ds-md border border-input-stroke dark:border-slate-600 px-ds-sm py-2 text-ds-small text-ds-text-primary hover:bg-mint-50 dark:hover:bg-slate-700 transition-colors"
        >
          {(t as any).add_another_parent || '+ Add Another Parent'}
        </button>
      </div>
    </div>
  );
}

