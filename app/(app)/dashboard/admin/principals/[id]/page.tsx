'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { 
  Copy, 
  Check, 
  MapPin, 
  Phone,
  Mail,
  Globe,
  Users,
  Calendar,
  Clock,
  Building2,
  GraduationCap,
  UserCheck,
  Shield
} from 'lucide-react';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import LoadingSkeleton from '@/app/components/loading-skeletons/LoadingSkeleton';
import EmptyState from '@/app/components/EmptyState';
import { PrincipalHeader } from '@/app/components/admin/PrincipalHeader';
import type { PrincipalDetails } from '@/lib/types/principals';
import Loading from '@/app/components/shared/Loading';

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Not provided';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  } catch {
    return dateString;
  }
}

function PrincipalsDetailPageContent() {
  const params = useParams();
  const { t } = useLanguage();
  const principalId = params?.id as string;

  const [principal, setPrincipal] = useState<PrincipalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadPrincipal = useCallback(async () => {
    if (!principalId) {
      setError('Principal ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch principal with organization and metrics
      const principalResponse = await fetch(`/api/principals/${encodeURIComponent(principalId)}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!principalResponse.ok) {
        if (principalResponse.status === 403) {
          throw new Error('You do not have permission to view this principal');
        }
        if (principalResponse.status === 404) {
          throw new Error('Principal not found');
        }
        throw new Error(`Failed to load principal: ${principalResponse.status}`);
      }

      const principalData = await principalResponse.json();
      const principalDetails = principalData.principal;

      if (!principalDetails) {
        throw new Error('Principal not found');
      }

      setPrincipal(principalDetails);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load principal';
      setError(errorMessage);
      console.error('Error loading principal:', err);
    } finally {
      setLoading(false);
    }
  }, [principalId]);

  useEffect(() => {
    loadPrincipal();
  }, [loadPrincipal]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
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

  if (error || !principal) {
    return (
      <EmptyState
        icon={Shield}
        title={error || 'Principal not found'}
        description="The principal you're looking for doesn't exist or you don't have permission to view it."
      />
    );
  }

  const principalName = principal.full_name || principal.name || 
    `${principal.first_name || ''} ${principal.last_name || ''}`.trim() || 
    'Unknown Principal';

  const backHref = '/dashboard/admin/principals';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4 sm:mt-6">
      {/* Header Section */}
      <PrincipalHeader
        principal={principal}
        organization={principal.organization}
        backHref={backHref}
      />

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
        {/* Left Column - Primary Information */}
        <div className="space-y-6">
          {/* Principal Information Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-mint-500 dark:text-mint-400" />
              <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                Principal Information
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  Full Name
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-medium">
                    {principalName}
                  </p>
                  <button
                    onClick={() => handleCopy(principalName, 'name')}
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

              {principal.email && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a
                      href={`mailto:${principal.email}`}
                      className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                    >
                      {principal.email}
                    </a>
                  </div>
                </div>
              )}

              {principal.phone && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Phone
                  </label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <a
                      href={`tel:${principal.phone}`}
                      className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                    >
                      {principal.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Organization Information Card */}
          {principal.organization && (
            <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                  Organization Information
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Organization Name
                  </label>
                  <div className="flex items-center gap-2">
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-medium">
                      {principal.organization.name}
                    </p>
                    <button
                      onClick={() => handleCopy(principal.organization!.name, 'orgName')}
                      className="p-1.5 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      aria-label="Copy organization name"
                    >
                      {copiedField === 'orgName' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Slug
                  </label>
                  <div className="flex items-center gap-2">
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-mono">
                      {principal.organization.slug}
                    </p>
                    <button
                      onClick={() => handleCopy(principal.organization!.slug, 'orgSlug')}
                      className="p-1.5 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      aria-label="Copy slug"
                    >
                      {copiedField === 'orgSlug' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {principal.organization.email && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Email
                    </label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <a
                        href={`mailto:${principal.organization.email}`}
                        className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                      >
                        {principal.organization.email}
                      </a>
                    </div>
                  </div>
                )}

                {principal.organization.phone && (
                  <div>
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Phone
                    </label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <a
                        href={`tel:${principal.organization.phone}`}
                        className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                      >
                        {principal.organization.phone}
                      </a>
                    </div>
                  </div>
                )}

                {principal.organization.website && (
                  <div className="md:col-span-2">
                    <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                      Website
                    </label>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-400" />
                      <a
                        href={principal.organization.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                      >
                        {principal.organization.website}
                      </a>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    Address
                  </label>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                        {principal.organization.address || 'Not provided'}
                        {principal.organization.city && `, ${principal.organization.city}`}
                        {principal.organization.state && `, ${principal.organization.state}`}
                        {principal.organization.postal_code && ` ${principal.organization.postal_code}`}
                      </p>
                      {principal.organization.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(
                            [principal.organization.address, principal.organization.city, principal.organization.state, principal.organization.postal_code]
                              .filter(Boolean)
                              .join(', ')
                          )}`}
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
                    Timezone
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {principal.organization.timezone}
                  </p>
                </div>
              </div>
            </div>
          )}
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
                  principal.is_active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    principal.is_active ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {principal.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {principal.created_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Created At
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(principal.created_at)}
                  </p>
                </div>
              )}

              {principal.updated_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last Updated
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatRelativeTime(principal.updated_at)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Card */}
          {principal.metrics && (
            <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
              <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                User Metrics
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Students</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {principal.metrics.students}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Teachers</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {principal.metrics.teachers}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Parents</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {principal.metrics.parents}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">Principals</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {principal.metrics.principals}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-mint-100 dark:bg-mint-900/20 border-2 border-mint-200 dark:border-mint-800">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-mint-600 dark:text-mint-400" />
                    <span className="text-ds-small font-medium text-ds-text-primary dark:text-slate-100">Total Users</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-mint-600 dark:text-mint-400">
                    {principal.metrics.totalUsers}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PrincipalDetailPage() {
  const { user, loading, isSigningIn } = useRequireAuth('admin');
  const { t } = useLanguage();

  // Show loading ONLY if we have no user yet (avoid flicker after sign-in)
  if (loading && !user) {
    return <Loading fullScreen text={t.loading_principals || 'Loading principal...'} />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-mint-100 dark:bg-slate-950">
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-ds-lg">
        <div className="pt-4 sm:pt-6">
          <PrincipalsDetailPageContent />
        </div>
      </main>
    </div>
  );
}
