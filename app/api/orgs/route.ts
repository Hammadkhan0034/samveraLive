import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids') || ''
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    const q = supabaseAdmin.from('orgs').select('id,name,slug,timezone,created_at,updated_at').order('created_at', { ascending: false })
    const { data, error } = ids.length ? await q.in('id', ids) : await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ orgs: data || [] }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const body = await request.json()
    const { name, slug, timezone = 'UTC' } = body || {}
    if (!name || !slug) return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('orgs').insert({ name, slug, timezone }).select('id,name,slug,timezone,created_at,updated_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ org: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const body = await request.json()
    const { id, name, slug, timezone } = body || {}
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const patch: any = {}
    if (name !== undefined) patch.name = name
    if (slug !== undefined) patch.slug = slug
    if (timezone !== undefined) patch.timezone = timezone
    const { data, error } = await supabaseAdmin.from('orgs').update(patch).eq('id', id).select('id,name,slug,timezone,created_at,updated_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ org: data }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await supabaseAdmin.from('orgs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


