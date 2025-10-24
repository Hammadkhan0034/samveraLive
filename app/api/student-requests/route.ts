import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET - Fetch student requests for a class or organization
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const classIds = searchParams.get('classIds'); // Multiple class IDs for teachers
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status'); // 'pending', 'approved', 'rejected'

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('student_requests')
      .select(`
        id,
        first_name,
        last_name,
        dob,
        gender,
        class_id,
        status,
        requested_by,
        approved_by,
        approved_at,
        rejected_by,
        rejected_at,
        created_at,
        medical_notes,
        allergies,
        emergency_contact
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    } else if (classIds) {
      // Handle multiple class IDs for teachers
      const classIdArray = classIds.split(',');
      query = query.in('class_id', classIdArray);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching student requests:', error);
      return NextResponse.json({ error: 'Failed to fetch student requests' }, { status: 500 });
    }

    return NextResponse.json({ student_requests: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/student-requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new student request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📝 Student request body:', body);
    
    const { 
      first_name, 
      last_name, 
      dob, 
      gender, 
      class_id, 
      org_id, 
      requested_by,
      medical_notes,
      allergies,
      emergency_contact
    } = body;

    console.log('🔍 Validating fields:', { first_name, class_id, org_id, requested_by });

    // Validate required fields
    if (!first_name || !class_id || !org_id || !requested_by) {
      console.error('❌ Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const insertData = {
      first_name,
      last_name,
      dob,
      gender: gender || 'unknown',
      class_id,
      org_id,
      requested_by,
      status: 'pending',
      medical_notes,
      allergies,
      emergency_contact,
      created_at: new Date().toISOString()
    };

    console.log('💾 Inserting data:', insertData);

    // Create student request
    const { data, error } = await supabaseAdmin
      .from('student_requests')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Database error creating student request:', error);
      return NextResponse.json({ error: `Failed to create student request: ${error.message}` }, { status: 500 });
    }

    console.log('✅ Student request created successfully:', data);
    return NextResponse.json({ student_request: data });
  } catch (error: any) {
    console.error('💥 Error in POST /api/student-requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update student request status (approve/reject)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, approved_by, rejected_by } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'approved') {
      updateData.approved_by = approved_by;
      updateData.approved_at = new Date().toISOString();
    } else if (status === 'rejected') {
      updateData.rejected_by = rejected_by;
      updateData.rejected_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('student_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating student request:', error);
      return NextResponse.json({ error: 'Failed to update student request' }, { status: 500 });
    }

    // If approved, create the actual student record
    if (status === 'approved') {
      const { data: studentData, error: studentError } = await supabaseAdmin
        .from('students')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          dob: data.dob,
          gender: data.gender,
          class_id: data.class_id,
          org_id: data.org_id,
          medical_notes_encrypted: data.medical_notes,
          allergies_encrypted: data.allergies,
          emergency_contact_encrypted: data.emergency_contact,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (studentError) {
        console.error('Error creating student after approval:', studentError);
        return NextResponse.json({ error: 'Failed to create student after approval' }, { status: 500 });
      }

      return NextResponse.json({ 
        student_request: data, 
        student: studentData,
        message: 'Student request approved and student created successfully'
      });
    }

    return NextResponse.json({ 
      student_request: data,
      message: `Student request ${status} successfully`
    });
  } catch (error: any) {
    console.error('Error in PUT /api/student-requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a student request
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Student request ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('student_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting student request:', error);
      return NextResponse.json({ error: 'Failed to delete student request' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Student request deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/student-requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
