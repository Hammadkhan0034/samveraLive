import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'
import { z } from 'zod'
import { validateQuery, validateBody, uuidSchema, orgIdSchema } from '@/lib/validation'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const { searchParams } = new URL(request.url)
    // GET query parameter schema
    const getOrgsQuerySchema = z.object({
      ids: z.string().optional(),
    });
    
    const queryValidation = validateQuery(getOrgsQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const idsParam = queryValidation.data.ids || ''
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).filter((id) => {
      try {
        uuidSchema.parse(id);
        return true;
      } catch {
        return false;
      }
    })
    const q = supabaseAdmin.from('orgs').select('id,name,slug,timezone,created_at,updated_at').order('created_at', { ascending: false })
    const { data, error } = ids.length ? await q.in('id', ids) : await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ orgs: data || [] }, {
      status: 200,
      headers: getStableDataCacheHeaders()
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 })
    const body = await request.json()
    // POST body schema
    const postOrgBodySchema = z.object({
      name: z.string().min(1).max(200),
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
      timezone: z.string().default('UTC'),
    });
    
    const bodyValidation = validateBody(postOrgBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { name, slug, timezone } = bodyValidation.data
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
    // PUT body schema
    const putOrgBodySchema = z.object({
      id: orgIdSchema,
      name: z.string().min(1).max(200).optional(),
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
      timezone: z.string().optional(),
    });
    
    const bodyValidation = validateBody(putOrgBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { id, name, slug, timezone } = bodyValidation.data
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
    // DELETE query parameter schema
    const deleteOrgQuerySchema = z.object({
      id: orgIdSchema,
    });
    
    const queryValidation = validateQuery(deleteOrgQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id } = queryValidation.data
    const { error } = await supabaseAdmin.from('orgs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}


