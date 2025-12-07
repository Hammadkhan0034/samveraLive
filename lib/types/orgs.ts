/**
 * Organization type matching the database schema
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
  updated_at: string;
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
