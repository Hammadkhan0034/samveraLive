import React from 'react';
import { Calendar, Shield, School, User } from 'lucide-react';
import { Avatar } from '@/app/components/shared/Avatar';
import { Card } from '@/app/components/ui';
import { Pill } from '@/app/components/ui';
import type { Student } from '@/lib/types/attendance';
import type { User } from '@/lib/types/users';

interface StudentHeaderProps {
  student: Student;
  user?: User | null;
  className?: string;
}

function getInitials(firstName: string, lastName: string | null): string {
  if (!firstName) return '';
  if (!lastName) return firstName.charAt(0).toUpperCase();
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
}

function getFullName(firstName: string, lastName: string | null): string {
  if (!lastName) return firstName;
  return `${firstName} ${lastName}`;
}

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatGender(gender: string): string {
  if (gender === 'unknown') return 'Unknown';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

export function StudentHeader({ student, user, className = '' }: StudentHeaderProps) {
  const firstName = user?.first_name || student.first_name;
  const lastName = user?.last_name || student.last_name;
  const fullName = getFullName(firstName, lastName);
  const initials = getInitials(firstName, lastName);
  const avatarUrl = user?.avatar_url || null;
  const dob = user?.dob || student.dob;
  const age = calculateAge(dob);
  const gender = user?.gender || student.gender;
  const isActive = user?.is_active ?? true;
  const canLogin = user?.canLogin ?? false;
  const classData = student.classes;

  return (
    <Card className={`${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-ds-md">
        {/* Avatar Section */}
        <div className="flex items-center justify-center md:justify-start">
          <Avatar
            src={avatarUrl}
            alt={fullName}
            initials={initials}
            size="xl"
            className="shadow-md"
          />
        </div>

        {/* Main Info Section */}
        <div className="md:col-span-2 space-y-3">
          {/* Name */}
          <div>
            <h1 className="text-ds-h1 font-bold text-slate-900 dark:text-slate-100 mb-2">
              {fullName}
            </h1>
          </div>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-3 text-ds-small text-slate-600 dark:text-slate-400">
            {gender && gender !== 'unknown' && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-mint-600 dark:text-mint-400" />
                <span>{formatGender(gender)}</span>
              </div>
            )}
            {dob && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-mint-600 dark:text-mint-400" />
                <span>
                  {formatDate(dob)}
                  {age !== null && ` (${age} years old)`}
                </span>
              </div>
            )}
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Active/Inactive Badge */}
            <Pill tone={isActive ? 'green' : 'gray'}>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </Pill>

            {/* Can Login Badge */}
            {canLogin && (
              <Pill tone="blue">
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  <span>Can Login</span>
                </div>
              </Pill>
            )}

            {/* Class Badge */}
            {classData && (
              <Pill tone="mint">
                <div className="flex items-center gap-1">
                  <School className="h-3 w-3" />
                  <span>{classData.name}</span>
                </div>
              </Pill>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
