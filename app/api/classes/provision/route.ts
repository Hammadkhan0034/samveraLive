import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({} as any))
    const className: string | undefined = body.className
    const orgIdBody: string | undefined = body.orgId
    const orgSlug: string | undefined = body.orgSlug
    if (!className || className.trim().length === 0) {
      return NextResponse.json({ error: 'className is required' }, { status: 400 })
    }

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


