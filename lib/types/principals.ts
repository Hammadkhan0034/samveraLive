/**
 * Principal type matching the structure used in components and API responses
 */
export interface Principal {
  id: string;
  org_id: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  role?: string;
  role_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

/**
 * Paginated principals response from API
 */
export interface PaginatedPrincipalsResponse {
  principals: Principal[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
