'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { TeacherClass } from '@/lib/types/attendance';

const CACHE_KEY = 'teacher_classes_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  classes: TeacherClass[];
  timestamp: number;
}

/**
 * Hook to fetch and manage teacher's assigned classes
 * Includes localStorage caching with expiration
 * Only fetches from API when cache is expired or missing
 */
export function useTeacherClasses() {
  const { session } = useAuth();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  // Load from cache if available
  const loadFromCache = useCallback((): TeacherClass[] | null => {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CacheData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - data.timestamp > CACHE_EXPIRY_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data.classes;
    } catch (e) {
      // Invalid cache, remove it
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback((classesData: TeacherClass[]) => {
    if (typeof window === 'undefined') return;

    try {
      const cacheData: CacheData = {
        classes: classesData,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      // Ignore cache errors
      console.warn('Failed to save classes to cache:', e);
    }
  }, []);

  // Fetch classes from API
  const fetchClasses = useCallback(async (forceRefresh = false): Promise<TeacherClass[]> => {
    const userId = session?.user?.id;
    if (!userId) {
      return [];
    }

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedClasses = loadFromCache();
      if (cachedClasses && cachedClasses.length > 0) {
        // Cache is valid, update state and return it without fetching
        setClasses(cachedClasses);
        return cachedClasses;
      }
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/teacher-classes?userId=${userId}`,
        { cache: 'no-store' }
      );
      const data = await response.json();

      if (response.ok) {
        const classesData = data.classes || [];
        setClasses(classesData);
        saveToCache(classesData);
        return classesData;
      } else {
        throw new Error(data.error || 'Failed to fetch classes');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load classes';
      setError(errorMessage);
      console.error('Error loading teacher classes:', err);
      
      // Fallback to cache if available
      const cachedClasses = loadFromCache();
      if (cachedClasses && cachedClasses.length > 0) {
        console.warn('Using cached classes due to API error');
        setClasses(cachedClasses);
        return cachedClasses;
      }
      
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, loadFromCache, saveToCache]);

  // Refetch function (forces refresh)
  const refetch = useCallback(async () => {
    return fetchClasses(true);
  }, [fetchClasses]);

  // Initial load: try cache first, only fetch if expired or missing
  useEffect(() => {
    if (!session?.user?.id) {
      setClasses([]);
      isInitializedRef.current = false;
      return;
    }

    // Prevent duplicate initialization
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Try cache first
    const cachedClasses = loadFromCache();
    if (cachedClasses && cachedClasses.length > 0) {
      setClasses(cachedClasses);
      // Cache is valid, no need to fetch
      // fetchClasses will handle cache expiration check internally
    } else {
      // No cache or expired, fetch immediately
      fetchClasses(false);
    }
  }, [session?.user?.id, loadFromCache, fetchClasses]);

  // Reset initialization flag when userId changes
  useEffect(() => {
    isInitializedRef.current = false;
  }, [session?.user?.id]);

  return {
    classes,
    isLoading,
    error,
    refetch,
  };
}

