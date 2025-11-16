import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { z } from 'zod'
import { validateBody, orgIdSchema, nameSchema } from '@/lib/validation'

// POST body schema
const provisionClassBodySchema = z.object({
  className: nameSchema,
  orgId: orgIdSchema.optional(),
  orgSlug: z.string().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // The `setAll` method was called from a Route Handler.
            }
          },
        },
      }
    )

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({} as any))
    const bodyValidation = validateBody(provisionClassBodySchema, body)
    if (!bodyValidation.success) {
      return bodyValidation.error
    }
    const { className, orgId: orgIdBody, orgSlug } = bodyValidation.data

    // Resolve orgId: body.orgId -> auth metadata -> org by slug
    let orgId: string | undefined = orgIdBody
      || (user.user_metadata?.org_id as string | undefined)
      || (user.user_metadata?.organization_id as string | undefined)

    if (!orgId && orgSlug) {
      const { data: orgRow, error: orgErr } = await supabaseAdmin
        .from('orgs')
        .select('id')
        .eq('slug', orgSlug)
        .maybeSingle()
      if (orgErr) return NextResponse.json({ error: `Failed to resolve org: ${orgErr.message}` }, { status: 500 })
      orgId = (orgRow as any)?.id
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId (provide orgId/orgSlug or set org_id in user metadata)' }, { status: 400 })
    }

    // Upsert class by (org_id, name)
    const { data: clsRow, error: clsErr } = await supabaseAdmin
      .from('classes')
      .upsert({ org_id: orgId, name: className }, { onConflict: 'org_id,name' })
      .select('id')
      .single()
    if (clsErr) return NextResponse.json({ error: `Failed to upsert class: ${clsErr.message}` }, { status: 500 })

    const classId: string = (clsRow as any).id

    // Update domain users row for linkage (best-effort)
    await supabaseAdmin
      .from('users')
      .upsert({ id: user.id, org_id: orgId }, { onConflict: 'id' })

    // Update auth metadata so the app uses this class_id automatically
    const newMetadata = {
      ...user.user_metadata,
      org_id: orgId,
      class_id: classId,
      roles: Array.isArray(user.user_metadata?.roles) && user.user_metadata.roles.length
        ? user.user_metadata.roles
        : ['teacher'],
      activeRole: user.user_metadata?.activeRole || 'teacher',
    }
    const { error: updErr } = await supabase.auth.updateUser({ data: newMetadata })
    if (updErr) return NextResponse.json({ error: `Failed to update auth metadata: ${updErr.message}` }, { status: 500 })

    return NextResponse.json({ success: true, class_id: classId, org_id: orgId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


