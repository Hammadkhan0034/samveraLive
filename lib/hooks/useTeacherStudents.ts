'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Student, TeacherClass } from '@/lib/types/attendance';

const CACHE_KEY = 'teacher_students_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  students: Student[];
  timestamp: number;
}

/**
 * Hook to fetch and manage students from teacher's assigned classes
 * Optimized to fetch all classes in parallel instead of sequentially
 */
export function useTeacherStudents(classes: TeacherClass[], orgId: string | null) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from cache if available
  const loadFromCache = useCallback((): Student[] | null => {
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

      return data.students;
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback((studentsData: Student[]) => {
    if (typeof window === 'undefined') return;

    try {
      const cacheData: CacheData = {
        students: studentsData,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to save students to cache:', e);
    }
  }, []);

  // Fetch students for a single class
  const fetchStudentsForClass = useCallback(async (
    classId: string,
    orgId: string,
    teacherClasses: TeacherClass[]
  ): Promise<Student[]> => {
    try {
      const url = `/api/students?orgId=${orgId}&classId=${classId}&t=${Date.now()}`;
      const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }

        if (response.status === 401 || errorData.error?.includes('Authentication')) {
          console.warn(`⚠️ Authentication required for class ${classId}. Skipping...`);
          return [];
        } else {
          console.error(`❌ Error loading students for class ${classId}:`, errorData.error || `HTTP ${response.status}`);
          return [];
        }
      }

      const data = await response.json();

      if (data.students && Array.isArray(data.students)) {
        // Enhance students with class info
        const enhancedStudents = data.students.map((student: any) => {
          const classInfo = teacherClasses.find(cls => cls.id === student.class_id);
          return {
            ...student,
            classes: {
              id: student.class_id,
              name: classInfo?.name || `Class ${student.class_id?.slice(0, 8)}...`,
            },
          };
        });
        return enhancedStudents;
      } else {
        console.warn(`⚠️ No students array in response for class ${classId}`);
        return [];
      }
    } catch (fetchError: any) {
      console.error(`❌ Fetch error loading students for class ${classId}:`, fetchError.message || fetchError);
      return [];
    }
  }, []);

  // Fetch students for all classes in parallel
  const fetchStudents = useCallback(async (showLoading = true): Promise<Student[]> => {
    if (classes.length === 0) {
      setStudents([]);
      return [];
    }

    if (!orgId) {
      console.warn('⚠️ No orgId available, skipping students load');
      setStudents([]);
      return [];
    }

    try {
      if (showLoading) setIsLoading(true);
      setError(null);

      const classIds = classes.map(cls => cls.id);
      console.log('Loading students for classes:', classIds, 'Org ID:', orgId);

      // Fetch all classes in parallel
      const fetchPromises = classIds.map(classId =>
        fetchStudentsForClass(classId, orgId, classes)
      );

      const results = await Promise.allSettled(fetchPromises);
      const allStudents: Student[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allStudents.push(...result.value);
          console.log(`✅ Loaded ${result.value.length} student(s) for class ${classIds[index]}`);
        } else {
          console.error(`❌ Failed to load students for class ${classIds[index]}:`, result.reason);
        }
      });

      setStudents(allStudents);
      console.log(`✅ Total students loaded: ${allStudents.length}`);
      saveToCache(allStudents);

      return allStudents;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load students';
      setError(errorMessage);
      console.error('❌ Error loading students:', err);

      // Try to use cache on error
      const cachedStudents = loadFromCache();
      if (cachedStudents) {
        setStudents(cachedStudents);
        console.log('📦 Using cached students data due to error');
      }

      return [];
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [classes, orgId, fetchStudentsForClass, saveToCache, loadFromCache]);

  // Refetch function
  const refetch = useCallback(async () => {
    return fetchStudents(true);
  }, [fetchStudents]);

  // Load students when classes or orgId change
  useEffect(() => {
    if (classes.length === 0 || !orgId) {
      setStudents([]);
      return;
    }

    // Try cache first
    const cachedStudents = loadFromCache();
    if (cachedStudents && cachedStudents.length > 0) {
      setStudents(cachedStudents);
    }

    // Always fetch fresh data in background
    fetchStudents(false);
  }, [classes.length, orgId, loadFromCache, fetchStudents]);

  return {
    students,
    isLoading,
    error,
    refetch,
  };
}

