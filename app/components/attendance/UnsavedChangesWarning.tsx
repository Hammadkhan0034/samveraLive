'use client';

import React from 'react';
import { enText } from '@/lib/translations/en';
import { isText } from '@/lib/translations/is';

interface UnsavedChangesWarningProps {
  lang: 'is' | 'en';
}

export const UnsavedChangesWarning = React.memo<UnsavedChangesWarningProps>(
  function UnsavedChangesWarning({ lang }) {
    const t = lang === 'is' ? isText : enText;
    return (
      <div className="mb-2 sm:mb-ds-sm rounded-ds-md bg-amber-50 border border-amber-200 p-2 sm:p-3 text-ds-tiny sm:text-ds-small text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
        {t.unsaved_changes_warning || (lang === 'is'
          ? 'Þú hefur óvistaðar breytingar. Smelltu á "Vista" til að vista.'
          : 'You have unsaved changes. Click "Save" to save.')}
      </div>
    );
  }
);

