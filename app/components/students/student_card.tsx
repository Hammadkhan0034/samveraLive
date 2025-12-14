'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Phone, MessageCircle, Mail } from 'lucide-react';
import type { Student } from '@/lib/types/attendance';
import { getStudentName, calculateAge, getInitials } from '@/lib/utils/studentUtils';

interface StudentCardProps {
  student: Student;
}

const StudentCard = ({ student }: StudentCardProps) => {
  const router = useRouter();

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
    const guardianName = `${guardianFirstName} ${guardianLastName}`.trim() || 'Unknown';
    
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
      <div className="flex gap-4 mb-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={studentName}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-100 dark:border-slate-700"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
              style={{ backgroundColor: getAvatarColor(studentName) }}
            >
              {getInitials(student.first_name, student.last_name)}
            </div>
          )}
        </div>

        {/* Student Info */}
        <div className="flex-1">
          <h2 className="text-2xl font-semibold mb-1" style={{ color: '#2D7A5F' }}>
            {studentName}
          </h2>
          <div className="flex gap-3 text-base" style={{ color: '#6B6B6B' }}>
            {age !== null && <span>{age} years</span>}
            {age !== null && gender && <span>•</span>}
            {gender && <span>{gender}</span>}
          </div>
        </div>
      </div>

      {/* Address Section */}
      {address && (
        <div className="mb-6">
          <p className="text-base" style={{ color: '#4A4A4A' }}>
            <span className="font-medium" style={{ color: '#2D7A5F' }}>Address: </span>
            {address}
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-200 my-6"></div>

      {/* Guardians Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#2D7A5F' }}>
          Parents & Guardians
        </h3>
        
        <div className="space-y-4">
          {guardians.length > 0 ? (
            guardians.map((guardian) => {
              const guardianInitials = guardian.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={guardian.id} className="p-4 rounded-2xl dark:bg-slate-700" style={{ backgroundColor: '#F5F5F5' }}>
                  {/* Guardian Header */}
                  <div className="flex items-center gap-3 mb-3">
                    {guardian.imageUrl ? (
                      <Image
                        src={guardian.imageUrl}
                        alt={guardian.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                        style={{ backgroundColor: getAvatarColor(guardian.name) }}
                      >
                        {guardianInitials}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-base" style={{ color: '#2D7A5F' }}>
                        {guardian.name}
                      </p>
                      {guardian.relationship && (
                        <p className="text-sm" style={{ color: '#6B6B6B' }}>
                          {guardian.relationship}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {guardian.phone ? (
                      <a
                        href={`tel:${guardian.phone}`}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: '#B8E6D5', color: '#2D7A5F' }}
                      >
                        <Phone size={18} />
                        Call
                      </a>
                    ) : null}
                    {guardian.guardianId ? (
                      <button
                        onClick={() => handleSendMessage(guardian.guardianId!)}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: '#B8E6D5', color: '#2D7A5F' }}
                      >
                        <MessageCircle size={18} />
                        Message
                      </button>
                    ) : null}
                    {guardian.email ? (
                      <a
                        href={`mailto:${guardian.email}`}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: '#B8E6D5', color: '#2D7A5F' }}
                      >
                        <Mail size={18} />
                        Email
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm" style={{ color: '#6B6B6B' }}>
              No guardians assigned
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentCard;