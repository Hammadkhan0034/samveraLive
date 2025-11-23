'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { type UserMetadata } from '@/lib/types/auth';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Use getUser() to authenticate with server (secure)
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('Auth callback error:', error);
          router.push('/signin?error=auth_callback_failed');
          return;
        }

        if (user) {
          // User is authenticated, redirect based on role
          const userMetadata = user.user_metadata as UserMetadata | undefined;
          const userRole = userMetadata?.activeRole || userMetadata?.roles?.[0] || 'teacher';
          
          // Update user as active in public.users table
          const response = await fetch('/api/staff/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.email
            }),
          });

          if (response.ok) {
            // Redirect to appropriate dashboard
            switch (userRole) {
              case 'teacher':
                router.push('/dashboard/teacher');
                break;
              case 'principal':
                router.push('/dashboard/principal');
                break;
              case 'admin':
                router.push('/dashboard/admin');
                break;
              default:
                router.push('/dashboard/teacher');
            }
          } else {
            router.push('/signin?error=verification_failed');
          }
        } else {
          router.push('/signin?error=no_user');
        }
      } catch (error) {
        console.error('Callback error:', error);
        router.push('/signin?error=callback_error');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-slate-600">Verifying your email...</p>
      </div>
    </div>
  );
}