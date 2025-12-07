import React from 'react';
import Image from 'next/image';

interface AvatarProps {
  src?: string | null;
  alt: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-lg',
};

export function Avatar({ src, alt, initials, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const displayInitials = initials || alt.charAt(0).toUpperCase();

  return (
    <div
      className={`${sizeClass} rounded-full bg-mint-100 dark:bg-mint-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={size === 'xl' ? 96 : size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          height={size === 'xl' ? 96 : size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-bold text-mint-600 dark:text-mint-400">{displayInitials}</span>
      )}
    </div>
  );
}
