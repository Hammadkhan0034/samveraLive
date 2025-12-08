'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Edit, GraduationCap, Users } from 'lucide-react';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { getInitials, formatDate } from '@/lib/utils/studentUtils';

interface Teacher {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  phone?: string | null;
  address?: string | null;
  org_id: string;
  is_active: boolean;
  role: string;
  created_at: string;
  last_login_at?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  gender?: string | null;
  dob?: string | null;
  status?: string | null;
  education_level?: string | null;
  union_name?: string | null;
}

interface TeacherHeaderProps {
  teacher: Teacher;
  backHref: string;
  totalClasses?: number;
  totalStudents?: number;
  onEditClick?: (teacherId: string) => void;
  className?: string;
}

/**
 * Reusable teacher header component with avatar, basic info, and quick actions
 */
export function TeacherHeader({
  teacher,
  backHref,
  totalClasses = 0,
  totalStudents = 0,
  onEditClick,
  className = '',
}: TeacherHeaderProps) {
  const router = useRouter();

  // Calculate derived values
  const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email || 'Unknown Teacher';
  const firstName = teacher.first_name || '';
  const lastName = teacher.last_name || '';
  const avatarUrl = teacher.avatar_url || null;
  const initials = getInitials(firstName, lastName);

  const getGenderIcon = (gender: string | null | undefined) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return '♂';
      case 'female':
        return '♀';
      case 'other':
        return '⚧';
      default:
        return null;
    }
  };

  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick(teacher.id);
    } else {
      // Default behavior: navigate to edit page (if exists)
      // For now, just navigate back to staff page
      router.push(backHref);
    }
  };

  return (
    <div className={`rounded-ds-lg bg-white dark:bg-slate-800 shadow-ds-card p-ds-md md:p-ds-lg ${className}`}>
      <PageHeader
        title={teacherName}
        subtitle={`Teacher ID: ${teacher.id.slice(0, 8)}...`}
        showBackButton={true}
        backHref={backHref}
        showProfileSwitcher={false}
      />
      
      <div className="mt-ds-md flex flex-col md:flex-row md:items-end md:justify-between gap-ds-md">
        {/* Avatar and Basic Info */}
        <div className="flex items-end gap-ds-md">
          <div className="relative">
            {avatarUrl ? (
              <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white shadow-ds-card">
                <Image
                  src={avatarUrl}
                  alt={teacherName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-ds-surface-card border-4 border-white shadow-ds-card flex items-center justify-center">
                <span className="text-ds-h1 md:text-[40px] font-bold text-ds-text-primary">
                  {initials}
                </span>
              </div>
            )}
            {/* Status Badge */}
            <div 
              className={`absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 rounded-full border-4 border-white ${
                teacher.is_active !== false ? 'bg-green-500' : 'bg-red-500'
              }`} 
              title={teacher.is_active !== false ? 'Active' : 'Inactive'} 
            />
          </div>

          <div className="pb-2">
            <div className="flex flex-wrap items-center gap-3">
              {totalClasses > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  <GraduationCap className="w-4 h-4 text-mint-200" />
                  {totalClasses} {totalClasses === 1 ? 'Class' : 'Classes'}
                </span>
              )}
              {totalStudents > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  <Users className="w-4 h-4 text-mint-200" />
                  {totalStudents} {totalStudents === 1 ? 'Student' : 'Students'}
                </span>
              )}
              {getGenderIcon(teacher.gender) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  {getGenderIcon(teacher.gender)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleEditClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-ds-md bg-mint-200 hover:bg-mint-300 text-ds-text-primary text-ds-body font-medium transition-colors"
            aria-label="Edit teacher"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
