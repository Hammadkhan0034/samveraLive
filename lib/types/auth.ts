// Authentication and user types for Supabase integration

export type SamveraRole = 'teacher' | 'principal' | 'admin' | 'guardian' | 'parent';

/**
 * Standardized interface for Supabase user_metadata
 * This ensures consistency across all user registration and update operations
 */
export interface AuthUser {
  id: string;                    // UUID
  aud: string;                   // audience, usually "authenticated"
  role: string;                  // role (e.g. "authenticated")
  email: string;
  user_metadata: UserMetadata;
  created_at: string;            // ISO timestamp
  updated_at?: string | null;    // ISO timestamp
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;

}

export interface UserMetadata {
  roles: SamveraRole[];
  activeRole: SamveraRole;
  org_id: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  org_id: string;
  role_id: number;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  role: SamveraRole;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  permissions: string[];
}

export interface AuthSession {
  user: User;
  profile: UserProfile;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends SignInCredentials {
  full_name: string;
  phone?: string;
  org_id: string;
  role_id: number;
}

export interface AuthError {
  message: string;
  code?: string;
  details?: any;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: AuthSession | null;
  loading: boolean;
  error: AuthError | null;
}

// Role mapping for database
export const ROLE_MAPPING = {
  teacher: 2,    // staff role
  principal: 1,  // admin role  
  guardian: 3    // guardian role
} as const;

// Role permissions
export const ROLE_PERMISSIONS = {
  teacher: [
    'attendance:read',
    'attendance:write',
    'children:read',
    'media:read',
    'media:write',
    'messages:read',
    'messages:write',
    'stories:write'
  ],
  principal: [
    'attendance:read',
    'children:read',
    'children:write',
    'staff:read',
    'staff:write',
    'organization:read',
    'organization:write',
    'reports:read',
    'export:read',
    'media:read',
    'messages:read',
    'messages:write'
  ],
  guardian: [
    'children:read_own',
    'attendance:read_own',
    'media:read_own',
    'messages:read_own',
    'messages:write_own',
    'stories:read_own'
  ]
} as const;
