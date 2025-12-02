// Helper function to create test users for development
// This bypasses email validation by using admin privileges
import { supabaseAdmin } from '@/lib/supabaseClient';
import { type UserMetadata, type SamveraRole } from '@/lib/types/auth';

export async function createUserAuthEntry (
  email: string, 
  password: string, 
  role: SamveraRole = 'guardian',
  fullName?: string
) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not available. Check SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  try {
    console.log('Creating  user auth entry with admin privileges...');
    
    // Create user with admin client
    const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || '';
    if (!orgId) {
      throw new Error('NEXT_PUBLIC_DEFAULT_ORG_ID is required but not configured');
    }
    const userMetadata: UserMetadata = {
      roles: [role],
      activeRole: role,
      org_id: orgId,
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
