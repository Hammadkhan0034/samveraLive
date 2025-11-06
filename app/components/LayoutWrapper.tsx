'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/app/components/Navbar'; // your navbar component

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide navbar on landing page (/) and signin page (/signin)
  const hideNavbar = pathname === '/' || pathname === '/signin' || pathname.startsWith('/signin?');

  return (
    <>
      {!hideNavbar && <Navbar />}
      {children}
    </>
  );
}
