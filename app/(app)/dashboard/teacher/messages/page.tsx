'use client';

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import MessagesPanel from '@/app/components/shared/MessagesPanel';

export default function TeacherMessagesPage() {
  const { user, loading } = useRequireAuth('teacher');
  const { lang } = useLanguage();
  const router = useRouter();

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading messages...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const t = lang === 'is' 
    ? {
        msg_title: 'Skilaboð',
        msg_hint: 'Spjalla við stjórnanda og forráðamenn.',
        inbox: 'Innhólf',
        unread: 'nýtt',
        new_message: 'Ný skilaboð',
        to: 'Til',
        message: 'Skilaboð',
        msg_ph: 'Skrifa skilaboð...',
        send: 'Senda',
        attach: 'Hengja við',
        sent: 'Sent',
        select_recipient: 'Veldu viðtakanda',
        no_threads: 'Engin skilaboð enn',
        no_messages: 'Engin skilaboð í þessum þræði',
        loading: 'Hleður...',
        error_loading: 'Villa við að hlaða skilaboðum',
        send_message: 'Senda skilaboð',
        search_placeholder: 'Leita í samtalum...',
        teacher: 'Kennari',
        guardian: 'Forráðamaður',
        principal: 'Stjórnandi',
      }
    : {
        msg_title: 'Messages',
        msg_hint: 'Chat with principal and guardians.',
        inbox: 'Inbox',
        unread: 'new',
        new_message: 'New message',
        to: 'To',
        message: 'Message',
        msg_ph: 'Write a message...',
        send: 'Send',
        attach: 'Attach',
        sent: 'Sent',
        select_recipient: 'Select recipient',
        no_threads: 'No messages yet',
        no_messages: 'No messages in this thread',
        loading: 'Loading...',
        error_loading: 'Error loading messages',
        send_message: 'Send message',
        search_placeholder: 'Search conversations...',
        teacher: 'Teacher',
        guardian: 'Guardian',
        principal: 'Principal',
      };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 mt-10">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> {lang === 'is' ? 'Til baka' : 'Back'}
          </button>
        </div>
        <MessagesPanel t={t} lang={lang} role="teacher" />
      </main>
    </div>
  );
}

