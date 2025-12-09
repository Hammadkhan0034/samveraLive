/**
 * Organization type matching the database schema
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  timezone: string;
  is_active: boolean;
  type?: string | null;
  total_area?: number | null;
  play_area?: number | null;
  square_meters_per_student?: number | null;
  maximum_allowed_students?: number | null;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Paginated organizations response from API
 */
export interface PaginatedOrganizationsResponse {
  orgs: Organization[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Organization metrics for detail view
 */
export interface OrganizationMetrics {
  students: number;
  teachers: number;
  parents: number;
  principals: number;
  totalUsers: number;
}

/**
 * Organization details with metrics and principals
 */
export interface OrganizationDetails extends Organization {
  metrics?: OrganizationMetrics;
}
