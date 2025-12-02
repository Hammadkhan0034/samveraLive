import { NextResponse } from 'next/server';
import { requireServerAuth } from './supabaseServer';
import { supabaseAdmin } from './supabaseClient';
import { type AuthUser, type UserMetadata } from './types/auth';

/**
 * Custom error class for missing organization ID
 */
export class MissingOrgIdError extends Error {
  constructor() {
    super('User organization ID not found. Please contact support.');
    this.name = 'MissingOrgIdError';
  }
}

export async function getCurrentUserOrgId(user?: AuthUser): Promise<string> {
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

/**
 * Convenience helper to get the authenticated user and their organization ID.
 * Wraps requireServerAuth + getCurrentUserOrgId so route handlers can stay concise.
 */
export async function getAuthUserWithOrg(): Promise<AuthUser> {
  const { user } = await requireServerAuth();
  return user;
}

/**
 * Map common authentication / org resolution errors to HTTP responses.
 * Centralizes how we treat MissingOrgIdError and transient network issues.
 */
export function mapAuthErrorToResponse(err: unknown) {
  if (err instanceof MissingOrgIdError) {
    return NextResponse.json(
      {
        error: 'Organization ID not found',
        code: 'MISSING_ORG_ID',
      },
      { status: 401 }
    );
  }

  const message = err instanceof Error ? err.message : String(err);
  const isNetworkError =
    message.includes('Network error') ||
    message.includes('fetch failed') ||
    message.includes('timeout');

  if (isNetworkError) {
    return NextResponse.json(
      {
        error: 'Authentication service unavailable. Please try again.',
        retryable: true,
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  );
}

