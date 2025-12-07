import React from 'react';
import { Mail, Phone, User } from 'lucide-react';
import { Card } from '@/app/components/ui';
import { Avatar } from '@/app/components/shared/Avatar';
import type { GuardianRelation } from '@/lib/types/attendance';

interface GuardianListProps {
  guardians: GuardianRelation[];
  className?: string;
}

function getFullName(firstName: string, lastName: string | null): string {
  if (!lastName) return firstName;
  return `${firstName} ${lastName}`;
}

function getInitials(firstName: string, lastName: string | null): string {
  if (!firstName) return '';
  if (!lastName) return firstName.charAt(0).toUpperCase();
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
}

interface GuardianCardProps {
  guardian: GuardianRelation & {
    users?: {
      id: string;
      first_name: string;
      last_name: string | null;
      email: string | null;
      phone?: string | null;
      avatar_url?: string | null;
    } | null;
  };
}

function GuardianCard({ guardian }: GuardianCardProps) {
  const user = guardian.users;
  if (!user) return null;

  const fullName = getFullName(user.first_name, user.last_name);
  const initials = getInitials(user.first_name, user.last_name);
  const relation = guardian.relation || 'Guardian';
  const avatarUrl = user.avatar_url || null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-ds-md bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
      <Avatar
        src={avatarUrl}
        alt={fullName}
        initials={initials}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-ds-small font-semibold text-slate-900 dark:text-slate-100">
            {fullName}
          </h3>
          <span className="px-2 py-0.5 rounded-ds-sm text-ds-tiny font-medium bg-mint-100 dark:bg-mint-900/40 text-mint-700 dark:text-mint-200">
            {relation}
          </span>
        </div>
        <div className="space-y-1">
          {user.email && (
            <div className="flex items-center gap-2 text-ds-tiny text-slate-600 dark:text-slate-400">
              <Mail className="h-3.5 w-3.5 text-mint-600 dark:text-mint-400 flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          )}
          {guardian.users?.phone && (
            <div className="flex items-center gap-2 text-ds-tiny text-slate-600 dark:text-slate-400">
              <Phone className="h-3.5 w-3.5 text-mint-600 dark:text-mint-400 flex-shrink-0" />
              <span className="truncate">{guardian.users.phone}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GuardianList({ guardians, className = '' }: GuardianListProps) {
  if (!guardians || guardians.length === 0) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-3 mb-ds-md">
          <User className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
            Guardians
          </h2>
        </div>
        <p className="text-ds-small text-slate-500 dark:text-slate-400">No guardians assigned</p>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-center gap-3 mb-ds-md">
        <User className="h-5 w-5 text-mint-600 dark:text-mint-400" />
        <h2 className="text-ds-h3 font-semibold text-slate-900 dark:text-slate-100">
          Guardians ({guardians.length})
        </h2>
      </div>
      <div className="space-y-2">
        {guardians.map((guardian) => (
          <GuardianCard key={guardian.id} guardian={guardian} />
        ))}
      </div>
    </Card>
  );
}
