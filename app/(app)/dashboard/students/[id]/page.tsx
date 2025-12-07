'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Edit, 
  Copy, 
  Check, 
  MapPin, 
  Lock, 
  Unlock,
  Phone,
  Mail,
  GraduationCap,
  Users,
  Calendar,
  Shield,
  AlertTriangle,
  User,
  Clock
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { PageHeader } from '@/app/components/shared/PageHeader';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import EmptyState from '@/app/components/EmptyState';
import type { Student, GuardianRelation } from '@/lib/types/attendance';
import { 
  getStudentName, 
  calculateAge, 
  formatDate, 
  formatRelativeTime, 
  maskSSN,
  getInitials
} from '@/lib/utils/studentUtils';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import TeacherPageLayout from '@/app/components/shared/TeacherPageLayout';
import GuardianPageLayout from '@/app/components/shared/GuardianPageLayout';

interface StudentDetails extends Student {
  guardians?: GuardianRelation[];
}

export default function StudentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const { t } = useLanguage();
  const studentId = params?.id as string;

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [decryptedFields, setDecryptedFields] = useState<Set<string>>(new Set());
  const [showSSN, setShowSSN] = useState(false);

  // Determine user role for layout
  const userRole = session?.user?.user_metadata?.activeRole || 
                  (session?.user?.user_metadata?.roles?.[0] as string) || 
                  'guardian';

  const loadStudent = useCallback(async () => {
    if (!studentId) {
      setError('Student ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/students?id=${encodeURIComponent(studentId)}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view this student');
        }
        if (response.status === 404) {
          throw new Error('Student not found');
        }
        throw new Error(`Failed to load student: ${response.status}`);
      }

      const data = await response.json();
      const studentData = data.student || data.students?.[0];

      if (!studentData) {
        throw new Error('Student not found');
      }

      setStudent(studentData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load student';
      setError(errorMessage);
      console.error('Error loading student:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadStudent();
  }, [loadStudent]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleDecrypt = (fieldName: string) => {
    setDecryptedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return newSet;
    });
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

  const getLanguageFlag = (language: string | null | undefined) => {
    switch (language?.toLowerCase()) {
      case 'english':
      case 'en':
        return '🇬🇧';
      case 'icelandic':
      case 'is':
        return '🇮🇸';
      default:
        return '🌐';
    }
  };

  const getRoleLayout = () => {
    switch (userRole) {
      case 'principal':
        return PrincipalPageLayout;
      case 'teacher':
        return TeacherPageLayout;
      case 'guardian':
        return GuardianPageLayout;
      default:
        return PrincipalPageLayout;
    }
  };

  const Layout = getRoleLayout();

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <LoadingSkeleton type="cards" />
          <LoadingSkeleton type="cards" />
          <LoadingSkeleton type="cards" />
        </div>
      </Layout>
    );
  }

  if (error || !student) {
    return (
      <Layout>
        <EmptyState
          icon={User}
          title={error || 'Student not found'}
          description="The student you're looking for doesn't exist or you don't have permission to view it."
        />
      </Layout>
    );
  }

  const studentName = getStudentName(student);
  const age = calculateAge(student.users?.dob || student.dob);
  const firstName = student.users?.first_name || student.first_name || '';
  const lastName = student.users?.last_name || student.last_name || '';
  const avatarUrl = student.users?.avatar_url || null;
  const initials = getInitials(firstName, lastName);

  const backHref = userRole === 'principal' 
    ? '/dashboard/principal/students'
    : userRole === 'teacher'
    ? '/dashboard/teacher/students'
    : '/dashboard/guardian';

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header Section */}
        <div className="relative rounded-ds-xl bg-gradient-to-br from-mint-200 via-[#C5E8D5] to-pale-blue p-6 md:p-8 text-ds-text-primary shadow-ds-lg overflow-hidden">
          <div className="absolute inset-0 bg-black/5"></div>
          <div className="relative z-10">
            <PageHeader
              title={studentName}
              subtitle={`Student ID: ${student.id.slice(0, 8)}...`}
              showBackButton={true}
              backHref={backHref}
              showProfileSwitcher={false}
              className="text-ds-text-primary"
            />
            
            <div className="mt-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              {/* Avatar and Basic Info */}
              <div className="flex items-end gap-6">
                <div className="relative">
                  {avatarUrl ? (
                    <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white/30 shadow-ds-lg">
                      <Image
                        src={avatarUrl}
                        alt={studentName}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/40 backdrop-blur-sm border-4 border-white/50 shadow-ds-lg flex items-center justify-center">
                      <span className="text-4xl md:text-5xl font-bold text-ds-text-primary">
                        {initials}
                      </span>
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className={`absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 rounded-full border-4 border-white ${
                    student.users?.is_active !== false ? 'bg-green-500' : 'bg-red-500'
                  }`} title={student.users?.is_active !== false ? 'Active' : 'Inactive'} />
                </div>

                <div className="pb-2">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    {student.classes?.name && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/40 backdrop-blur-sm text-sm font-medium text-ds-text-primary">
                        <GraduationCap className="w-4 h-4" />
                        {student.classes.name}
                      </span>
                    )}
                    {age !== null && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/40 backdrop-blur-sm text-sm font-medium text-ds-text-primary">
                        {age} years old
                      </span>
                    )}
                    {getGenderIcon(student.users?.gender || student.gender) && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/40 backdrop-blur-sm text-sm font-medium text-ds-text-primary">
                        {getGenderIcon(student.users?.gender || student.gender)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push(`/dashboard/principal/students/add?id=${student.id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-ds-md bg-pale-blue hover:bg-[#B8D4F0] text-ds-text-primary font-medium transition-all duration-200 hover:scale-105"
                  aria-label="Edit student"
                >
                  <Edit className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              </div>
            </div>
          </div>
        </div>

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
                      {studentName}
                    </p>
                    <button
                      onClick={() => handleCopy(studentName, 'name')}
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
                    Date of Birth
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(student.users?.dob || student.dob)}
                    {age !== null && ` (${age} years old)`}
                  </p>
                </div>

                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Gender
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {getGenderIcon(student.users?.gender || student.gender) || 'Not specified'}
                    {getGenderIcon(student.users?.gender || student.gender) && ' '}
                    {(student.users?.gender || student.gender || '').charAt(0).toUpperCase() + 
                     (student.users?.gender || student.gender || '').slice(1)}
                  </p>
                </div>

                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Social Security Number
                  </label>
                  <div className="flex items-center gap-2">
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-mono">
                      {showSSN ? (student.users?.ssn || 'Not provided') : maskSSN(student.users?.ssn)}
                    </p>
                    <button
                      onClick={() => setShowSSN(!showSSN)}
                      className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline"
                    >
                      {showSSN ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Address
                  </label>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                        {student.users?.address || student.address || 'Not provided'}
                      </p>
                      {student.users?.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(student.users.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          View on Map
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Language Preference
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 flex items-center gap-2">
                    <span className="text-xl">{getLanguageFlag(student.student_language)}</span>
                    {(student.student_language || 'Not specified').charAt(0).toUpperCase() + 
                     (student.student_language || 'Not specified').slice(1)}
                  </p>
                </div>

                {student.users?.bio && (
                  <div className="md:col-span-2">
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Bio
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {student.users.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Academic Information Card */}
            <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <GraduationCap className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                  Academic Details
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Current Class
                  </label>
                  {student.classes?.name ? (
                    <a
                      href={`/dashboard/principal/classes/${student.class_id}`}
                      className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline font-medium"
                    >
                      {student.classes.name}
                    </a>
                  ) : (
                    <p className="text-ds-body text-ds-text-muted dark:text-slate-400">No class assigned</p>
                  )}
                </div>

                {student.classes?.code && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Class Code
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-mono">
                      {student.classes.code}
                    </p>
                  </div>
                )}

                {student.registration_time && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Registration Date
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {formatDate(student.registration_time)}
                    </p>
                  </div>
                )}

                {student.start_date && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Start Date
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {formatDate(student.start_date)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Student Language
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 flex items-center gap-2">
                    <span className="text-xl">{getLanguageFlag(student.student_language)}</span>
                    {(student.student_language || 'Not specified').charAt(0).toUpperCase() + 
                     (student.student_language || 'Not specified').slice(1)}
                  </p>
                </div>

                {student.barngildi !== null && student.barngildi !== undefined && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                      Barngildi
                      <span className="group relative">
                        <span className="text-ds-tiny text-slate-400 cursor-help">ℹ️</span>
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-ds-tiny rounded-ds-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Barngildi is a weight/importance value used in the Icelandic school system
                        </span>
                      </span>
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-medium">
                      {student.barngildi.toFixed(1)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sensitive Information Card */}
            <div className="rounded-ds-lg bg-pale-peach dark:bg-pale-peach/20 border-2 border-pale-peach/60 dark:border-pale-peach/40 shadow-ds-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-[#D4A08A] dark:text-[#E8B8A0]" />
                <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                  Medical & Emergency Information
                </h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-[#B87A5F] dark:text-[#D4A08A] mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Medical Notes
                  </label>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      {decryptedFields.has('medical_notes') ? (
                        <p className="text-ds-body text-ds-text-primary dark:text-slate-100 whitespace-pre-wrap">
                          {student.medical_notes_encrypted || 'No medical notes'}
                        </p>
                      ) : (
                        <p className="text-ds-body text-slate-400 dark:text-slate-500 italic">
                          Encrypted - Click to decrypt
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleDecrypt('medical_notes')}
                      className="p-2 rounded-ds-sm hover:bg-pale-peach/60 dark:hover:bg-pale-peach/30 transition-colors"
                      aria-label={decryptedFields.has('medical_notes') ? 'Encrypt' : 'Decrypt'}
                    >
                      {decryptedFields.has('medical_notes') ? (
                        <Lock className="w-4 h-4 text-[#D4A08A] dark:text-[#E8B8A0]" />
                      ) : (
                        <Unlock className="w-4 h-4 text-[#D4A08A] dark:text-[#E8B8A0]" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-[#B87A5F] dark:text-[#D4A08A] mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Allergies
                  </label>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      {decryptedFields.has('allergies') ? (
                        <p className={`text-ds-body ${
                          student.allergies_encrypted 
                            ? 'text-red-600 dark:text-red-400 font-medium' 
                            : 'text-ds-text-primary dark:text-slate-100'
                        } whitespace-pre-wrap`}>
                          {student.allergies_encrypted || 'No known allergies'}
                        </p>
                      ) : (
                        <p className="text-ds-body text-slate-400 dark:text-slate-500 italic">
                          Encrypted - Click to decrypt
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleDecrypt('allergies')}
                      className="p-2 rounded-ds-sm hover:bg-pale-peach/60 dark:hover:bg-pale-peach/30 transition-colors"
                      aria-label={decryptedFields.has('allergies') ? 'Encrypt' : 'Decrypt'}
                    >
                      {decryptedFields.has('allergies') ? (
                        <Lock className="w-4 h-4 text-[#D4A08A] dark:text-[#E8B8A0]" />
                      ) : (
                        <Unlock className="w-4 h-4 text-[#D4A08A] dark:text-[#E8B8A0]" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-[#B87A5F] dark:text-[#D4A08A] mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    Emergency Contact
                  </label>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      {decryptedFields.has('emergency_contact') ? (
                        <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                          {student.emergency_contact_encrypted || 'Not provided'}
                        </p>
                      ) : (
                        <p className="text-ds-body text-slate-400 dark:text-slate-500 italic">
                          Encrypted - Click to decrypt
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleDecrypt('emergency_contact')}
                      className="p-2 rounded-ds-sm hover:bg-pale-peach/60 dark:hover:bg-pale-peach/30 transition-colors"
                      aria-label={decryptedFields.has('emergency_contact') ? 'Encrypt' : 'Decrypt'}
                    >
                      {decryptedFields.has('emergency_contact') ? (
                        <Lock className="w-4 h-4 text-[#D4A08A] dark:text-[#E8B8A0]" />
                      ) : (
                        <Unlock className="w-4 h-4 text-[#D4A08A] dark:text-[#E8B8A0]" />
                      )}
                    </button>
                  </div>
                </div>

                {student.updated_at && (
                  <p className="text-ds-tiny text-[#B87A5F] dark:text-[#D4A08A] mt-4">
                    Last updated: {formatDate(student.updated_at)}
                  </p>
                )}
              </div>
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
                    student.users?.is_active !== false
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      student.users?.is_active !== false ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {student.users?.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {student.users?.is_staff && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Staff Status
                    </label>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-ds-small font-medium">
                      Staff Member
                    </span>
                  </div>
                )}

                {student.users?.role && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Role
                    </label>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pale-blue text-ds-text-primary dark:bg-pale-blue/30 dark:text-ds-text-primary text-ds-small font-medium capitalize">
                      {student.users.role}
                    </span>
                  </div>
                )}

                {student.users?.last_login_at && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last Login
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {formatRelativeTime(student.users.last_login_at)}
                    </p>
                  </div>
                )}

                {student.created_at && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Account Created
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {formatDate(student.created_at)}
                    </p>
                  </div>
                )}

                {student.users?.theme && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Theme Preference
                    </label>
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100 capitalize flex items-center gap-2">
                      {student.users.theme === 'dark' ? '🌙' : '☀️'}
                      {student.users.theme}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Guardians Card */}
            <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                  Guardians & Contacts
                </h2>
              </div>
              
              {student.guardians && student.guardians.length > 0 ? (
                <div className="space-y-3">
                  {student.guardians.map((guardian) => {
                    const guardianUser = Array.isArray(guardian.users) ? guardian.users[0] : guardian.users;
                    const guardianName = guardianUser
                      ? `${guardianUser.first_name || ''} ${guardianUser.last_name || ''}`.trim()
                      : 'Unknown Guardian';
                    const guardianEmail = guardianUser?.email;

                    return (
                      <div
                        key={guardian.id}
                        className="flex items-center gap-3 p-3 rounded-ds-md bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-pale-blue dark:bg-pale-blue/30 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-mint-500 dark:text-mint-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-ds-body font-medium text-ds-text-primary dark:text-slate-100 truncate">
                            {guardianName}
                          </p>
                          {guardian.relation && (
                            <p className="text-ds-small text-ds-text-muted dark:text-slate-400">
                              {guardian.relation}
                            </p>
                          )}
                          {guardianEmail && (
                            <div className="flex items-center gap-2 mt-1">
                              <a
                                href={`mailto:${guardianEmail}`}
                                className="text-ds-tiny text-mint-500 dark:text-mint-400 hover:underline flex items-center gap-1"
                              >
                                <Mail className="w-3 h-3" />
                                Email
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-ds-body text-ds-text-muted dark:text-slate-400">
                  No guardians assigned
                </p>
              )}
            </div>

            {/* Quick Statistics Card */}
            <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
              <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-4">
                Quick Statistics
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Guardians</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {student.guardians?.length || 0}
                  </span>
                </div>

                {student.registration_time && (
                  <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                      <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Days Since Registration</span>
                    </div>
                    <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                      {Math.floor((new Date().getTime() - new Date(student.registration_time).getTime()) / (1000 * 60 * 60 * 24))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
