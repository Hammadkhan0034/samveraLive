'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Database, Activity, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export function SystemStatus() {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0 }}
      className="mt-4 sm:mt-6 lg:mt-8"
    >
      <div className="bg-white dark:bg-slate-800 rounded-ds-md p-3 sm:p-4 lg:p-ds-md shadow-ds-card border border-slate-200 dark:border-slate-700">
        <h3 className="text-ds-small sm:text-ds-h3 font-semibold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          {t.systemStatus}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-ds-md bg-green-50 dark:bg-green-900/20">
            <div className="p-1.5 sm:p-2 bg-green-500 rounded-ds-md flex-shrink-0">
              <Database className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-ds-tiny sm:text-ds-small font-medium text-green-900 dark:text-green-100">{t.database}</p>
              <p className="text-ds-tiny sm:text-sm text-green-600 dark:text-green-400">{t.operational}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="p-1.5 sm:p-2 bg-green-500 rounded-lg flex-shrink-0">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-ds-tiny sm:text-ds-small font-medium text-green-900 dark:text-green-100">{t.api}</p>
              <p className="text-ds-tiny sm:text-sm text-green-600 dark:text-green-400">{t.healthy}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <div className="p-1.5 sm:p-2 bg-yellow-500 rounded-lg flex-shrink-0">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-ds-tiny sm:text-ds-small font-medium text-yellow-900 dark:text-yellow-100">{t.backup}</p>
              <p className="text-ds-tiny sm:text-sm text-yellow-600 dark:text-yellow-400">{t.pending}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
