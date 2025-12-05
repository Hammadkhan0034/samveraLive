import { NextResponse } from 'next/server';
import { requireServerAuth } from './supabaseServer';
import { supabaseAdmin } from './supabaseClient';
import { type AuthUser, type UserMetadata, type SamveraRole } from './types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthRequiredError, ForbiddenError, NetworkAuthError } from './auth-errors';

/**
 * Custom error class for missing organization ID
 */
export class MissingOrgIdError extends Error {
  constructor() {
    super('User organization ID not found. Please contact support.');
    this.name = 'MissingOrgIdError';
  }
}

export type AuthOptions = {
  requireOrg?: boolean;
  allowedRoles?: SamveraRole[];
};

export async function getRequestAuthContext(
  options: AuthOptions = {}
): Promise<{ user: AuthUser }> {
  const { user } = await requireServerAuth();
  const metadata = user.user_metadata as UserMetadata | undefined;

  const roles = (metadata?.roles ?? []) as SamveraRole[];
  const activeRole = metadata?.activeRole as SamveraRole | undefined;
  const orgId = metadata?.org_id;

  if (options.allowedRoles && options.allowedRoles.length > 0) {
    // Check if user has any of the required roles in their roles array
    const hasAnyRequired = roles.length > 0 
      ? roles.some((role) => options.allowedRoles!.includes(role))
      : false;
    
    // Also check activeRole as fallback (similar to client-side logic)
    const hasActiveRole = activeRole && options.allowedRoles!.includes(activeRole);
    
    if (!hasAnyRequired && !hasActiveRole) {
      throw new ForbiddenError();
    }
  }

  if (options.requireOrg && !orgId) {
    throw new MissingOrgIdError();
  }

  return { user };
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


export async function getAuthUserWithOrg(): Promise<AuthUser> {
  const { user } = await requireServerAuth();
  return user;
}


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

  if (err instanceof AuthRequiredError) {
    return NextResponse.json(
      { error: err.message || 'Authentication required' },
      { status: 401 }
    );
  }

  if (err instanceof ForbiddenError) {
    return NextResponse.json(
      { error: err.message || 'Access denied. Valid role required.' },
      { status: 403 }
    );
  }

  if (err instanceof NetworkAuthError) {
    return NextResponse.json(
      {
        error: 'Authentication service unavailable. Please try again.',
        retryable: true,
      },
      { status: 503 }
    );
  }

  const message = err instanceof Error ? err.message : String(err);
  const isNetworkError =
    message.includes('Network error') ||
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('Connect Timeout');

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

export async function withAuthRoute(
  _request: Request,
  options: AuthOptions,
  handler: (
    user: AuthUser,
    adminClient: SupabaseClient
  ) => Promise<ReturnType<typeof NextResponse.json>>
) {
  try {
    const { user } = await getRequestAuthContext(options);

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local',
        },
        { status: 500 }
      );
    }

    return await handler(user, supabaseAdmin);
  } catch (err) {
    return mapAuthErrorToResponse(err);
  }
}

