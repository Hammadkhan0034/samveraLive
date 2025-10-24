'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          router.push('/signin?error=auth_callback_failed');
          return;
        }

        if (data.session?.user) {
          // User is authenticated, redirect based on role
          const userRole = data.session.user.user_metadata?.role || 'teacher';
          
          // Update user as active in public.users table
          const response = await fetch('/api/staff/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: data.session.user.id,
              email: data.session.user.email
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
          router.push('/signin?error=no_session');
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