/**
 * Staff-related types for the application
 */

/**
 * Form data interface for creating/editing staff members
 */
export interface StaffFormData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  ssn: string;
  education_level: string;
  union_membership: string;
  role: string;
  is_active?: boolean;
}

/**
 * Staff member interface representing a staff member from the API
 */
export interface StaffMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  address?: string | null;
  ssn?: string | null;
  org_id: string;
  is_active: boolean;
  created_at: string;
  role: string;
  education_level?: string | null;
  union_name?: string | null;
  full_name?: string;
  deleted_at?: string | null;
}

/**
 * Props interface for StaffManagement component
 */
export interface StaffManagementProps {
  // Reserved for future props
}

