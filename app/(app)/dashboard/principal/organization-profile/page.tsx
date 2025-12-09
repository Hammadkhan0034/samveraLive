'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PrincipalPageLayout, { usePrincipalPageLayout } from '@/app/components/shared/PrincipalPageLayout';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { OrganizationProfileForm } from '@/app/components/principal/OrganizationProfileForm';
import { Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { Organization } from '@/lib/types/orgs';

function PrincipalOrganizationProfileContent() {
  const { t } = useLanguage();
  const { sidebarRef } = usePrincipalPageLayout();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/orgs/my-org', {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(t.error_permission_denied);
        }
        if (response.status === 404) {
          throw new Error(t.error_organization_not_found);
        }
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `${t.error_failed_to_load_organization}: ${response.status}`);
      }

      const data = await response.json();
      if (!data.org) {
        throw new Error(t.error_organization_not_found);
      }

      setOrganization(data.org);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t.error_failed_to_load_organization;
      setError(errorMessage);
      console.error('Error loading organization:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const handleUpdate = (updatedOrg: Organization) => {
    setOrganization(updatedOrg);
  };

  const handleRetry = () => {
    loadOrganization();
  };

  return (
    <>
      <PageHeader
        title={t.organization_profile}
        subtitle={t.organization_profile_subtitle}
        headingLevel="h1"
        backHref="/dashboard/principal"
        showBackButton={true}
      />

      {loading && (
        <div className="flex items-center justify-center p-ds-xl">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-mint-500 animate-spin mx-auto mb-ds-md" />
            <h3 className="text-ds-h3 font-semibold text-[#1F2937] dark:text-slate-100 mb-2">
              {t.loading_organization}
            </h3>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="mb-ds-md rounded-ds-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-ds-md">
          <div className="flex items-center gap-ds-md">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-ds-small font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="rounded-ds-md bg-red-100 px-4 py-3 text-ds-small font-medium text-red-700 hover:bg-red-200 active:bg-red-300 transition-colors dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800/70 dark:active:bg-red-900/70"
            >
              {t.retry}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <OrganizationProfileForm
          organization={organization}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}

export default function PrincipalOrganizationProfilePage() {
  return (
    <PrincipalPageLayout>
      <PrincipalOrganizationProfileContent />
    </PrincipalPageLayout>
  );
}
