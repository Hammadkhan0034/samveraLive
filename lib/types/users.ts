/**
 * User type definitions matching the database schema
 * Based on the users table in schema.sql
 */

export type UserRoleType = 'principal' | 'staff' | 'guardian' | 'student';
export type GenderType = 'male' | 'female' | 'other' | 'unknown';
export type StaffStatusType = 'active' | 'inactive' | 'holiday' | 'sick_leave' | 'maternity_leave' | 'casual_leave';

/**
 * User interface matching the users table schema
 */
export interface User {
  id: string; // uuid
  org_id: string; // uuid
  email: string | null; // citext
  phone: string | null;
  ssn: string | null;
  address: string | null;
  canLogin: boolean;
  first_name: string;
  last_name: string | null;
  role: UserRoleType | null;
  bio: string | null;
  avatar_url: string | null;
  gender: GenderType;
  last_login_at: string | null; // timestamptz
  is_active: boolean;
  is_staff: boolean;
  status: StaffStatusType | null;
  dob: string | null; // date
  theme: 'light' | 'dark';
  language: 'en' | 'is';
  deleted_at: string | null; // timestamptz
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}
