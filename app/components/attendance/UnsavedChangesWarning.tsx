'use client';

import React from 'react';

interface UnsavedChangesWarningProps {
  lang: 'is' | 'en';
}

export const UnsavedChangesWarning = React.memo<UnsavedChangesWarningProps>(
  function UnsavedChangesWarning({ lang }) {
    return (
      <div className="mb-ds-sm rounded-ds-md bg-amber-50 border border-amber-200 p-3 text-ds-small text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
        {lang === 'is'
          ? 'Þú hefur óvistaðar breytingar. Smelltu á "Vista" til að vista.'
          : 'You have unsaved changes. Click "Save" to save.'}
      </div>
    );
  }
);

