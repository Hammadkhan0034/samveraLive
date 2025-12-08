'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Copy, 
  Check, 
  MapPin, 
  Lock,
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
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import EmptyState from '@/app/components/EmptyState';
import { StudentHeader } from '@/app/components/students/StudentHeader';
import type { Student, GuardianRelation } from '@/lib/types/attendance';
import { 
  getStudentName, 
  calculateAge, 
  formatDate, 
  formatRelativeTime, 
  maskSSN
} from '@/lib/utils/studentUtils';
import { useLanguage } from '@/lib/contexts/LanguageContext';

interface StudentDetails extends Student {
  guardians?: GuardianRelation[];
}

interface StudentDetailsProps {
  studentId: string;
  backHref?: string;
}

/**
 * Reusable Student Details component that displays comprehensive student information.
 * Manages its own state and data fetching, without any layout wrapper.
 */
export function StudentDetails({ studentId, backHref }: StudentDetailsProps) {
  const { t } = useLanguage();
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSSN, setShowSSN] = useState(false);

  const loadStudent = useCallback(async () => {
    if (!studentId) {
      setError(t.student_details_student_id_required);
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
          throw new Error(t.student_details_permission_denied);
        }
        if (response.status === 404) {
          throw new Error(t.student_details_not_found);
        }
        throw new Error(t.student_details_load_error.replace('{status}', response.status.toString()));
      }

      const data = await response.json();
      const studentData = data.student || data.students?.[0];

      if (!studentData) {
        throw new Error(t.student_details_not_found);
      }

      setStudent(studentData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.student_details_load_error.replace('{status}', '');
      setError(errorMessage);
      console.error('Error loading student:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId, t]);

  useEffect(() => {
    loadStudent();
  }, [loadStudent]);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="cards" />
        <LoadingSkeleton type="cards" />
        <LoadingSkeleton type="cards" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <EmptyState
        icon={User}
        title={error || t.student_details_not_found}
        description={t.student_details_not_found_description}
      />
    );
  }

  const studentName = getStudentName(student);
  const age = calculateAge(student.users?.dob || student.dob);
  const defaultBackHref = backHref || '/dashboard';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <StudentHeader
        student={student}
        backHref={defaultBackHref}
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
                {t.student_details_personal_info}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_full_name}
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-medium">
                    {studentName}
                  </p>
                  <button
                    onClick={() => handleCopy(studentName, 'name')}
                    className="p-1.5 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label={t.student_details_copy_name}
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
                  {t.student_details_date_of_birth}
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                  {formatDate(student.users?.dob || student.dob)}
                  {age !== null && ` (${age} ${t.student_details_years_old})`}
                </p>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_gender}
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                  {getGenderIcon(student.users?.gender || student.gender) || t.student_details_not_specified}
                  {getGenderIcon(student.users?.gender || student.gender) && ' '}
                  {(student.users?.gender || student.gender || '').charAt(0).toUpperCase() + 
                   (student.users?.gender || student.gender || '').slice(1)}
                </p>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_ssn}
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-mono">
                    {showSSN ? (student.users?.ssn || t.student_details_not_provided) : maskSSN(student.users?.ssn)}
                  </p>
                  <button
                    onClick={() => setShowSSN(!showSSN)}
                    className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline"
                  >
                    {showSSN ? t.student_details_hide : t.student_details_show}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_address}
                </label>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {student.users?.address || t.student_details_not_provided}
                    </p>
                    {student.users?.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(student.users.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        {t.student_details_view_on_map}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_language_preference}
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100 flex items-center gap-2">
                  <span className="text-xl">{getLanguageFlag(student.student_language)}</span>
                  {(student.student_language || t.student_details_not_specified).charAt(0).toUpperCase() + 
                   (student.student_language || t.student_details_not_specified).slice(1)}
                </p>
              </div>

              {student.users?.bio && (
                <div className="md:col-span-2">
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.student_details_bio}
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
                {t.student_details_academic_details}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_current_class}
                </label>
                {student.classes?.name ? (
                  <a
                    href={`/dashboard/principal/classes/${student.class_id}`}
                    className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline font-medium"
                  >
                    {student.classes.name}
                  </a>
                ) : (
                  <p className="text-ds-body text-ds-text-muted dark:text-slate-400">{t.student_details_no_class_assigned}</p>
                )}
              </div>

              {student.classes?.code && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.student_details_class_code}
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-mono">
                    {student.classes.code}
                  </p>
                </div>
              )}

              {student.registration_time && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_registration_date}
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(student.registration_time)}
                  </p>
                </div>
              )}

              {student.start_date && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.student_details_start_date}
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(student.start_date)}
                  </p>
                </div>
              )}

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_student_language}
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100 flex items-center gap-2">
                  <span className="text-xl">{getLanguageFlag(student.student_language)}</span>
                  {(student.student_language || t.student_details_not_specified).charAt(0).toUpperCase() + 
                   (student.student_language || t.student_details_not_specified).slice(1)}
                </p>
              </div>

              {student.barngildi !== null && student.barngildi !== undefined && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    {t.student_details_barngildi}
                    <span className="group relative">
                      <span className="text-ds-tiny text-slate-400 cursor-help">ℹ️</span>
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-ds-tiny rounded-ds-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {t.student_details_barngildi_tooltip}
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
                {t.student_details_medical_emergency}
              </h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-[#B87A5F] dark:text-[#D4A08A] mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {t.student_details_medical_notes}
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100 whitespace-pre-wrap">
                  {student.medical_notes_encrypted || t.student_details_no_medical_notes}
                </p>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-[#B87A5F] dark:text-[#D4A08A] mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t.student_details_allergies}
                </label>
                <p className={`text-ds-body ${
                  student.allergies_encrypted 
                    ? 'text-red-600 dark:text-red-400 font-medium' 
                    : 'text-ds-text-primary dark:text-slate-100'
                } whitespace-pre-wrap`}>
                  {student.allergies_encrypted || t.student_details_no_known_allergies}
                </p>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-[#B87A5F] dark:text-[#D4A08A] mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {t.student_details_emergency_contact}
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                  {student.emergency_contact_encrypted || t.student_details_not_provided}
                </p>
              </div>

              {student.updated_at && (
                <p className="text-ds-tiny text-[#B87A5F] dark:text-[#D4A08A] mt-4">
                  {t.student_details_last_updated} {formatDate(student.updated_at)}
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
              {t.student_details_status_overview}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.student_details_account_status}
                </label>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-ds-small font-medium ${
                  student.users?.is_active !== false
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    student.users?.is_active !== false ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {student.users?.is_active !== false ? t.student_details_active : t.student_details_inactive}
                </span>
              </div>

              {student.users?.is_staff && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.student_details_staff_status}
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-ds-small font-medium">
                    {t.student_details_staff_member}
                  </span>
                </div>
              )}

              {student.users?.role && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.student_details_role}
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
                    {t.student_details_last_login}
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
                    {t.student_details_account_created}
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(student.created_at)}
                  </p>
                </div>
              )}

              {student.users?.theme && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.student_details_theme_preference}
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
                {t.student_details_guardians_contacts}
              </h2>
            </div>
            
            {student.guardians && student.guardians.length > 0 ? (
              <div className="space-y-3">
                {student.guardians.map((guardian) => {
                  const guardianUser = Array.isArray(guardian.users) ? guardian.users[0] : guardian.users;
                  const guardianName = guardianUser
                    ? `${guardianUser.first_name || ''} ${guardianUser.last_name || ''}`.trim()
                    : t.student_details_unknown_guardian;
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
                              {t.student_details_email}
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
                {t.student_details_no_guardians_assigned}
              </p>
            )}
          </div>

          {/* Quick Statistics Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-4">
              {t.student_details_quick_statistics}
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                  <span className="text-ds-small text-ds-text-muted dark:text-slate-400">{t.student_details_guardians}</span>
                </div>
                <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                  {student.guardians?.length || 0}
                </span>
              </div>

              {student.registration_time && (
                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">{t.student_details_days_since_registration}</span>
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
  );
}
