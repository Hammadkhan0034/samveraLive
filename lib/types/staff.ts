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
  class_id: string;
  role: string;
  is_active?: boolean;
}

