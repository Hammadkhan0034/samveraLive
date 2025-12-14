'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Phone, MessageCircle, Mail } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { Student } from '@/lib/types/attendance';
import { getStudentName, calculateAge, getInitials } from '@/lib/utils/studentUtils';

interface StudentCardProps {
  student: Student;
}

const StudentCard = ({ student }: StudentCardProps) => {
  const router = useRouter();
  const { t } = useLanguage();

  // Function to get initials from name
  const getInitialsFromName = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Function to get a color based on the name (for avatar background)
  const getAvatarColor = (name: string) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  // Map Student data to card format
  const studentName = getStudentName(student);
  const age = calculateAge(student.dob || student.users?.dob);
  const gender = student.gender || student.users?.gender || '';
  const address = student.users?.address || null;
  const imageUrl = student.users?.avatar_url || null;

  // Transform guardians data
  const guardians = student.guardians?.map((guardian) => {
    const guardianFirstName = guardian.users?.first_name || '';
    const guardianLastName = guardian.users?.last_name || '';
    const guardianName = `${guardianFirstName} ${guardianLastName}`.trim() || (t.student_card_unknown || 'Unknown');
    
    return {
      id: guardian.id,
      name: guardianName,
      relationship: guardian.relation || undefined,
      phone: (guardian.users as any)?.phone || undefined,
      email: guardian.users?.email || undefined,
      imageUrl: (guardian.users as any)?.avatar_url || undefined,
      guardianId: guardian.guardian_id || guardian.users?.id,
    };
  }) || [];

  // Handle send message button click
  const handleSendMessage = (guardianId: string) => {
    router.push(`/dashboard/teacher/messages?recipientId=${encodeURIComponent(guardianId)}`);
  };

  return (
    <div>
      {/* Student Header Section */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
        {/* Avatar */}
        <div className="flex-shrink-0 flex justify-center sm:justify-start">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={studentName}
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gray-100 dark:border-slate-700"
            />
          ) : (
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-semibold"
              style={{ backgroundColor: getAvatarColor(studentName) }}
            >
              {getInitials(
                student.users?.first_name || student.first_name,
                student.users?.last_name || student.last_name
              )}
            </div>
          )}
        </div>

        {/* Student Info */}
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl font-semibold mb-1" style={{ color: '#2D7A5F' }}>
            {studentName}
          </h2>
          <div className="text-sm sm:text-base" style={{ color: '#6B6B6B' }}>
            {age !== null && (
              <div>
                <span className="font-medium" style={{ color: '#2D7A5F' }}>{t.student_card_age_label || 'Age: '}</span>
                {age} {t.student_details_years_old || 'years old'}
              </div>
            )}
            {gender && (
              <div>
                <span className="font-medium" style={{ color: '#2D7A5F' }}>{t.student_card_gender_label || 'Gender: '}</span>
                {gender}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Section */}
      {address && (
        <div className="mb-2">
          <p className="text-sm sm:text-base" style={{ color: '#4A4A4A' }}>
            <span className="font-medium" style={{ color: '#2D7A5F' }}>{t.student_card_address_label || 'Address: '}</span>
            {address}
          </p>
        </div>
      )}

      {/* Barngildi Section */}
      {student.barngildi !== null && student.barngildi !== undefined && (
        <div className="mb-2">
          <p className="text-sm sm:text-base" style={{ color: '#4A4A4A' }}>
            <span className="font-medium" style={{ color: '#2D7A5F' }}>
              {t.student_details_barngildi || 'Barngildi'}:{' '}
            </span>
            {student.barngildi.toFixed(1)}
          </p>
        </div>
      )}

      {/* Medical Notes */}
      {student.medical_notes_encrypted && student.medical_notes_encrypted.trim() !== '' && (
        <div className="mb-2">
          <p className="text-sm sm:text-base" style={{ color: '#4A4A4A' }}>
            <span className="font-medium" style={{ color: '#2D7A5F' }}>
              {t.student_details_medical_notes || 'Medical Notes'}:{' '}
            </span>
            <span className="whitespace-pre-wrap">{student.medical_notes_encrypted}</span>
          </p>
        </div>
      )}

      {/* Allergies */}
      {student.allergies_encrypted && student.allergies_encrypted.trim() !== '' && (
        <div className="mb-2">
          <p className="text-sm sm:text-base" style={{ color: '#4A4A4A' }}>
            <span className="font-medium" style={{ color: '#2D7A5F' }}>
              {t.student_details_allergies || 'Allergies'}:{' '}
            </span>
            <span className="font-medium whitespace-pre-wrap" style={{ color: '#DC2626' }}>
              {student.allergies_encrypted}
            </span>
          </p>
        </div>
      )}

      {/* Emergency Contact */}
      {student.emergency_contact_encrypted && student.emergency_contact_encrypted.trim() !== '' && (
        <div className="mb-2">
          <p className="text-sm sm:text-base" style={{ color: '#4A4A4A' }}>
            <span className="font-medium" style={{ color: '#2D7A5F' }}>
              {t.student_details_emergency_contact || 'Emergency Contact'}:{' '}
            </span>
            <span className="whitespace-pre-wrap">{student.emergency_contact_encrypted}</span>
          </p>
        </div>
      )}

      {/* Guardians Section */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4" style={{ color: '#2D7A5F' }}>
          {t.student_card_parents_guardians || 'Parents & Guardians'}
        </h3>
        
        <div className="space-y-3 sm:space-y-4">
          {guardians.length > 0 ? (
            guardians.map((guardian) => {
              const guardianInitials = guardian.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={guardian.id} className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 shadow-sm">
                  {/* Guardian Header */}
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    {guardian.imageUrl ? (
                      <Image
                        src={guardian.imageUrl}
                        alt={guardian.name}
                        width={48}
                        height={48}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold"
                        style={{ backgroundColor: getAvatarColor(guardian.name) }}
                      >
                        {guardianInitials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate" style={{ color: '#2D7A5F' }}>
                        {guardian.name}
                      </p>
                      {guardian.relationship && (
                        <p className="text-xs sm:text-sm truncate" style={{ color: '#6B6B6B' }}>
                          {guardian.relationship}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    {guardian.phone ? (
                      <a
                        href={`tel:${guardian.phone}`}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: '#B8E6D5', color: '#2D7A5F' }}
                      >
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">{t.student_card_call || 'Call'}</span>
                      </a>
                    ) : null}
                    {guardian.guardianId ? (
                      <button
                        onClick={() => handleSendMessage(guardian.guardianId!)}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: '#B8E6D5', color: '#2D7A5F' }}
                      >
                        <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">{t.student_card_message || 'Message'}</span>
                      </button>
                    ) : null}
                    {guardian.email ? (
                      <a
                        href={`mailto:${guardian.email}`}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: '#B8E6D5', color: '#2D7A5F' }}
                      >
                        <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">{t.student_card_email || 'Email'}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs sm:text-sm text-center" style={{ color: '#6B6B6B' }}>
              {t.student_card_no_guardians_assigned || 'No guardians assigned'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentCard;