// Helper function to create test users for development
// This bypasses email validation by using admin privileges
import { supabaseAdmin } from './supabaseClient';
import { type UserMetadata } from './types/auth';

export async function createTestUser(
  email: string, 
  password: string, 
  role: 'parent' | 'teacher' | 'principal' | 'admin' = 'parent',
  fullName?: string
) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not available. Check SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  try {
    console.log('Creating test user with admin privileges...');
    
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

// Pre-configured test credentials for roles
export const TEST_USERS = {
  parent: {
    email: 'parent@samvera.test',
    password: 'parent123456',
    role: 'parent' as const,
    fullName: 'Parent Test',
  },
  teacher: {
    email: 'teacher@samvera.test',
    password: 'teacher123456',
    role: 'teacher' as const,
    fullName: 'Teacher Test',
  },
  principal: {
    email: 'principal@samvera.test',
    password: 'principal123456',
    role: 'principal' as const,
    fullName: 'Principal Test',
  },
  admin: {
    email: 'admin@samvera.is',
    password: 'admin123456',
    role: 'admin' as const,
    fullName: 'System Administrator',
  },
} as const;

export async function createDefaultTestUser() {
  const u = TEST_USERS.parent;
  return createTestUser(u.email, u.password, u.role, u.fullName);
}

export async function createAdminUser() {
  const u = TEST_USERS.admin;
  return createTestUser(u.email, u.password, u.role, u.fullName);
}

export async function createParentUser() {
  const u = TEST_USERS.parent;
  return createTestUser(u.email, u.password, u.role, u.fullName);
}

export async function createTeacherUser() {
  const u = TEST_USERS.teacher;
  return createTestUser(u.email, u.password, u.role, u.fullName);
}

export async function createPrincipalUser() {
  const u = TEST_USERS.principal;
  return createTestUser(u.email, u.password, u.role, u.fullName);
}