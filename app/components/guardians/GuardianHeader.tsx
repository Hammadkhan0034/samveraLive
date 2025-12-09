'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Edit, Users } from 'lucide-react';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { 
  getGuardianName, 
  getInitials
} from '@/lib/utils/guardianUtils';

interface Guardian {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  is_active?: boolean | null;
}

interface GuardianHeaderProps {
  guardian: Guardian;
  backHref: string;
  childrenCount?: number;
  onEditClick?: (guardianId: string) => void;
  className?: string;
}

/**
 * Reusable guardian header component with avatar, basic info, and quick actions
 */
export function GuardianHeader({
  guardian,
  backHref,
  childrenCount = 0,
  onEditClick,
  className = '',
}: GuardianHeaderProps) {
  const router = useRouter();
  const { t } = useLanguage();

  // Calculate derived values
  const guardianName = getGuardianName(guardian);
  const firstName = guardian.first_name || '';
  const lastName = guardian.last_name || '';
  const avatarUrl = guardian.avatar_url || null;
  const initials = getInitials(firstName, lastName);

  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick(guardian.id);
    } else {
      // Default behavior: navigate to edit page
      router.push(`/dashboard/add-guardian?id=${guardian.id}`);
    }
  };

  return (
    <div className={`rounded-ds-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-ds-card p-4 md:p-6 ${className}`}>
      <PageHeader
        title={guardianName}
        subtitle={`${t.guardian_id_label || 'Guardian ID:'} ${guardian.id.slice(0, 8)}...`}
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
                  alt={guardianName}
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
                guardian.is_active !== false ? 'bg-green-500' : 'bg-red-500'
              }`} 
              title={guardian.is_active !== false ? (t.active || 'Active') : (t.inactive || 'Inactive')} 
            />
          </div>

          <div className="pb-2">
            <div className="flex flex-wrap items-center gap-3">
              {childrenCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  <Users className="w-4 h-4 text-mint-200" />
                  {childrenCount} {childrenCount === 1 ? (t.child || 'Child') : (t.children || 'Children')}
                </span>
              )}
              {guardian.email && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-input-fill border border-input-stroke text-ds-small font-medium text-ds-text-primary">
                  {guardian.email}
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
            aria-label={t.edit_guardian || 'Edit guardian'}
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">{t.edit || 'Edit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
