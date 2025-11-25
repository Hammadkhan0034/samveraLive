import { requireServerAuth } from './supabaseServer';
import { supabaseAdmin } from './supabaseClient';
import type { User } from '@supabase/supabase-js';
import { type UserMetadata } from './types/auth';

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
 * Get the current authenticated user's organization ID.
 * Checks user_metadata first, then falls back to database query.
 * Throws MissingOrgIdError if org_id cannot be found after both checks.
 * 
 * @param user - Optional user object. If not provided, will get from requireServerAuth()
 * @returns Promise<string> - The organization ID
 * @throws MissingOrgIdError - If org_id is not found in metadata or database
 */
export async function getCurrentUserOrgId(user?: User): Promise<string> {
  // Get user from parameter or auth
  const targetUser = user ?? (await requireServerAuth()).user;
  
  // Step 1: Check user_metadata first (fastest, no DB query)
  const userMetadata = targetUser.user_metadata as UserMetadata | undefined;
  const orgIdFromMetadata = userMetadata?.org_id;
  
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
    .eq('id', targetUser.id)
    .maybeSingle();
  
  if (error || !data?.org_id) {
    throw new MissingOrgIdError();
  }
  
  return data.org_id;
}

