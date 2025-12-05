'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Plus, Filter, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StudentTable } from '@/app/components/shared/StudentTable';
import { DeleteConfirmationModal } from '@/app/components/shared/DeleteConfirmationModal';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { StudentWithRelations, ClassWithTeachers, FilterOption } from '@/lib/types/students';

function StudentsPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const { sidebarRef } = usePrincipalPageLayout();

  // Student states - initialize with cached data
  const [students, setStudents] = useState<StudentWithRelations[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('students_cache');
      return cached ? JSON.parse(cached) : [];
    }
    return [];
  });
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [isDeleteStudentModalOpen, setIsDeleteStudentModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  // Classes states (needed for student form)
  const [classes, setClasses] = useState<ClassWithTeachers[]>([]);

  // Filter states
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset to page 1 when search query or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedClassFilter]);

  // Ref for filter dropdown to handle click outside
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterDropdownOpen &&
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFilterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  // Load students
  const loadStudents = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoadingStudents(true);
      }
      setStudentError(null);

      const res = await fetch(`/api/students?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || `Failed with ${res.status}`);

      const studentsList = json.students || [];
      setStudents(studentsList);
      
      // Cache the data for instant loading
      if (typeof window !== 'undefined') {
        localStorage.setItem('students_cache', JSON.stringify(studentsList));
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load students';
      console.error('❌ Error loading students:', errorMessage);
      setStudentError(errorMessage);
    } finally {
      if (showLoading) {
        setLoadingStudents(false);
      }
    }
  }, []);

  // Load classes
  const loadClasses = useCallback(async (showLoading = false) => {
    try {
      const response = await fetch(`/api/classes`, { cache: 'no-store' });
      const data = await response.json();

      if (response.ok) {
        const classesData = data.classes || [];
        setClasses(classesData);
      } else {
        console.error('Error loading classes:', data.error);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadStudents();
    loadClasses();
  }, [loadStudents, loadClasses]);

  // Student create now navigates to dedicated page
  const openCreateStudentModal = useCallback(() => {
    router.push('/dashboard/principal/students/add');
  }, [router]);

  const openEditStudentModal = useCallback((student: StudentWithRelations) => {
    router.push(`/dashboard/principal/students/add?id=${encodeURIComponent(student.id)}`);
  }, [router]);

  const openDeleteStudentModal = useCallback((id: string) => {
    setStudentToDelete(id);
    setIsDeleteStudentModalOpen(true);
  }, []);

  const confirmDeleteStudent = useCallback(async () => {
    if (!studentToDelete) return;
    try {
      setStudentError(null);
      setDeletingStudent(true);

      const res = await fetch(`/api/students?id=${encodeURIComponent(studentToDelete)}`, { method: 'DELETE' });
      
      let json: { error?: string } = {};
      try {
        const text = await res.text();
        if (text) {
          json = JSON.parse(text);
        }
      } catch (parseError) {
        console.error('❌ Delete JSON parsing error:', parseError);
      }
      
      if (!res.ok) {
        const errorMsg = json?.error || `Delete failed with status ${res.status}`;
        console.error('❌ Delete API Error:', errorMsg);
        throw new Error(errorMsg);
      }
      setIsDeleteStudentModalOpen(false);
      setStudentToDelete(null);
      await loadStudents(false);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to delete student';
      setStudentError(errorMessage);
    } finally {
      setDeletingStudent(false);
    }
  }, [studentToDelete, loadStudents]);


  // Filter students based on selected class and search
  const filteredStudents = useMemo(() => {
    const byClass = selectedClassFilter === 'all' 
      ? students 
      : students.filter(s => s.class_id === selectedClassFilter);
    
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return byClass;
    
    return byClass.filter((s) => {
      const first = (s.users?.first_name || s.first_name || '').toLowerCase();
      const last = (s.users?.last_name || s.last_name || '').toLowerCase();
      const full = `${first} ${last}`.trim();
      const cls = s.classes?.name ? String(s.classes.name).toLowerCase() : '';
      return first.includes(q) || last.includes(q) || full.includes(q) || cls.includes(q);
    });
  }, [students, selectedClassFilter, debouncedSearchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage]);

  // Get filter options
  const filterOptions = useMemo<FilterOption[]>(() => {
    const options: FilterOption[] = [
      { value: 'all', label: t.all_classes }
    ];
    
    // Add classes to options
    if (classes && classes.length > 0) {
      classes.forEach(cls => {
        options.push({
          value: cls.id,
          label: cls.name || `Class ${cls.id.slice(0, 8)}`
        });
      });
    }
    
    return options;
  }, [classes, t]);

  return (
    <>
      <PageHeader
        title={t.students}
        subtitle={t.students_subtitle}
        headingLevel="h1"
        showMobileMenu={true}
        onMobileMenuClick={() => sidebarRef.current?.open()}
        rightActions={
          <button
            onClick={openCreateStudentModal}
            className="inline-flex items-center gap-2 rounded-ds-md bg-mint-500 px-ds-sm py-2 text-ds-small text-white hover:bg-mint-600 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Plus className="h-4 w-4" /> {t.add_student}
          </button>
        }
      />

      {/* Students Table */}
      <div className="rounded-ds-lg bg-white p-ds-md shadow-ds-card dark:bg-slate-800">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-ds-sm gap-ds-sm">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-auto min-w-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={'Search students...'}
              className="w-full sm:w-48 md:w-64 h-10 sm:h-12 px-ds-sm rounded-full rounded-ds-md bg-input-fill border border-input-stroke text-ds-small text-ds-text-primary focus:outline-none focus:border-mint-200 focus:ring-2 focus:ring-mint-200/20 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-mint-300"
            />
          </div>
          {/* Filter Dropdown */}
          <div className="relative flex-shrink-0" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 rounded-full rounded-ds-md bg-input-fill border border-input-stroke text-ds-small px-3 py-2 h-10 sm:h-12 text-ds-text-primary hover:bg-mint-50 hover:border-mint-200 transition-colors dark:text-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-800 w-full sm:w-auto"
            >
              <Filter className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline truncate">{filterOptions.find(opt => opt.value === selectedClassFilter)?.label || t.all_classes}</span>
              <span className="sm:hidden">{t.all_classes}</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 sm:right-0 left-0 sm:left-auto top-full mt-1 w-full sm:w-48 rounded-ds-md border border-input-stroke dark:border-slate-700 bg-ds-surface-white dark:bg-slate-800 shadow-ds-lg z-50 max-h-60 overflow-y-auto">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedClassFilter(option.value);
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-ds-small text-left hover:bg-mint-50 dark:hover:bg-slate-700 first:rounded-t-ds-md last:rounded-b-ds-md transition-colors ${
                      selectedClassFilter === option.value
                        ? 'bg-mint-100 dark:bg-slate-700 text-mint-700 dark:text-slate-100'
                        : 'text-ds-text-primary dark:text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <StudentTable
          students={paginatedStudents}
          error={studentError}
          onEdit={openEditStudentModal}
          onDelete={openDeleteStudentModal}
          onCreate={openCreateStudentModal}
          translations={{
            students: t.students,
            student_name: t.student_name,
            student_first_name: t.first_name,
            student_last_name: t.last_name,
            student_class: t.student_class,
            student_guardians: t.student_guardians,
            student_dob: t.student_dob,
            student_gender: t.student_gender,
            actions: t.actions,
            create: t.create,
            no_students: t.no_students,
            edit: t.edit,
            delete: t.delete
          }}
        />
        {/* Pagination controls */}
        <div className="mt-ds-sm w-full flex flex-wrap justify-center sm:justify-end gap-ds-xs">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-small text-ds-text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t.prev || 'Prev'}
          </button>
          <div className="flex gap-ds-xs flex-wrap justify-center">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`inline-flex items-center rounded-ds-md px-2 sm:px-3 py-1.5 text-ds-small transition-colors ${currentPage === idx + 1 ? 'bg-mint-500 text-white border border-mint-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' : 'border border-input-stroke bg-input-fill text-ds-text-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 hover:bg-mint-50 hover:border-mint-200 dark:hover:bg-slate-800'}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center rounded-ds-md border border-input-stroke bg-input-fill px-2 sm:px-3 py-1.5 text-ds-small text-ds-text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-mint-50 hover:border-mint-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t.next || 'Next'}
          </button>
        </div>
      </div>

      {/* Delete Student Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteStudentModalOpen}
        onClose={() => setIsDeleteStudentModalOpen(false)}
        onConfirm={confirmDeleteStudent}
        title={t.delete_student}
        message={t.delete_student_confirm}
        loading={deletingStudent}
        error={studentError}
        translations={{
          confirm_delete: t.delete,
          cancel: t.cancel
        }}
        />
    </>
  );
}

export default function StudentsPage() {
  return (
    <PrincipalPageLayout>
      <StudentsPageContent />
    </PrincipalPageLayout>
  );
}