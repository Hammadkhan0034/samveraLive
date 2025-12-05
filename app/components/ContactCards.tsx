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
  contacts: Contact[];
}

export default function ContactCards({ contacts }: ContactCardsProps) {
  return (
    <section className="mb-ds-lg">
      <div className="grid grid-cols-1 gap-ds-md sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-white dark:bg-slate-800 rounded-ds-lg p-ds-md shadow-ds-card flex flex-col h-full"
          >
            <div className="flex-1">
              <div className="flex items-start gap-ds-md mb-ds-md">
                <div className="w-16 h-16 rounded-full bg-mint-100 dark:bg-mint-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {contact.imageUrl ? (
                    <Image
                      src={contact.imageUrl}
                      alt={contact.name}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-mint-600 dark:text-mint-400">
                      {getInitials(contact.name)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-ds-h3 font-bold text-mint-600 dark:text-mint-400 mb-ds-sm">
                    {contact.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mb-ds-sm">
                    {contact.gender && (
                      <span className="px-2 py-0.5 rounded-ds-sm text-ds-tiny font-medium bg-mint-100 dark:bg-mint-900/30 text-mint-700 dark:text-mint-300">
                        {contact.gender}
                      </span>
                    )}
                    {contact.status && (
                      <span className="px-2 py-0.5 rounded-ds-sm text-ds-tiny font-medium bg-mint-100 dark:bg-mint-900/30 text-mint-700 dark:text-mint-300">
                        {contact.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {contact.address && (
                <div className="">
                  <div className="flex items-start gap-2 text-ds-small text-ds-text-secondary dark:text-slate-400">
                    <MapPin className="h-4 w-4 text-mint-600 dark:text-mint-400 flex-shrink-0 mt-0.5" />
                    <span>{contact.address}</span>
                  </div>
                </div>
              )}
              <div className="mb-ds-md">
                <div className="flex items-center gap-2 text-ds-small text-ds-text-secondary dark:text-slate-400">
                  <Phone className="h-4 w-4 text-mint-600 dark:text-mint-400 flex-shrink-0" />
                  <span>{contact.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-ds-small text-ds-text-secondary dark:text-slate-400">
                  <Mail className="h-4 w-4 text-mint-600 dark:text-mint-400 flex-shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-ds-sm mt-auto">
              <button
                onClick={contact.onCall}
                className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-input-stroke dark:border-slate-700 bg-mint-50 dark:bg-mint-900/20 text-mint-600 dark:text-mint-400 hover:bg-mint-100 dark:hover:bg-mint-900/30 transition-colors text-ds-small font-medium"
              >
                <Phone className="h-4 w-4" />
                <span>Call</span>
              </button>
              <button
                onClick={contact.onMessage}
                className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-input-stroke dark:border-slate-700 bg-mint-50 dark:bg-mint-900/20 text-mint-600 dark:text-mint-400 hover:bg-mint-100 dark:hover:bg-mint-900/30 transition-colors text-ds-small font-medium"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Message</span>
              </button>
              <button
                onClick={contact.onViewProfile}
                className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-input-stroke dark:border-slate-700 bg-mint-50 dark:bg-mint-900/20 text-mint-600 dark:text-mint-400 hover:bg-mint-100 dark:hover:bg-mint-900/30 transition-colors text-ds-small font-medium"
              >
                <UserRound className="h-4 w-4" />
                <span>View Profile</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

