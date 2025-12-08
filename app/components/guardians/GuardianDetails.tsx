'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Copy, 
  Check, 
  MapPin, 
  Phone,
  Mail,
  Users,
  Calendar,
  User,
  Clock,
  GraduationCap
} from 'lucide-react';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import EmptyState from '@/app/components/EmptyState';
import { GuardianHeader } from '@/app/components/guardians/GuardianHeader';
import { 
  getGuardianName, 
  calculateAge, 
  formatDate, 
  formatRelativeTime, 
  maskSSN
} from '@/lib/utils/guardianUtils';
import { getStudentName, calculateAge as calculateStudentAge } from '@/lib/utils/studentUtils';

interface Guardian {
  id: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address?: string | null;
  ssn?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  last_login_at?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  gender?: string | null;
  dob?: string | null;
}

interface Child {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  relation?: string | null;
  class_id?: string | null;
  classes?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

interface GuardianDetailsData {
  guardian: Guardian;
  children: Child[];
}

interface GuardianDetailsProps {
  guardianId: string;
  backHref?: string;
}

/**
 * Reusable Guardian Details component that displays comprehensive guardian information.
 * Manages its own state and data fetching, without any layout wrapper.
 */
export function GuardianDetails({ guardianId, backHref }: GuardianDetailsProps) {
  const [data, setData] = useState<GuardianDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSSN, setShowSSN] = useState(false);

  const loadGuardian = useCallback(async () => {
    if (!guardianId) {
      setError('Guardian ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/guardians?id=${encodeURIComponent(guardianId)}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view this guardian');
        }
        if (response.status === 404) {
          throw new Error('Guardian not found');
        }
        throw new Error(`Failed to load guardian: ${response.status}`);
      }

      const responseData = await response.json();
      const guardianData = responseData.guardian;
      const childrenData = responseData.children || [];

      if (!guardianData) {
        throw new Error('Guardian not found');
      }

      setData({
        guardian: guardianData,
        children: childrenData,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load guardian';
      setError(errorMessage);
      console.error('Error loading guardian:', err);
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  useEffect(() => {
    loadGuardian();
  }, [loadGuardian]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatGender = (gender: string | null | undefined): string => {
    if (!gender) return 'Not specified';
    
    const icon = (() => {
      switch (gender.toLowerCase()) {
        case 'male':
          return '♂';
        case 'female':
          return '♀';
        case 'other':
          return '⚧';
        default:
          return null;
      }
    })();
    
    const capitalized = gender.charAt(0).toUpperCase() + gender.slice(1);
    return icon ? `${icon} ${capitalized}` : capitalized;
  };

  const calculateDaysSince = (dateString: string | null | undefined): number | null => {
    if (!dateString) return null;
    return Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
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

  if (error || !data) {
    return (
      <EmptyState
        icon={User}
        title={error || 'Guardian not found'}
        description="The guardian you're looking for doesn't exist or you don't have permission to view it."
      />
    );
  }

  const { guardian, children } = data;
  const guardianName = getGuardianName(guardian);
  const age = calculateAge(guardian.dob);
  const defaultBackHref = backHref || '/dashboard/principal/guardians';

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <GuardianHeader
        guardian={guardian}
        backHref={defaultBackHref}
        childrenCount={children.length}
      />

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4 md:gap-6">
        {/* Left Column - Primary Information */}
        <div className="space-y-4 md:space-y-6">
          {/* Personal Information Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <User className="w-5 h-5 text-mint-500 dark:text-mint-400" />
              <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                Personal Information
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Full Name
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-medium break-words flex-1 min-w-0">
                    {guardianName}
                  </p>
                  <button
                    onClick={() => handleCopy(guardianName, 'name')}
                    className="p-2 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center flex-shrink-0"
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

              {guardian.dob && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Date of Birth
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(guardian.dob)}
                    {age !== null && ` (${age} years old)`}
                  </p>
                </div>
              )}

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Gender
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                  {formatGender(guardian.gender)}
                </p>
              </div>

              {guardian.ssn && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Social Security Number
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-mono">
                      {showSSN ? guardian.ssn : maskSSN(guardian.ssn)}
                    </p>
                    <button
                      onClick={() => setShowSSN(!showSSN)}
                      className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline px-2 py-1 min-h-[44px] md:min-h-0"
                      aria-label={showSSN ? 'Hide SSN' : 'Show SSN'}
                    >
                      {showSSN ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Address
                </label>
                {guardian.address ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-ds-body text-ds-text-primary dark:text-slate-100 break-words">
                        {guardian.address}
                      </p>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(guardian.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        View on Map
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-ds-body text-ds-text-muted dark:text-slate-400">Not provided</p>
                )}
              </div>

              {guardian.bio && (
                <div className="md:col-span-2">
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Bio
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {guardian.bio}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <Mail className="w-5 h-5 text-mint-500 dark:text-mint-400" />
              <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                Contact Information
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Email Address
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {guardian.email ? (
                    <>
                      <a
                        href={`mailto:${guardian.email}`}
                        className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline flex items-center gap-2 break-words flex-1 min-w-0"
                      >
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        {guardian.email}
                      </a>
                      <button
                        onClick={() => handleCopy(guardian.email || '', 'email')}
                        className="p-2 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center flex-shrink-0"
                        aria-label="Copy email"
                      >
                        {copiedField === 'email' ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </>
                  ) : (
                    <p className="text-ds-body text-ds-text-muted dark:text-slate-400">Not provided</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Phone Number
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {guardian.phone ? (
                    <>
                      <a
                        href={`tel:${guardian.phone}`}
                        className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline flex items-center gap-2 break-words flex-1 min-w-0"
                      >
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        {guardian.phone}
                      </a>
                      <button
                        onClick={() => handleCopy(guardian.phone || '', 'phone')}
                        className="p-2 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center flex-shrink-0"
                        aria-label="Copy phone"
                      >
                        {copiedField === 'phone' ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </>
                  ) : (
                    <p className="text-ds-body text-ds-text-muted dark:text-slate-400">Not provided</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Secondary Information */}
        <div className="space-y-4 md:space-y-6">
          {/* Status Overview Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-4 md:p-6">
            <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-3 md:mb-4">
              Status Overview
            </h2>
            
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Account Status
                </label>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-ds-small font-medium ${
                  guardian.is_active !== false
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    guardian.is_active !== false ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {guardian.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Role
                </label>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pale-blue text-ds-text-primary dark:bg-pale-blue/30 dark:text-ds-text-primary text-ds-small font-medium capitalize">
                  Guardian
                </span>
              </div>

              {guardian.last_login_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last Login
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatRelativeTime(guardian.last_login_at)}
                  </p>
                </div>
              )}

              {guardian.created_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Account Created
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(guardian.created_at)}
                    {(() => {
                      const daysSince = calculateDaysSince(guardian.created_at);
                      return daysSince !== null && (
                        <span className="text-ds-small text-ds-text-muted dark:text-slate-400">
                          {' '}({daysSince} days ago)
                        </span>
                      );
                    })()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Children & Classes Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                Children & Classes
              </h2>
            </div>
            
            {children && children.length > 0 ? (
              <div className="space-y-2 md:space-y-3">
                {children.map((child) => {
                  const childName = `${child.first_name || ''} ${child.last_name || ''}`.trim() || 'Unknown Child';
                  const childAge = calculateStudentAge(child.dob);
                  
                  return (
                    <div
                      key={child.id}
                      className="p-3 md:p-4 rounded-ds-md bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <div className="w-10 h-10 rounded-full bg-pale-blue dark:bg-pale-blue/30 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <a
                              href={`/dashboard/principal/students/${child.id}`}
                              className="text-ds-body font-medium text-ds-text-primary dark:text-slate-100 hover:text-mint-500 dark:hover:text-mint-400 hover:underline break-words"
                            >
                              {childName}
                            </a>
                            {child.relation && (
                              <span className="text-ds-tiny text-ds-text-muted dark:text-slate-400 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 whitespace-nowrap">
                                {child.relation}
                              </span>
                            )}
                          </div>
                          {childAge !== null && (
                            <p className="text-ds-small text-ds-text-muted dark:text-slate-400 mb-1 md:mb-2">
                              {childAge} years old
                            </p>
                          )}
                          {child.classes ? (
                            <div className="flex flex-wrap items-center gap-2 mt-1 md:mt-2">
                              <GraduationCap className="w-4 h-4 text-mint-500 dark:text-mint-400 flex-shrink-0" />
                              <a
                                href={`/dashboard/principal/classes/${child.class_id}`}
                                className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline flex items-center gap-1 break-words"
                              >
                                {child.classes.name}
                                {child.classes.code && (
                                  <span className="text-ds-tiny text-ds-text-muted dark:text-slate-400 whitespace-nowrap">
                                    ({child.classes.code})
                                  </span>
                                )}
                              </a>
                            </div>
                          ) : (
                            <p className="text-ds-small text-ds-text-muted dark:text-slate-400 mt-1 md:mt-2">
                              No class assigned
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-ds-body text-ds-text-muted dark:text-slate-400">
                No children linked to this guardian
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
