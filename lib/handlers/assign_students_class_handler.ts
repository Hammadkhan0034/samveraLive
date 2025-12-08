import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  validateBody,
} from '@/lib/validation';
import { assignStudentsClassBodySchema } from '@/lib/validation/students';
import type { AuthUser } from '@/lib/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentUserOrgId } from '@/lib/server-helpers';

export async function handleAssignStudentsClass(
  request: Request,
  user: AuthUser,
  adminClient: SupabaseClient,
) {
  try {
    const body = await request.json();
    const bodyValidation = validateBody(assignStudentsClassBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { classId, studentIds } = bodyValidation.data;

    console.log('🔧 Assigning students to class:', { classId, studentCount: studentIds.length });

    // Get user's org_id
    const orgId = await getCurrentUserOrgId(user);

    // Verify class exists and belongs to user's org
    const { data: classData, error: classError } = await adminClient
      .from('classes')
      .select('id, org_id, name')
      .eq('id', classId)
      .eq('org_id', orgId)
      .single();

    if (classError || !classData) {
      console.error('❌ Error fetching class:', classError);
      return NextResponse.json(
        { error: 'Class not found or access denied' },
        { status: 404 },
      );
    }

    // Verify all students exist and belong to user's org
    const { data: studentsData, error: studentsError } = await adminClient
      .from('students')
      .select('id, org_id, class_id')
      .in('id', studentIds)
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError);
      return NextResponse.json(
        { error: 'Failed to verify students' },
        { status: 500 },
      );
    }

    if (!studentsData || studentsData.length === 0) {
      return NextResponse.json(
        { error: 'No valid students found' },
        { status: 404 },
      );
    }

    // Check if all requested students were found
    const foundStudentIds = new Set(studentsData.map((s) => s.id));
    const missingStudentIds = studentIds.filter((id) => !foundStudentIds.has(id));
    if (missingStudentIds.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some students were not found or do not belong to your organization',
          missingStudentIds,
        },
        { status: 404 },
      );
    }

    // Update all students' class_id in a single batch operation
    const { data: updatedStudents, error: updateError } = await adminClient
      .from('students')
      .update({
        class_id: classId,
        updated_at: new Date().toISOString(),
      })
      .in('id', studentIds)
      .eq('org_id', orgId)
      .select('id, class_id');

    if (updateError) {
      console.error('❌ Error updating students:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign students to class' },
        { status: 500 },
      );
    }

    console.log('✅ Students assigned to class successfully:', {
      classId,
      className: classData.name,
      assignedCount: updatedStudents?.length || 0,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${updatedStudents?.length || 0} student(s) to class`,
      classId,
      className: classData.name,
      assignedCount: updatedStudents?.length || 0,
      studentIds: updatedStudents?.map((s) => s.id) || [],
    });
  } catch (error) {
    console.error('💥 Error in assign-students-class handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
