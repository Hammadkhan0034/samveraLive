import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody, classIdSchema } from '@/lib/validation';
import type { AuthUser, UserMetadata, SamveraRole } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// POST body schema
const provisionOrgBodySchema = z.object({
  orgName: z.string().min(1).max(200).optional().default('My School'),
  slug: z.string().min(1).max(100).transform((val) => val.toLowerCase()).optional().default('my-school'),
  timezone: z.string().min(1).max(100).optional().default('UTC'),
  roleId: z.number().int().nullable().optional(),
  classId: classIdSchema.optional(),
});

export async function handlePostProvision(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const bodyValidation = validateBody(provisionOrgBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { orgName, slug, timezone, roleId, classId } = bodyValidation.data;

    // 1) Upsert organization by slug
    const { data: orgRow, error: orgErr } = await adminClient
      .from('orgs')
      .upsert({ name: orgName, slug, timezone }, { onConflict: 'slug' })
      .select('id')
      .single();

    if (orgErr) {
      return NextResponse.json(
        { error: `Failed to upsert org: ${orgErr.message}` },
        { status: 500 },
      );
    }

    const orgId = orgRow.id as string;

    // 2) Provision domain user row with allowed email domain
    const rawEmail = user.email || null;
    const allowed = rawEmail && /@.*\.(edu|org|gov|com)$/i.test(rawEmail);
    const email = allowed ? rawEmail : `user+${user.id.slice(0, 8)}@samvera.com`;

    const upsertUser: Record<string, any> = {
      id: user.id,
      email,
      full_name: 'User',
      org_id: orgId,
      is_active: true,
      metadata: user.user_metadata || {},
    };
    if (roleId !== null) upsertUser.role_id = roleId;

    const { error: userUpErr } = await adminClient
      .from('users')
      .upsert(upsertUser, { onConflict: 'id' });

    if (userUpErr) {
      return NextResponse.json(
        { error: `Failed to upsert domain user: ${userUpErr.message}` },
        { status: 500 },
      );
    }

    // 3) Update auth metadata to include org_id and roles
    const roles: string[] = Array.isArray(user.user_metadata?.roles)
      ? user.user_metadata.roles
      : [];
    const activeRole: string | undefined = user.user_metadata
      ?.activeRole as string | undefined;
    const defaultRole = roles.length ? roles[0] : 'teacher';

    const finalRoles = roles.length ? roles : [defaultRole];
    const finalActive =
      activeRole && finalRoles.includes(activeRole)
        ? activeRole
        : finalRoles[0];

    const newMetadata: UserMetadata = {
      roles: finalRoles as SamveraRole[],
      activeRole: finalActive as SamveraRole,
      org_id: orgId,
    };

    const { error: updErr } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: newMetadata,
      },
    );

    if (updErr) {
      return NextResponse.json(
        { error: `Failed to update auth metadata: ${updErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      org_id: orgId,
      user_id: user.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 },
    );
  }
}

