'use client';

import React from 'react';
import Image from 'next/image';
import { Phone, Mail, MessageCircle, UserRound, MapPin } from 'lucide-react';

// Helper function to get initials from a name
function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  gender?: string;
  status?: string;
  imageUrl?: string | null;
  onCall?: () => void;
  onMessage?: () => void;
  onViewProfile?: () => void;
}

interface ContactCardsProps {
  contact: Contact;
}

export default function ContactCards({ contact }: ContactCardsProps) {
  return (
    <section className="mb-4 sm:mb-ds-lg">
      <div className="grid grid-cols-12">
        <div className="col-span-12 sm:col-span-4">
          <div className="bg-white dark:bg-slate-800 rounded-ds-lg p-3 sm:p-ds-md shadow-ds-card dark:shadow-slate-900/50 dark:border dark:border-slate-700/50 flex flex-col h-full transition-colors">
        <div className="flex-1">
          <div className="flex items-start gap-2 sm:gap-ds-md mb-2 sm:mb-ds-md">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-mint-100 dark:bg-mint-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {contact.imageUrl ? (
                <Image
                  src={contact.imageUrl}
                  alt={contact.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-base sm:text-lg font-bold text-mint-600 dark:text-mint-400">
                  {getInitials(contact.name)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-ds-small sm:text-ds-h3 font-bold text-mint-600 dark:text-mint-300 mb-1 sm:mb-ds-sm truncate">
                {contact.name}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1 sm:mb-ds-sm">
                {contact.gender && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-ds-sm text-ds-tiny font-medium bg-mint-100 dark:bg-mint-900/40 dark:border dark:border-mint-800/50 text-mint-700 dark:text-mint-200">
                    {contact.gender}
                  </span>
                )}
                {contact.status && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-ds-sm text-ds-tiny font-medium bg-mint-100 dark:bg-mint-900/40 dark:border dark:border-mint-800/50 text-mint-700 dark:text-mint-200">
                    {contact.status}
                  </span>
                )}
              </div>
            </div>
          </div>
          {contact.address && (
            <div className="mb-2 sm:mb-0">
              <div className="flex items-start gap-1.5 sm:gap-2 text-ds-tiny sm:text-ds-small text-ds-text-secondary dark:text-slate-300">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-mint-600 dark:text-mint-400 flex-shrink-0 mt-0.5" />
                <span className="break-words">{contact.address}</span>
              </div>
            </div>
          )}
          <div className="mb-2 sm:mb-ds-md space-y-1">
            <div className="flex items-center gap-1.5 sm:gap-2 text-ds-tiny sm:text-ds-small text-ds-text-secondary dark:text-slate-300">
              <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-mint-600 dark:text-mint-400 flex-shrink-0" />
              <span className="truncate">{contact.phone}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-ds-tiny sm:text-ds-small text-ds-text-secondary dark:text-slate-300">
              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-mint-600 dark:text-mint-400 flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4 pt-2 sm:pt-ds-sm mt-auto border-t border-slate-200 dark:border-slate-700/50">
          <button
            onClick={contact.onCall}
            className="flex-1 min-w-[80px] sm:min-w-[100px] flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-full border border-input-stroke dark:border-slate-600 bg-mint-50 dark:bg-slate-700/50 text-mint-600 dark:text-mint-300 hover:bg-mint-100 dark:hover:bg-slate-700 dark:hover:border-mint-700/50 active:bg-mint-200 dark:active:bg-slate-600 transition-all duration-200 text-ds-tiny sm:text-ds-small font-medium"
          >
            <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Call</span>
          </button>
          <button
            onClick={contact.onMessage}
            className="flex-1 min-w-[80px] sm:min-w-[100px] flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-full border border-input-stroke dark:border-slate-600 bg-mint-50 dark:bg-slate-700/50 text-mint-600 dark:text-mint-300 hover:bg-mint-100 dark:hover:bg-slate-700 dark:hover:border-mint-700/50 active:bg-mint-200 dark:active:bg-slate-600 transition-all duration-200 text-ds-tiny sm:text-ds-small font-medium"
          >
            <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Message</span>
          </button>
          <button
            onClick={contact.onViewProfile}
            className="flex-1 min-w-[80px] sm:min-w-[100px] flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-full border border-input-stroke dark:border-slate-600 bg-mint-50 dark:bg-slate-700/50 text-mint-600 dark:text-mint-300 hover:bg-mint-100 dark:hover:bg-slate-700 dark:hover:border-mint-700/50 active:bg-mint-200 dark:active:bg-slate-600 transition-all duration-200 text-ds-tiny sm:text-ds-small font-medium"
          >
            <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">View Profile</span>
            <span className="sm:hidden">Profile</span>
          </button>
        </div>
          </div>
        </div>
      </div>
    </section>
  );
}

