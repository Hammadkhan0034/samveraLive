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
  User,
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
import { OrganizationHeader } from '@/app/components/admin/OrganizationHeader';
import type { OrganizationDetails } from '@/lib/types/orgs';
import Loading from '@/app/components/shared/Loading';

interface Principal {
  id: string;
  email: string | null;
  phone: string | null;
  full_name?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  org_id: string;
  is_active: boolean;
  created_at: string;
}

function OrganizationsDetailPageContent() {
  const params = useParams();
  const { t } = useLanguage();
  const orgId = params?.id as string;

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return t.status_not_provided || 'Not provided';
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
  };

  const formatRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return t.status_never || 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return t.time_just_now || 'Just now';
      if (diffInSeconds < 3600) return (t.time_minutes_ago || '{count} minutes ago').replace('{count}', String(Math.floor(diffInSeconds / 60)));
      if (diffInSeconds < 86400) return (t.time_hours_ago || '{count} hours ago').replace('{count}', String(Math.floor(diffInSeconds / 3600)));
      if (diffInSeconds < 604800) return (t.time_days_ago || '{count} days ago').replace('{count}', String(Math.floor(diffInSeconds / 86400)));
      if (diffInSeconds < 2592000) return (t.time_weeks_ago || '{count} weeks ago').replace('{count}', String(Math.floor(diffInSeconds / 604800)));
      if (diffInSeconds < 31536000) return (t.time_months_ago || '{count} months ago').replace('{count}', String(Math.floor(diffInSeconds / 2592000)));
      return (t.time_years_ago || '{count} years ago').replace('{count}', String(Math.floor(diffInSeconds / 31536000)));
    } catch {
      return dateString;
    }
  };

  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadOrganization = useCallback(async () => {
    if (!orgId) {
      setError('Organization ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch organization with metrics
      const orgResponse = await fetch(`/api/orgs/${encodeURIComponent(orgId)}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!orgResponse.ok) {
        if (orgResponse.status === 403) {
          throw new Error('You do not have permission to view this organization');
        }
        if (orgResponse.status === 404) {
          throw new Error('Organization not found');
        }
        throw new Error(`Failed to load organization: ${orgResponse.status}`);
      }

      const orgData = await orgResponse.json();
      const orgDetails = orgData.org;

      if (!orgDetails) {
        throw new Error('Organization not found');
      }

      setOrganization(orgDetails);

      // Fetch principals for this organization
      const principalsResponse = await fetch(`/api/principals?orgId=${encodeURIComponent(orgId)}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (principalsResponse.ok) {
        const principalsData = await principalsResponse.json();
        setPrincipals(principalsData.principals || []);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organization';
      setError(errorMessage);
      console.error('Error loading organization:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

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

  if (error || !organization) {
    return (
      <EmptyState
        icon={Building2}
        title={error || t.error_organization_not_found || 'Organization not found'}
        description={t.error_organization_not_found_detail || "The organization you're looking for doesn't exist or you don't have permission to view it."}
      />
    );
  }

  const backHref = '/dashboard/admin/organizations';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4 sm:mt-6">
      {/* Header Section */}
      <OrganizationHeader
        organization={organization}
        backHref={backHref}
      />

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
        {/* Left Column - Primary Information */}
        <div className="space-y-6">
          {/* Organization Information Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="w-5 h-5 text-mint-500 dark:text-mint-400" />
              <h2 className="text-ds-h2 font-semibold text-ds-text-primary dark:text-slate-100">
                {t.organization_information || 'Organization Information'}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.field_organization_name || 'Organization Name'}
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-medium">
                    {organization.name}
                  </p>
                  <button
                    onClick={() => handleCopy(organization.name, 'name')}
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
                  {t.field_slug || 'Slug'}
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100 font-mono">
                    {organization.slug}
                  </p>
                  <button
                    onClick={() => handleCopy(organization.slug, 'slug')}
                    className="p-1.5 rounded-ds-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Copy slug"
                  >
                    {copiedField === 'slug' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {organization.email && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.field_email || 'Email'}
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a
                      href={`mailto:${organization.email}`}
                      className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                    >
                      {organization.email}
                    </a>
                  </div>
                </div>
              )}

              {organization.phone && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.field_phone || 'Phone'}
                  </label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <a
                      href={`tel:${organization.phone}`}
                      className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                    >
                      {organization.phone}
                    </a>
                  </div>
                </div>
              )}

              {organization.website && (
                <div className="md:col-span-2">
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                    {t.field_website || 'Website'}
                  </label>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ds-body text-mint-500 dark:text-mint-400 hover:underline"
                    >
                      {organization.website}
                    </a>
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.field_address || 'Address'}
                </label>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                      {organization.address || (t.status_not_provided || 'Not provided')}
                      {organization.city && `, ${organization.city}`}
                      {organization.state && `, ${organization.state}`}
                      {organization.postal_code && ` ${organization.postal_code}`}
                    </p>
                    {organization.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(
                          [organization.address, organization.city, organization.state, organization.postal_code]
                            .filter(Boolean)
                            .join(', ')
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ds-small text-mint-500 dark:text-mint-400 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        {t.view_on_map || 'View on Map'}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.field_timezone || 'Timezone'}
                </label>
                <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                  {organization.timezone}
                </p>
              </div>
            </div>
          </div>

          {/* Principals Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                {t.metric_principals || 'Principals'}
              </h2>
            </div>
            
            {principals && principals.length > 0 ? (
              <div className="space-y-3">
                {principals.map((principal) => {
                  const principalName = principal.full_name || principal.name || 
                    `${principal.first_name || ''} ${principal.last_name || ''}`.trim() || 
                    (t.unknown_principal || 'Unknown Principal');

                  return (
                    <div
                      key={principal.id}
                      className="flex items-center gap-3 p-3 rounded-ds-md bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-pale-blue dark:bg-pale-blue/30 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-mint-500 dark:text-mint-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-ds-body font-medium text-ds-text-primary dark:text-slate-100 truncate">
                          {principalName}
                        </p>
                        {principal.email && (
                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={`mailto:${principal.email}`}
                              className="text-ds-tiny text-mint-500 dark:text-mint-400 hover:underline flex items-center gap-1"
                            >
                              <Mail className="w-3 h-3" />
                              {t.field_email || 'Email'}
                            </a>
                          </div>
                        )}
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-ds-tiny font-medium ${
                            principal.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              principal.is_active ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                            {principal.is_active ? (t.active || 'Active') : (t.inactive || 'Inactive')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-ds-body text-ds-text-muted dark:text-slate-400">
                {t.no_principals_assigned || 'No principals assigned'}
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Secondary Information */}
        <div className="space-y-6">
          {/* Status Overview Card */}
          <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
            <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-4">
              {t.status_overview || 'Status Overview'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 block">
                  {t.field_account_status || 'Account Status'}
                </label>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-ds-small font-medium ${
                  organization.is_active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    organization.is_active ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {organization.is_active ? (t.active || 'Active') : (t.inactive || 'Inactive')}
                </span>
              </div>

              {organization.created_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {t.field_created_at || 'Created At'}
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatDate(organization.created_at)}
                  </p>
                </div>
              )}

              {organization.updated_at && (
                <div>
                  <label className="text-ds-tiny uppercase tracking-wide text-ds-text-muted dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.field_last_updated || 'Last Updated'}
                  </label>
                  <p className="text-ds-body text-ds-text-primary dark:text-slate-100">
                    {formatRelativeTime(organization.updated_at)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Card */}
          {organization.metrics && (
            <div className="rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-6">
              <h2 className="text-ds-h3 font-semibold text-ds-text-primary dark:text-slate-100 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-mint-500 dark:text-mint-400" />
                {t.user_metrics || 'User Metrics'}
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">{t.metric_students || 'Students'}</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {organization.metrics.students}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">{t.metric_teachers || 'Teachers'}</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {organization.metrics.teachers}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">{t.metric_parents || 'Parents'}</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {organization.metrics.parents}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-input-fill dark:bg-ds-surface-card">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-mint-500 dark:text-mint-400" />
                    <span className="text-ds-small text-ds-text-muted dark:text-slate-400">{t.metric_principals || 'Principals'}</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-ds-text-primary dark:text-slate-100">
                    {organization.metrics.principals}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-ds-md bg-mint-100 dark:bg-mint-900/20 border-2 border-mint-200 dark:border-mint-800">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-mint-600 dark:text-mint-400" />
                    <span className="text-ds-small font-medium text-ds-text-primary dark:text-slate-100">{t.metric_total_users || 'Total Users'}</span>
                  </div>
                  <span className="text-ds-h2 font-bold text-mint-600 dark:text-mint-400">
                    {organization.metrics.totalUsers}
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

export default function OrganizationDetailPage() {
  const { user, loading, isSigningIn } = useRequireAuth('admin');
  const { t } = useLanguage();

  // Show loading ONLY if we have no user yet (avoid flicker after sign-in)
  if (loading && !user) {
    return <Loading fullScreen text={t.loading_organizations || 'Loading organization...'} />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-mint-100 dark:bg-slate-950">
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-ds-lg">
        <div className="pt-4 sm:pt-6">
          <OrganizationsDetailPageContent />
        </div>
      </main>
    </div>
  );
}
