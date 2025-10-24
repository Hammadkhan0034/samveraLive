import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

// Teacher role ID
const TEACHER_ROLE_ID = 20

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const createdBy = searchParams.get('createdBy')
    
    let query = supabaseAdmin
      .from('classes')
      .select(`
        id,
        name,
        code,
        org_id,
        created_by,
        created_at,
        updated_at,
        assigned_teachers:class_memberships!class_id(user_id, membership_role)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    
    // Filter by creator (principal) if provided
    if (createdBy) {
      query = query.eq('created_by', createdBy)
    }
    
    // Filter by organization if provided
    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    
    const { data: classes, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get assigned teachers for each class using class_memberships table
    const classesWithTeachers = supabaseAdmin ? await Promise.all(
      (classes || []).map(async (cls) => {
        const { data: memberships } = await supabaseAdmin!
          .from('class_memberships')
          .select(`
            user_id,
            membership_role,
            users!inner(id, full_name, email, role_id)
          `)
          .eq('class_id', cls.id)
          .eq('users.role_id', TEACHER_ROLE_ID)
        
        const teachers = memberships?.map((m: any) => ({
          id: m.users.id,
          full_name: m.users.full_name,
          email: m.users.email
        })) || []
        
        return {
          ...cls,
          assigned_teachers: teachers
        }
      })
    ) : classes || []

    return NextResponse.json({ 
      classes: classesWithTeachers || []
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { name, code, created_by, teacher_id, org_id } = body || {}
    
    if (!name || !created_by) {
      return NextResponse.json({ 
        error: 'name and created_by are required' 
      }, { status: 400 })
    }

    // Get organization ID from user if not provided
    let organizationId = org_id;
    let actualCreatedBy = created_by;
    
    if (!organizationId) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('org_id')
        .eq('id', created_by)
        .single();
      
      organizationId = userData?.org_id;
    }

    // Try to find the user in the users table
    // First, try to find by the provided created_by ID (in case it's a valid users table ID)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, org_id')
      .eq('id', created_by)
      .single();

    if (existingUser) {
      actualCreatedBy = existingUser.id;
      if (!organizationId) {
        organizationId = existingUser.org_id;
      }
    } else {
      // If user doesn't exist in users table, find any user from the organization
      if (organizationId) {
        const { data: orgUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('org_id', organizationId)
          .limit(1)
          .single();
        
        if (orgUser) {
          actualCreatedBy = orgUser.id;
        }
      }
    }

    if (!organizationId) {
      return NextResponse.json({ 
        error: 'Organization ID is required' 
      }, { status: 400 })
    }

    // If we still don't have a valid created_by user, try to create a system user or use null
    if (!actualCreatedBy) {
      console.warn('⚠️ No valid user found for created_by, trying to create system user');
      
      // Try to create a system user for this organization
      try {
        const { data: systemUser, error: systemUserError } = await supabaseAdmin
          .from('users')
          .insert({
            org_id: organizationId,
            full_name: 'System User',
            role_id: 1, // admin role
            email: `system@${organizationId}.local`,
            is_active: true
          })
          .select('id')
          .single();
        
        if (systemUser && !systemUserError) {
          actualCreatedBy = systemUser.id;
          console.log('✅ Created system user for organization');
        } else {
          console.warn('⚠️ Failed to create system user, setting created_by to null');
        }
      } catch (err) {
        console.warn('⚠️ Error creating system user:', err);
      }
    }

    // Create class
    const { data: newClass, error: classError } = await supabaseAdmin
      .from('classes')
      .insert({
        name: name,
        code: code || null,
        created_by: actualCreatedBy || null,
        org_id: organizationId
      })
      .select()
      .single()

    if (classError) {
      return NextResponse.json({ error: `Failed to create class: ${classError.message}` }, { status: 500 })
    }

    // If teacher_id provided, assign teacher to class
    if (teacher_id) {
      // Get current teacher metadata
      const { data: teacher } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('id', teacher_id)
        .single()

      // Update teacher metadata with class_id
      const updatedMetadata = {
        ...(teacher?.metadata || {}),
        class_id: newClass.id
      }

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ metadata: updatedMetadata })
        .eq('id', teacher_id)

      if (updateError) {
        console.error('Failed to assign teacher to class:', updateError)
      }

      // Also update auth.users metadata
      await supabaseAdmin.auth.admin.updateUserById(teacher_id, {
        user_metadata: {
          ...updatedMetadata,
          class_id: newClass.id
        }
      })
    }

    return NextResponse.json({ 
      class: newClass,
      message: teacher_id ? 'Class created and teacher assigned' : 'Class created successfully'
    }, { status: 201 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { id, name, code, teacher_id} = body || {}
    
    if (!id) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 })
    }

    // Update class
    const updateData: any = { updated_at: new Date().toISOString() }
    if (name) updateData.name = name
    if (code !== undefined) updateData.code = code

    const { data: updatedClass, error: classError } = await supabaseAdmin
      .from('classes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (classError) {
      return NextResponse.json({ error: classError.message }, { status: 500 })
    }

    // If teacher_id provided, update assignment
    if (teacher_id) {
      // Get current teacher metadata
      const { data: teacher } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('id', teacher_id)
        .single()

      // Update teacher metadata with class_id
      const updatedMetadata = {
        ...(teacher?.metadata || {}),
        class_id: id
      }

      await supabaseAdmin
        .from('users')
        .update({ metadata: updatedMetadata })
        .eq('id', teacher_id)

      // Also update auth.users metadata
      await supabaseAdmin.auth.admin.updateUserById(teacher_id, {
        user_metadata: {
          ...updatedMetadata,
          class_id: id
        }
      })
    }

    return NextResponse.json({ class: updatedClass }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Admin client not configured' 
      }, { status: 500 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 })
    }

    // Soft delete (set deleted_at)
    const { error } = await supabaseAdmin
      .from('classes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Remove class memberships when class is deleted
    const { error: membershipError } = await supabaseAdmin
      .from('class_memberships')
      .delete()
      .eq('class_id', id)

    if (membershipError) {
      console.error('Failed to remove class memberships:', membershipError)
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

