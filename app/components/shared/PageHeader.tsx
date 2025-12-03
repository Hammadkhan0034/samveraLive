'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Menu } from 'lucide-react';
import ProfileSwitcher from '@/app/components/ProfileSwitcher';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  headingLevel?: 'h1' | 'h2';
  showBackButton?: boolean;
  backHref?: string;
  showProfileSwitcher?: boolean;
  showMobileMenu?: boolean;
  onMobileMenuClick?: () => void;
  rightActions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  headingLevel = 'h2',
  showBackButton = false,
  backHref,
  showProfileSwitcher = true,
  showMobileMenu = false,
  onMobileMenuClick,
  rightActions,
  className = '',
}: PageHeaderProps) {
  const router = useRouter();
  const HeadingTag = headingLevel;

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const handleMobileMenuClick = () => {
    if (onMobileMenuClick) {
      onMobileMenuClick();
    }
  };

  return (
    <div className={`mb-ds-sm flex flex-col gap-ds-sm md:flex-row md:items-center md:justify-between ${className}`}>
      <div className="flex items-center gap-4">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-ds-md border border-slate-300 px-4 py-2 text-ds-small hover:bg-mint-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {showMobileMenu && (
          <button
            onClick={handleMobileMenuClick}
            className="md:hidden p-2 rounded-ds-md hover:bg-mint-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div>
          <HeadingTag
            className={
              headingLevel === 'h1'
                ? 'text-ds-h1 font-semibold tracking-tight text-ds-text-primary dark:text-slate-100'
                : 'text-ds-h2 font-semibold tracking-tight text-ds-text-primary dark:text-slate-100'
            }
          >
            {title}
          </HeadingTag>
          <p className="mt-1 text-ds-small text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-ds-sm">
        {rightActions}
        {showProfileSwitcher && <ProfileSwitcher />}
      </div>
    </div>
  );
}

