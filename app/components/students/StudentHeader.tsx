'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Edit, GraduationCap } from 'lucide-react';
import { PageHeader } from '@/app/components/shared/PageHeader';
import type { Student } from '@/lib/types/attendance';
import { 
  getStudentName, 
  calculateAge, 
  getInitials
} from '@/lib/utils/studentUtils';

interface StudentHeaderProps {
  student: Student;
  backHref: string;
  onEditClick?: (studentId: string) => void;
  className?: string;
}

/**
 * Reusable student header component with avatar, basic info, and quick actions
 */
export function StudentHeader({
  student,
  backHref,
  onEditClick,
  className = '',
}: StudentHeaderProps) {
  const router = useRouter();

  // Calculate derived values
  const studentName = getStudentName(student);
  const age = calculateAge(student.users?.dob || student.dob);
  const firstName = student.users?.first_name || student.first_name || '';
  const lastName = student.users?.last_name || student.last_name || '';
  const avatarUrl = student.users?.avatar_url || null;
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
      onEditClick(student.id);
    } else {
      // Default behavior: navigate to edit page
      router.push(`/dashboard/principal/students/add?id=${student.id}`);
    }
  };

  return (
    <div className={`rounded-ds-lg bg-white shadow-ds-card p-ds-md md:p-ds-lg ${className}`}>
      <PageHeader
        title={studentName}
        subtitle={`Student ID: ${student.id.slice(0, 8)}...`}
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
                  alt={studentName}
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
                student.users?.is_active !== false ? 'bg-green-500' : 'bg-red-500'
              }`} 
              title={student.users?.is_active !== false ? 'Active' : 'Inactive'} 
            />
          </div>

          <div className="pb-2">
            <div className="flex flex-wrap items-center gap-3">
              {student.classes?.name && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  <GraduationCap className="w-4 h-4 text-mint-200" />
                  {student.classes.name}
                </span>
              )}
              {age !== null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  {age} years old
                </span>
              )}
              {getGenderIcon(student.users?.gender || student.gender) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  {getGenderIcon(student.users?.gender || student.gender)}
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
            aria-label="Edit student"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
