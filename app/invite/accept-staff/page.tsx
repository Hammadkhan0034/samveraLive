'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AcceptStaffInvitation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const org_id = searchParams.get('org_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<any>(null);

  useEffect(() => {
    if (!token || !org_id) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    // Check for auth state changes (when magic link authenticates user)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      if (event === 'SIGNED_IN' && session) {
        handleInvitation();
      }
    });

    // Also handle initial load
    handleInvitation();

    return () => {
      subscription.unsubscribe();
    };
  }, [token, org_id]);

  const handleInvitation = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Validating invitation...', { token, org_id });
      
      // Get invitation details
      const response = await fetch(`/api/invitations/validate?token=${token}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid invitation');
      }
      
      console.log('✅ Invitation validated:', data.invitation);
      setInvitation(data.invitation);
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('👤 Current session:', session?.user?.email || 'No session');
      
      if (session && session.user) {
        console.log('✅ User authenticated, accepting invitation...');
        await acceptInvitation(session.user.id);
      } else {
        console.log('⏳ Waiting for authentication...');
        setLoading(false);
      }
      
    } catch (err: any) {
      console.error('❌ Error handling invitation:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const acceptInvitation = async (userId: string) => {
    try {
      console.log('🔄 Accepting invitation...', { token, userId, org_id });
      
      const response = await fetch('/api/invitations/accept-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          user_id: userId,
          org_id: org_id
        }),
      });

      const data = await response.json();
      console.log('✅ Invitation acceptance response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      console.log('🎉 Invitation accepted! Redirecting to teacher dashboard...');
      // Redirect to teacher dashboard
      router.push('/dashboard/teacher');
      
    } catch (err: any) {
      console.error('❌ Failed to accept invitation:', err);
      setError(err.message);
    }
  };

  const handleLogin = () => {
    // When user gets magic link, they're automatically signed in
    // Just redirect them to sign in page
    router.push(`/signin`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Invitation</h1>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/signin')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-green-500 text-4xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">You're Invited!</h1>
          <p className="text-slate-600 mb-4">
            You've been invited to join as a <strong>teacher/staff</strong>
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Please sign in to accept this invitation
          </p>
          
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Sign In to Accept
          </button>
          
          <p className="text-xs text-slate-400 mt-4">
            This invitation expires on {new Date(invitation?.expires_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
