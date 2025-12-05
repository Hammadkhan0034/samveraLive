import { NextResponse } from 'next/server';

import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { validateBody, validateQuery, studentIdSchema, userIdSchema, uuidSchema } from '@/lib/validation';
import type { AuthUser, UserMetadata } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';


export async function handleGetGuardianStudents(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;
  const userRoles = metadata.roles || [];

  const { searchParams } = new URL(request.url);
  
  const getGuardianStudentsQuerySchema = z.object({
    studentId: studentIdSchema.optional(),
    guardianId: userIdSchema.optional(),
  });
  
  const queryValidation = validateQuery(getGuardianStudentsQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  
  const { studentId, guardianId } = queryValidation.data;
  
  // Check if user is a guardian (or parent, which is an alias)
  const isGuardian = userRoles.includes('guardian') || userRoles.includes('parent');
  
  // For guardians: enforce that they can only see their own relationships
  let effectiveGuardianId = guardianId;
  if (isGuardian) {
    if (guardianId) {
      // Security check: guardians cannot query for other guardians' relationships
      if (guardianId !== userId) {
        return NextResponse.json(
          { error: 'Access denied. You can only view your own guardian-student relationships.' },
          { status: 403 }
        );
      }
      effectiveGuardianId = userId;
    } else {
      // Auto-filter by authenticated user's ID for guardians
      effectiveGuardianId = userId;
    }
  }
  
  // Simplified query - just get the relationships without user join
  // The join can fail if the foreign key doesn't exist or if full_name column doesn't exist
  let query = adminClient
    .from('guardian_students')
    .select(`
      id,
      guardian_id,
      student_id,
      relation,
      created_at
    `)
    .eq('org_id', orgId);

  if (studentId) {
    query = query.eq('student_id', studentId);
  }
  
  if (effectiveGuardianId) {
    query = query.eq('guardian_id', effectiveGuardianId);
  }

  const { data: relationships, error } = await query;

  if (error) {
    console.error('❌ Error fetching guardian-student relationships:', error);
    console.error('❌ Query details:', { studentId, guardianId: effectiveGuardianId });
    console.error('❌ Full error:', JSON.stringify(error, null, 2));
    
    // Return empty array instead of error for better UX
    // This allows the parent dashboard to continue working
    return NextResponse.json({ 
      relationships: [],
      total_relationships: 0,
      error: error.message || 'Failed to fetch guardian-student relationships'
    }, { 
      status: 200, // Return 200 with empty data instead of 500
      headers: getUserDataCacheHeaders()
    });
  }

  return NextResponse.json({ 
    relationships: relationships || [],
    total_relationships: relationships?.length || 0
  }, { 
    status: 200,
    headers: getUserDataCacheHeaders()
  });
}

/**
 * Handler for POST /api/guardian-students
 * Creates a new guardian-student relationship
 * Only principals can create these relationships
 */
export async function handlePostGuardianStudent(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const body = await request.json();
  
  const postGuardianStudentBodySchema = z.object({
    guardian_id: userIdSchema,
    student_id: studentIdSchema,
    relation: z.enum(['parent', 'guardian', 'other']).default('parent'),
  });
  
  const bodyValidation = validateBody(postGuardianStudentBodySchema, body);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }
  
  const { guardian_id, student_id, relation } = bodyValidation.data;
  
  // Validate that the student belongs to the same organization for security
  const { data: studentRow, error: studentErr } = await adminClient
    .from('students')
    .select('org_id')
    .eq('id', student_id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (studentErr || !studentRow) {
    console.error('❌ Student not found or does not belong to the same organization', studentErr);
    return NextResponse.json({ error: 'Student not found or does not belong to your organization' }, { status: 400 });
  }

  // Insert relationship with org_id from AuthUser
  const { data: upserted, error } = await adminClient
    .from('guardian_students')
    .insert({
      guardian_id,
      student_id,
      relation,
      org_id: orgId,
    })
    .select('id,guardian_id,student_id,relation,created_at')
    .single();

  if (error) {
    console.error('❌ Failed to create guardian-student relationship:', error);
    return NextResponse.json({ error: `Failed to create relationship: ${error.message}` }, { status: 500 });
  }

  const relationship = upserted;

  return NextResponse.json({ 
    relationship,
    message: 'Guardian-student relationship created successfully!'
  }, { status: 201 });
}

/**
 * Handler for DELETE /api/guardian-students
 * Deletes a guardian-student relationship by id or (guardianId and studentId)
 * Only principals can delete these relationships
 */
export async function handleDeleteGuardianStudent(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  const metadata = user.user_metadata as UserMetadata;
  const orgId = metadata.org_id;
  const userId = user.id;

  const { searchParams } = new URL(request.url);
  
  const deleteGuardianStudentQuerySchema = z.object({
    id: uuidSchema.optional(),
    guardianId: userIdSchema.optional(),
    studentId: studentIdSchema.optional(),
  }).refine((data) => data.id || (data.guardianId && data.studentId), {
    message: 'id or (guardianId and studentId) is required',
  });
  
  const queryValidation = validateQuery(deleteGuardianStudentQuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.error;
  }
  
  const { id, guardianId, studentId } = queryValidation.data;

  let deleteQuery = adminClient
    .from('guardian_students')
    .delete()
    .eq('org_id', orgId);

  if (id) {
    deleteQuery = deleteQuery.eq('id', id);
  } else {
    deleteQuery = deleteQuery.eq('guardian_id', guardianId).eq('student_id', studentId);
  }

  const { error } = await deleteQuery;

  if (error) {
    console.error('❌ Failed to delete guardian-student relationship:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    message: 'Guardian-student relationship deleted successfully!'
  }, { status: 200 });
}

