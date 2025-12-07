'use client';

import React from 'react';
import { Shield, AlertTriangle, Phone } from 'lucide-react';
import { Accordion } from '@/app/components/shared/Accordion';
import type { Student } from '@/lib/types/attendance';

interface MedicalInfoProps {
  student: Student;
  className?: string;
}

interface DecryptedMedicalData {
  allergies?: string | null;
  medicalNotes?: string | null;
  emergencyContact?: string | null;
}

export function MedicalInfo({ student, className = '' }: MedicalInfoProps) {
  // Check if we have encrypted fields (they exist but may not be decrypted)
  const hasEncryptedFields =
    student.allergies_encrypted ||
    student.medical_notes_encrypted ||
    student.emergency_contact_encrypted;

  // For now, we'll check if the encrypted fields have values
  // In a real implementation, these would be decrypted server-side
  // For this component, we'll show a message if they're encrypted
  const allergies = student.allergies_encrypted;
  const medicalNotes = student.medical_notes_encrypted;
  const emergencyContact = student.emergency_contact_encrypted;

  // If no medical data exists at all, don't show the component
  if (!hasEncryptedFields) {
    return null;
  }

  // Check if data appears to be encrypted (contains encryption markers or is base64-like)
  // This is a simple heuristic - in production, you'd have a proper decryption check
  const isEncrypted = (value: string | null | undefined): boolean => {
    if (!value) return false;
    // Simple check: if it looks like base64 or has encryption markers
    return value.length > 50 || value.includes('encrypted') || /^[A-Za-z0-9+/=]+$/.test(value);
  };

  const allergiesEncrypted = allergies ? isEncrypted(allergies) : false;
  const notesEncrypted = medicalNotes ? isEncrypted(medicalNotes) : false;
  const contactEncrypted = emergencyContact ? isEncrypted(emergencyContact) : false;

  const hasDecryptedData =
    (allergies && !allergiesEncrypted) ||
    (medicalNotes && !notesEncrypted) ||
    (emergencyContact && !contactEncrypted);

  return (
    <div className={className}>
      <Accordion
        title="Medical Information"
        icon={<Shield className="h-5 w-5" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* Allergies Section */}
          {(allergies || allergiesEncrypted) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-ds-small font-semibold text-slate-900 dark:text-slate-100">
                  Allergies
                </h4>
              </div>
              {allergiesEncrypted ? (
                <p className="text-ds-small text-slate-500 dark:text-slate-400 italic">
                  Medical information is encrypted and requires decryption to view.
                </p>
              ) : (
                <p className="text-ds-small text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {allergies || 'None recorded'}
                </p>
              )}
            </div>
          )}

          {/* Medical Notes Section */}
          {(medicalNotes || notesEncrypted) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-mint-600 dark:text-mint-400" />
                <h4 className="text-ds-small font-semibold text-slate-900 dark:text-slate-100">
                  Medical Notes
                </h4>
              </div>
              {notesEncrypted ? (
                <p className="text-ds-small text-slate-500 dark:text-slate-400 italic">
                  Medical information is encrypted and requires decryption to view.
                </p>
              ) : (
                <p className="text-ds-small text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {medicalNotes || 'None recorded'}
                </p>
              )}
            </div>
          )}

          {/* Emergency Contact Section */}
          {(emergencyContact || contactEncrypted) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-red-600 dark:text-red-400" />
                <h4 className="text-ds-small font-semibold text-slate-900 dark:text-slate-100">
                  Emergency Contact
                </h4>
              </div>
              {contactEncrypted ? (
                <p className="text-ds-small text-slate-500 dark:text-slate-400 italic">
                  Medical information is encrypted and requires decryption to view.
                </p>
              ) : (
                <p className="text-ds-small text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {emergencyContact || 'None recorded'}
                </p>
              )}
            </div>
          )}

          {/* Show message if all data is encrypted */}
          {!hasDecryptedData && (allergiesEncrypted || notesEncrypted || contactEncrypted) && (
            <div className="mt-4 p-3 rounded-ds-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-ds-small text-amber-800 dark:text-amber-200">
                All medical information is encrypted. Please contact an administrator to view
                decrypted data.
              </p>
            </div>
          )}
        </div>
      </Accordion>
    </div>
  );
}
