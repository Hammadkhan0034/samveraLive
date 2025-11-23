// Helper function to create test users for development
// This bypasses email validation by using admin privileges
import { supabaseAdmin } from '@/lib/supabaseClient';
import { type UserMetadata } from '@/lib/types/auth';

export async function createUserAuthEntry (
  email: string, 
  password: string, 
  role: 'parent' | 'teacher' | 'principal' | 'admin' = 'parent',
  fullName?: string
) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not available. Check SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  try {
    console.log('Creating  user auth entry with admin privileges...');
    
    // Create user with admin client
    const userMetadata: UserMetadata = {
      roles: [role],
      activeRole: role,
    };
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: userMetadata,
    });

    if (error) {
      console.error('Admin user creation failed:', error);
      return { error };
    }

    console.log('Test user created successfully:', data);
    return { data, error: null };
  } catch (err) {
    console.error('Exception creating test user:', err);
    return { error: err };
  }
}
