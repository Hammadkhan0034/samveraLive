import React from 'react';
import { Mail, Phone, MapPin, Calendar, Globe, Hash } from 'lucide-react';
import { Card } from '@/app/components/ui';
import type { Student } from '@/lib/types/attendance';
import type { User } from '@/lib/types/users';

interface StudentInfoCardProps {
  student: Student;
  user?: User | null;
  className?: string;
}

function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(dateTime: string | null): string {
  if (!dateTime) return 'N/A';
  return new Date(dateTime).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskSSN(ssn: string | null | undefined): string {
  if (!ssn) return 'N/A';
  // Mask all but last 4 digits
  if (ssn.length > 4) {
    return `***-**-${ssn.slice(-4)}`;
  }
  return ssn;
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3">
      <div className="text-mint-600 dark:text-mint-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-ds-tiny text-slate-500 dark:text-slate-400 mb-0.5">{label}</div>
        <div className="text-ds-small text-slate-900 dark:text-slate-100 break-words">{value}</div>
      </div>
    </div>
  );
}

export function StudentInfoCard({ student, user, className = '' }: StudentInfoCardProps) {
  const email = user?.email;
  const phone = user?.phone || null;
  const ssn = user?.ssn;
  const address = user?.address || student.users?.address;
  const registrationTime = student.registration_time;
  const startDate = student.start_date;
  const studentLanguage = student.student_language;
  const barngildi = student.barngildi;

  return (
    <Card className={className}>
      <h2 className="text-ds-h3 font-semibold mb-ds-md text-slate-900 dark:text-slate-100">
        Student Information
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-ds-md">
        {/* Contact Information */}
        <div className="space-y-3">
          <h3 className="text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-2">
            Contact Information
          </h3>
          <InfoItem icon={<Mail className="h-4 w-4" />} label="Email" value={email || null} />
          <InfoItem icon={<Phone className="h-4 w-4" />} label="Phone" value={phone} />
          <InfoItem
            icon={<Hash className="h-4 w-4" />}
            label="SSN"
            value={ssn ? maskSSN(ssn) : null}
          />
          <InfoItem icon={<MapPin className="h-4 w-4" />} label="Address" value={address || null} />
        </div>

        {/* Registration Information */}
        <div className="space-y-3">
          <h3 className="text-ds-small font-medium text-slate-700 dark:text-slate-300 mb-2">
            Registration Details
          </h3>
          <InfoItem
            icon={<Calendar className="h-4 w-4" />}
            label="Registration Date"
            value={registrationTime ? formatDateTime(registrationTime) : null}
          />
          <InfoItem
            icon={<Calendar className="h-4 w-4" />}
            label="Start Date"
            value={startDate ? formatDate(startDate) : null}
          />
          <InfoItem
            icon={<Globe className="h-4 w-4" />}
            label="Student Language"
            value={studentLanguage || null}
          />
          {barngildi !== null && barngildi !== undefined && (
            <InfoItem
              icon={<Hash className="h-4 w-4" />}
              label="Barngildi"
              value={barngildi.toString()}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
