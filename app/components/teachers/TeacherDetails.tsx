'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Copy, 
  Check, 
  MapPin, 
  Phone,
  Mail,
  GraduationCap,
  Users,
  Calendar,
  Shield,
  User,
  Clock,
  BookOpen,
  Briefcase
} from 'lucide-react';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import EmptyState from '@/app/components/EmptyState';
import { TeacherHeader } from '@/app/components/teachers/TeacherHeader';
import { 
  formatDate, 
  formatRelativeTime
} from '@/lib/utils/studentUtils';

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
  updated_at: string;
  education_level?: string | null;
  union_name?: string | null;
}

interface Class {
  id: string;
  name: string;
  code: string | null;
  student_count: number;
  created_at: string;
  updated_at: string;
}

interface TeacherDetailsData {
  teacher: Teacher;
  classes: Class[];
  total_students: number;
  total_classes: number;
}

interface TeacherDetailsProps {
  teacherId: string;
  backHref?: string;
}

/**
 * Reusable Teacher Details component that displays comprehensive teacher information.
 * Manages its own state and data fetching, without any layout wrapper.
 */
export function TeacherDetails({ teacherId, backHref }: TeacherDetailsProps) {
  const [teacherData, setTeacherData] = useState<TeacherDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadTeacher = useCallback(async () => {
    if (!teacherId) {
      setError('Teacher ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/teachers/${encodeURIComponent(teacherId)}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view this teacher');
        }
        if (response.status === 404) {
          throw new Error('Teacher not found');
        }
        throw new Error(`Failed to load teacher: ${response.status}`);
      }

      const data = await response.json();
      setTeacherData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load teacher';
      setError(errorMessage);
      console.error('Error loading teacher:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    loadTeacher();
  }, [loadTeacher]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="cards" />
        <LoadingSkeleton type="cards" />
        <LoadingSkeleton type="cards" />
      </div>
    );
  }

  if (error || !teacherData) {
    return (
      <EmptyState
        icon={User}
        title={error || 'Teacher not found'}
        description="The teacher you're looking for doesn't exist or you don't have permission to view it."
      />
    );
  }

  const { teacher, classes, total_students, total_classes } = teacherData;
  const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email || 'Unknown Teacher';
  const defaultBackHref = backHref || '/dashboard/principal/staff';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <TeacherHeader
        teacher={teacher}
        backHref={defaultBackHref}
        totalClasses={total_classes}
        totalStudents={total_students}
      />

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
        {/* Left Column - Primary Information */}
        <div className="space-y-6">
          {/* Personal Information Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-mint-500 dark:text-mint-400" />
              <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                Personal Information
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Full Name
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-medium">
                    {teacherName}
                  </p>
                  <button
                    onClick={() => handleCopy(teacherName, 'name')}
                    className="p-1.5 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Copy name"
                  >
                    {copiedField === 'name' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {teacher.email}
                  </p>
                  <button
                    onClick={() => handleCopy(teacher.email, 'email')}
                    className="p-1.5 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Copy email"
                  >
                    {copiedField === 'email' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {teacher.phone && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Phone
                  </label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {teacher.phone}
                    </p>
                  </div>
                </div>
              )}

              {teacher.dob && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Date of Birth
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(teacher.dob)}
                  </p>
                </div>
              )}

              {teacher.gender && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Gender
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {getGenderIcon(teacher.gender) || 'Not specified'}
                    {getGenderIcon(teacher.gender) && ' '}
                    {teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1)}
                  </p>
                </div>
              )}

              {teacher.address && (
                <div className="md:col-span-2">
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Address
                  </label>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                        {teacher.address}
                      </p>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(teacher.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        View on Map
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {teacher.bio && (
                <div className="md:col-span-2">
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Bio
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {teacher.bio}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Professional Information Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Briefcase className="w-5 h-5 text-mint-500 dark:text-mint-400" />
              <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                Professional Information
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacher.education_level && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Education Level
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {teacher.education_level}
                  </p>
                </div>
              )}

              {teacher.union_name && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Union Name
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {teacher.union_name}
                  </p>
                </div>
              )}

              {!teacher.education_level && !teacher.union_name && (
                <div className="md:col-span-2">
                  <p className="text-ds-body text-ds-text-muted dark:text-slate-400">
                    No professional information available
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Classes Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap className="w-5 h-5 text-mint-500 dark:text-mint-400" />
              <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                Assigned Classes
              </h2>
            </div>
            
            {classes.length > 0 ? (
              <div className="space-y-3">
                {classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-4 rounded-ds-md bg-input-fill dark:bg-ds-surface-card border border-input-stroke dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/dashboard/principal/classes/${cls.id}`}
                        className="text-ds-body font-medium text-mint-500 dark:text-mint-400 hover:underline"
                      >
                        {cls.name}
                      </a>
                      {cls.code && (
                        <p className="text-ds-small text-ds-text-muted dark:text-slate-400 mt-1">
                          Code: {cls.code}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-ds-body font-semibold text-ds-text-primary dark:text-slate-100">
                        {cls.student_count} {cls.student_count === 1 ? 'student' : 'students'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ds-body text-ds-text-muted dark:text-slate-400">
                No classes assigned
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Secondary Information */}
        <div className="space-y-6">
          {/* Status Overview Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-4">
              Status Overview
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Account Status
                </label>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-ds-small font-medium ${
                  teacher.is_active !== false
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    teacher.is_active !== false ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {teacher.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>

              {teacher.status && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Current Status
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pale-blue text-ds-text-primary dark:bg-pale-blue/30 dark:text-ds-text-primary text-ds-small font-medium capitalize">
                    {teacher.status.replace('_', ' ')}
                  </span>
                </div>
              )}

              {teacher.role && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Role
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pale-blue text-ds-text-primary dark:bg-pale-blue/30 dark:text-ds-text-primary text-ds-small font-medium capitalize">
                    {teacher.role}
                  </span>
                </div>
              )}

              {teacher.last_login_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last Login
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatRelativeTime(teacher.last_login_at)}
                  </p>
                </div>
              )}

              {teacher.created_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Account Created
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(teacher.created_at)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Statistics Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-4">
              Quick Statistics
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                  <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Classes</span>
                </div>
                <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                  {total_classes}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                  <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Total Students</span>
                </div>
                <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                  {total_students}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
