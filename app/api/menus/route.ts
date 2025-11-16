import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'
import { getStableDataCacheHeaders } from '@/lib/cacheConfig'

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const classId = searchParams.get('classId')
    const day = searchParams.get('day')
    const createdBy = searchParams.get('createdBy') // Filter by creator for teachers
    
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('menus')
      .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_by,created_at,updated_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('day', { ascending: false })

    
    if (classId) {
      query = query.eq('class_id', classId)
    }
    // If no classId, don't filter - show all menus for the org

    // Filter by created_by if provided (for teachers to see only their menus)
    if (createdBy) {
      query = query.eq('created_by', createdBy)
    }

    if (day) {
      query = query.eq('day', day)
    }

    const { data: menus, error } = await query

    if (error) {
      console.error('❌ Error fetching menus:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      menus: menus || [],
      total_menus: menus?.length || 0
    }, {
      status: 200,
      headers: getStableDataCacheHeaders()
    })

  } catch (err: any) {
    console.error('❌ Error in menus GET:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { org_id, class_id, day, breakfast, lunch, snack, notes, is_public = true, created_by } = body || {}
    
    if (!org_id || !day) {
      return NextResponse.json({ 
        error: 'Missing required fields: org_id, day' 
      }, { status: 400 })
    }
    
    // Ensure class_id is null if not provided or empty string
    const finalClassId = class_id && class_id.trim() !== '' ? class_id : null
    
    // Check if menu already exists for this org_id, class_id, and day
    let query = supabaseAdmin
      .from('menus')
      .select('id')
      .eq('org_id', org_id)
      .eq('day', day)
      .is('deleted_at', null)
    
    if (finalClassId) {
      query = query.eq('class_id', finalClassId)
    } else {
      query = query.is('class_id', null)
    }
    
    const { data: existing, error: checkError } = await query.maybeSingle()
    
    // If there's an error (other than "no rows found"), return it
    if (checkError) {
      console.error('❌ Error checking for existing menu:', checkError)
      // Only return error if it's not the "no rows" error
      if (checkError.code !== 'PGRST116') {
        return NextResponse.json({ error: `Failed to check for existing menu: ${checkError.message}` }, { status: 500 })
      }
    }
    
    let result;
    if (existing?.id) {
      // Update existing menu - only update provided fields
      const updatePayload: any = { deleted_at: null };
      if (breakfast !== undefined) updatePayload.breakfast = breakfast || null;
      if (lunch !== undefined) updatePayload.lunch = lunch || null;
      if (snack !== undefined) updatePayload.snack = snack || null;
      if (notes !== undefined) updatePayload.notes = notes || null;
      if (is_public !== undefined) updatePayload.is_public = is_public;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('menus')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_at,updated_at')
        .single()
      
      if (updateError) {
        console.error('❌ Failed to update menu:', updateError)
        return NextResponse.json({ error: `Failed to update menu: ${updateError.message}` }, { status: 500 })
      }
      
      result = updated
      console.log('✅ Menu updated successfully:', updated.id)
    } else {
      // Insert new menu
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('menus')
        .insert({
          org_id,
          class_id: finalClassId,
          day,
          breakfast: breakfast || null,
          lunch: lunch || null,
          snack: snack || null,
          notes: notes || null,
          is_public: is_public !== undefined ? is_public : true,
          created_by: created_by || null,
          deleted_at: null,
        })
        .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_by,created_at,updated_at')
        .single()
      
      if (insertError) {
        console.error('❌ Failed to create menu:', insertError)
        return NextResponse.json({ error: `Failed to create menu: ${insertError.message}` }, { status: 500 })
      }
      
      result = inserted
      console.log('✅ Menu created successfully:', inserted.id)
    }

    return NextResponse.json({ 
      menu: result,
      message: 'Menu created/updated successfully!'
    }, { status: 201 })

  } catch (err: any) {
    console.error('❌ Error in menus POST:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { id, breakfast, lunch, snack, notes, is_public } = body || {}
    
    if (!id) {
      return NextResponse.json({ 
        error: 'Missing required field: id' 
      }, { status: 400 })
    }

    console.log('📋 Updating menu:', id);

    const { data: updated, error } = await supabaseAdmin
      .from('menus')
      .update({
        breakfast: breakfast !== undefined ? breakfast : null,
        lunch: lunch !== undefined ? lunch : null,
        snack: snack !== undefined ? snack : null,
        notes: notes !== undefined ? notes : null,
        is_public: is_public !== undefined ? is_public : true,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id,org_id,class_id,day,breakfast,lunch,snack,notes,is_public,created_at,updated_at')
      .single()

    if (error) {
      console.error('❌ Failed to update menu:', error)
      return NextResponse.json({ error: `Failed to update menu: ${error.message}` }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    console.log('✅ Menu updated successfully:', updated.id)

    return NextResponse.json({ 
      menu: updated,
      message: 'Menu updated successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in menus PUT:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured. Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
      return NextResponse.json({ 
        error: 'Admin client not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    console.log('🗑️ Soft deleting menu:', id)

    // Soft delete by setting deleted_at
    const { error } = await supabaseAdmin
      .from('menus')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('❌ Failed to delete menu:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Menu deleted successfully')

    return NextResponse.json({ 
      message: 'Menu deleted successfully!'
    }, { status: 200 })

  } catch (err: any) {
    console.error('❌ Error in menus DELETE:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

