import { requireServerAuth } from './supabaseServer';
import { supabaseAdmin } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

/**
 * Custom error class for missing organization ID
 */
export class MissingOrgIdError extends Error {
  constructor() {
    super('User organization ID not found. Please contact support.');
    this.name = 'MissingOrgIdError';
  }
}

/**
 * Get organization ID from a user object.
 * Checks user_metadata first, then falls back to database query.
 * 
 * @param user - The user object to get org_id from
 * @returns Promise<string> - The organization ID
 * @throws MissingOrgIdError - If org_id is not found in metadata or database
 */
async function getOrgIdFromUser(user: User): Promise<string> {
  // Step 1: Check user_metadata first (fastest, no DB query)
  const orgIdFromMetadata = 
    user.user_metadata?.org_id || 
    user.user_metadata?.organization_id || 
    user.user_metadata?.orgId;
  
  if (orgIdFromMetadata) {
    return orgIdFromMetadata;
  }
  
  // Step 2: Fallback to database query if metadata is missing
  if (!supabaseAdmin) {
    throw new MissingOrgIdError();
  }
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();
  
  if (error || !data?.org_id) {
    throw new MissingOrgIdError();
  }
  
  return data.org_id;
}

/**
 * Get the current authenticated user's organization ID.
 * Checks user_metadata first, then falls back to database query.
 * Throws MissingOrgIdError if org_id cannot be found after both checks.
 * 
 * @param user - Optional user object. If not provided, will get from requireServerAuth()
 * @returns Promise<string> - The organization ID
 * @throws MissingOrgIdError - If org_id is not found in metadata or database
 */
export async function getCurrentUserOrgId(user?: User): Promise<string> {
  if (user) {
    return getOrgIdFromUser(user);
  }
  
  const { user: authUser } = await requireServerAuth();
  return getOrgIdFromUser(authUser);
}

