'use client';

import { useRouter } from 'next/navigation';
import { Edit, Building2 } from 'lucide-react';
import { PageHeader } from '@/app/components/shared/PageHeader';
import type { Organization } from '@/lib/types/orgs';

interface OrganizationHeaderProps {
  organization: Organization;
  backHref: string;
  onEditClick?: (orgId: string) => void;
  className?: string;
}

/**
 * Reusable organization header component with basic info and quick actions
 */
export function OrganizationHeader({
  organization,
  backHref,
  onEditClick,
  className = '',
}: OrganizationHeaderProps) {
  const router = useRouter();

  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick(organization.id);
    } else {
      // Default behavior: could navigate to edit page if it exists
      // For now, we'll just trigger the edit modal from the list page
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(organization.name);

  return (
    <div className={`rounded-ds-lg bg-white shadow-ds-card p-ds-md md:p-ds-lg ${className}`}>
      <PageHeader
        title={organization.name}
        subtitle={`Slug: ${organization.slug}`}
        showBackButton={true}
        backHref={backHref}
        showProfileSwitcher={false}
      />
      
      <div className="mt-ds-md flex flex-col md:flex-row md:items-end md:justify-between gap-ds-md">
        {/* Icon and Basic Info */}
        <div className="flex items-end gap-ds-md">
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-pale-blue dark:bg-pale-blue/30 border-4 border-white shadow-ds-card flex items-center justify-center">
              <Building2 className="w-16 h-16 md:w-20 md:h-20 text-mint-500 dark:text-mint-400" />
            </div>
            {/* Status Badge */}
            <div 
              className={`absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 rounded-full border-4 border-white ${
                organization.is_active ? 'bg-green-500' : 'bg-red-500'
              }`} 
              title={organization.is_active ? 'Active' : 'Inactive'} 
            />
          </div>

          <div className="pb-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                <Building2 className="w-4 h-4 text-mint-200" />
                {organization.slug}
              </span>
              {organization.timezone && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  {organization.timezone}
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
            aria-label="Edit organization"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
