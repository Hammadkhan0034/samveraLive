import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserDataCacheHeaders } from '@/lib/cacheConfig';
import { z } from 'zod';
import { validateQuery, validateBody, orgIdSchema, classIdSchema, userIdSchema, uuidSchema, firstNameSchema, lastNameSchema, studentDobSchema, genderSchema, studentLanguageSchema, barngildiSchema, dateSchema, notesSchema, phoneSchema, addressSchema, ssnSchema } from '@/lib/validation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// GET - Fetch student requests for a class or organization
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // GET query parameter schema
    const getStudentRequestsQuerySchema = z.object({
      classId: classIdSchema.optional(),
      classIds: z.string().optional(), // comma-separated
      orgId: orgIdSchema,
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
    });
    
    const queryValidation = validateQuery(getStudentRequestsQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { classId, classIds, orgId, status } = queryValidation.data;

    // First fetch student requests
    // Select all available columns (barngildi, ssn, address might not exist)
    let query = supabaseAdmin
      .from('student_requests')
      .select('*')
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

    const { data: requests, error } = await query;

    if (error) {
      console.error('Error fetching student requests:', error);
      return NextResponse.json({ error: 'Failed to fetch student requests' }, { status: 500 });
    }

    // Fetch related users and classes
    const transformedData = await Promise.all((requests || []).map(async (request: any) => {
      // Fetch requested_by user
      let requestedByUser = null;
      if (request.requested_by) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id, first_name, last_name, email')
          .eq('id', request.requested_by)
          .single();
        requestedByUser = userData;
      }

      // Fetch class
      let requestClass = null;
      let className = null;
      if (request.class_id) {
        const { data: classData } = await supabaseAdmin
          .from('classes')
          .select('id, name')
          .eq('id', request.class_id)
          .single();
        requestClass = classData;
        className = classData?.name || null;
      }

      return {
        ...request,
        requested_by_user: requestedByUser,
        classes: requestClass,
        class_name: className
      };
    }));

    return NextResponse.json({ student_requests: transformedData }, {
      headers: getUserDataCacheHeaders()
    });
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
    
    // POST body schema
    const postStudentRequestBodySchema = z.object({
      first_name: firstNameSchema,
      last_name: lastNameSchema.optional(),
      dob: studentDobSchema.nullable().optional(),
      gender: genderSchema.optional(),
      class_id: classIdSchema,
      org_id: orgIdSchema,
      requested_by: userIdSchema,
      medical_notes: notesSchema,
      allergies: notesSchema,
      emergency_contact: notesSchema,
      guardian_ids: z.array(userIdSchema).optional(),
      barngildi: barngildiSchema.optional(),
      ssn: ssnSchema,
      address: addressSchema,
      phone: phoneSchema,
      registration_time: z.string().nullable().optional(),
      start_date: dateSchema.nullable().optional(),
    });
    
    const bodyValidation = validateBody(postStudentRequestBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
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
      emergency_contact,
      guardian_ids,
      barngildi,
      ssn,
      address,
      phone,
      registration_time,
      start_date
    } = bodyValidation.data;

    console.log('🔍 Validating fields:', { first_name, class_id, org_id, requested_by });

    // Verify org_id exists in orgs table
    const { data: orgExists, error: orgError } = await supabaseAdmin
      .from('orgs')
      .select('id')
      .eq('id', org_id)
      .single();

    if (orgError || !orgExists) {
      console.error('❌ Invalid org_id:', org_id, orgError);
      return NextResponse.json({ 
        error: `Invalid organization ID. Please ensure you are using a valid organization.` 
      }, { status: 400 });
    }

    // Normalize gender to lowercase to match enum
    const normalizedGender = (gender || 'unknown').toString().toLowerCase();

    const extraData = {
      barngildi: barngildi || 0.5,
      ssn: ssn || null,
      address: address || null,
      phone: phone || null,
      registration_time: registration_time || null,
      start_date: start_date || null,
      guardian_ids: guardian_ids || []
    };
    
    // Store extra data - use emergency_contact if empty, otherwise append to medical_notes
    const insertData: any = {
      first_name,
      last_name,
      dob,
      gender: normalizedGender,
      class_id,
      org_id,
      requested_by,
      status: 'pending',
      medical_notes: medical_notes || '',
      allergies,
      emergency_contact: emergency_contact || '',
      created_at: new Date().toISOString()
    };
    
    // Store extra data in emergency_contact as JSON (always use emergency_contact for extra data)
    // Keep medical_notes clean without EXTRA_DATA
    insertData.emergency_contact = JSON.stringify({ 
      _original: emergency_contact || '', 
      _extra: extraData 
    });
    
    // Keep medical_notes clean (remove any existing EXTRA_DATA)
    let cleanMedicalNotes = medical_notes || '';
    if (cleanMedicalNotes) {
      cleanMedicalNotes = cleanMedicalNotes.replace(/\n?<!--EXTRA_DATA:.*?-->/g, '').trim();
    }
    insertData.medical_notes = cleanMedicalNotes;


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
    // PUT body schema
    const putStudentRequestBodySchema = z.object({
      id: uuidSchema,
      status: z.enum(['pending', 'approved', 'rejected']),
      approved_by: userIdSchema.optional(),
      rejected_by: userIdSchema.optional(),
      barngildi: barngildiSchema.optional(),
      ssn: ssnSchema,
      address: addressSchema,
      phone: phoneSchema,
      registration_time: z.string().nullable().optional(),
      start_date: dateSchema.nullable().optional(),
      class_id: classIdSchema.optional(),
    });
    
    const bodyValidation = validateBody(putStudentRequestBodySchema, body);
    if (!bodyValidation.success) {
      return bodyValidation.error;
    }
    const { id, status, approved_by, rejected_by, barngildi, ssn, address, phone, registration_time, start_date, class_id } = bodyValidation.data;

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

    // If approved, create the actual student record properly (users + students tables)
    if (status === 'approved') {
      try {
        // Validate Supabase configuration
        if (!supabaseUrl || !supabaseKey) {
          console.error('❌ Supabase configuration missing:', { 
            hasUrl: !!supabaseUrl, 
            hasKey: !!supabaseKey 
          });
          return NextResponse.json({ 
            error: 'Supabase configuration is missing. Please check your environment variables.' 
          }, { status: 500 });
        }

        // Validate URL format
        try {
          new URL(supabaseUrl);
        } catch (urlError) {
          console.error('❌ Invalid Supabase URL format:', supabaseUrl);
          return NextResponse.json({ 
            error: `Invalid Supabase URL format: ${supabaseUrl}` 
          }, { status: 500 });
        }

        // Normalize gender
        const normalizedGender = (data.gender || 'unknown').toString().toLowerCase();
        
        // Validate and format DOB
        let validatedDob = null;
        if (data.dob) {
          const birthDate = new Date(data.dob);
          if (!isNaN(birthDate.getTime())) {
            validatedDob = birthDate.toISOString().split('T')[0];
          }
        }

        // Get extra data stored in emergency_contact
        let extraData: any = {};
        let originalEmergencyContact = '';
        try {
          // Get extra data from emergency_contact (JSON format)
          if (data.emergency_contact) {
            const parsed = JSON.parse(data.emergency_contact);
            if (parsed._extra) {
              extraData = parsed._extra;
            }
            if (parsed._original) {
              originalEmergencyContact = parsed._original;
            }
          }
          // Legacy support: If not found, try from medical_notes (old format)
          if (!extraData.guardian_ids && data.medical_notes) {
            const match = data.medical_notes.match(/<!--EXTRA_DATA:(.+?)-->/);
            if (match) {
              extraData = JSON.parse(match[1]);
            }
          }
        } catch (e) {
          console.error('Error parsing extra data:', e);
        }
        
        // Get guardian_ids from extra data
        let guardianIdsFromRequest: string[] = [];
        if (extraData.guardian_ids && Array.isArray(extraData.guardian_ids)) {
          guardianIdsFromRequest = extraData.guardian_ids;
        }
        
        console.log('📋 Extra data extracted:', {
          extraData,
          guardianIdsFromRequest,
          guardianIdsCount: guardianIdsFromRequest.length
        });
        
        // Get SSN, Address, Phone, registration_time, start_date from:
        // 1. First try from PUT request body (if principal provides in approval form)
        // 2. Otherwise from extraData (stored when teacher submitted)
        // 3. Otherwise from request metadata if it exists (fallback)
        // 4. Otherwise use null/defaults
        let requestMetadata: any = extraData; // Use extraData as primary source
        try {
          // Fallback to metadata if available
          if (data.metadata && typeof data.metadata === 'object') {
            requestMetadata = { ...requestMetadata, ...data.metadata };
          } else if (data.metadata && typeof data.metadata === 'string') {
            const parsedMeta = JSON.parse(data.metadata);
            requestMetadata = { ...requestMetadata, ...parsedMeta };
          }
        } catch (e) {
          // metadata doesn't exist or is invalid, use extraData only
        }
        
        const finalSsn = (ssn !== undefined && ssn !== null && ssn !== '') 
          ? ssn 
          : (requestMetadata.ssn || null);
        const finalAddress = (address !== undefined && address !== null && address !== '') 
          ? address 
          : (requestMetadata.address || null);
        const finalPhone = (phone !== undefined && phone !== null && phone !== '') 
          ? phone 
          : (requestMetadata.phone || null);
        const finalRegistrationTime = (registration_time !== undefined && registration_time !== null && registration_time !== '') 
          ? registration_time 
          : (requestMetadata.registration_time || null);
        const finalStartDate = (start_date !== undefined && start_date !== null && start_date !== '') 
          ? start_date 
          : (requestMetadata.start_date || null);
        
        // Use class_id from approval form if provided, otherwise use from request
        const finalClassId = (class_id !== undefined && class_id !== null && class_id !== '') ? class_id : data.class_id;
        
        // First create a user record for the student
        let createdUser, userError;
        try {
          const result = await supabaseAdmin
            .from('users')
            .insert({
              first_name: data.first_name,
              last_name: data.last_name || null,
              dob: validatedDob,
              gender: normalizedGender,
              phone: finalPhone,
              address: finalAddress,
              ssn: finalSsn,
              role: 'student' as any,
              org_id: data.org_id,
              is_active: true,
            })
            .select('id')
            .single();
          
          createdUser = result.data;
          userError = result.error;
        } catch (networkError: any) {
          console.error('❌ Network error creating student user:', networkError);
          console.error('❌ Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
          console.error('❌ Error details:', {
            message: networkError?.message,
            cause: networkError?.cause,
            stack: networkError?.stack
          });
          return NextResponse.json({ 
            error: `Network error: Failed to connect to Supabase. Please check your connection and Supabase configuration.`,
            details: networkError?.message || 'Unknown network error'
          }, { status: 500 });
        }

        if (userError) {
          console.error('❌ Failed to create student user:', userError);
          console.error('❌ Error details:', {
            message: userError.message,
            details: userError.details,
            hint: userError.hint,
            code: userError.code
          });
          return NextResponse.json({ 
            error: `Failed to create student user: ${userError.message}`,
            details: userError.details || '',
            hint: userError.hint || ''
          }, { status: 500 });
        }

        const userId = createdUser?.id;

        // Validate and normalize barngildi (child_value)
        const isEmptyString = (value: unknown): boolean =>
          typeof value === 'string' && value.trim() === '';

        // Get from PUT request body first, otherwise from request metadata, otherwise default to 0.5
        const hasBarngildiInBody =
          barngildi !== undefined &&
          barngildi !== null &&
          !(
            isEmptyString(barngildi) ||
            (typeof barngildi === 'number' && barngildi === 0)
          );

        const barngildiFromRequest = hasBarngildiInBody
          ? barngildi
          : (requestMetadata.barngildi !== undefined ? requestMetadata.barngildi : 0.5);
        
        let validatedBarngildi = 0.5; // Default value
        const hasBarngildiValue =
          barngildiFromRequest !== undefined &&
          barngildiFromRequest !== null &&
          !(
            isEmptyString(barngildiFromRequest) ||
            (typeof barngildiFromRequest === 'number' && barngildiFromRequest === 0)
          );

        if (hasBarngildiValue) {
          const barngildiValue =
            typeof barngildiFromRequest === 'string'
              ? parseFloat(barngildiFromRequest)
              : barngildiFromRequest;
          if (!isNaN(barngildiValue) && barngildiValue >= 0.5 && barngildiValue <= 1.9) {
            validatedBarngildi = Math.round(barngildiValue * 10) / 10; // Round to 1 decimal place
          }
        }
        console.log('📊 Barngildi validation:', { barngildi, requestMetadata, validatedBarngildi });

        // Validate and format registration_time
        let validatedRegistrationTime = null;
        if (finalRegistrationTime) {
          // If it's in YYYY-MM-DD HH:MM format, keep as is, otherwise try to parse
          validatedRegistrationTime = finalRegistrationTime;
        }

        // Validate and format start_date
        let validatedStartDate = null;
        if (finalStartDate) {
          const startDate = new Date(finalStartDate);
          if (!isNaN(startDate.getTime())) {
            validatedStartDate = startDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          }
        }

        // Clean medical_notes to remove any EXTRA_DATA comments before storing
        let cleanMedicalNotes = data.medical_notes || '';
        if (cleanMedicalNotes) {
          cleanMedicalNotes = cleanMedicalNotes.replace(/\n?<!--EXTRA_DATA:.*?-->/g, '').trim();
        }
        
        // Create student record with proper column mapping
        const { data: studentData, error: studentError } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: userId,
            class_id: finalClassId,
            org_id: data.org_id,
            registration_time: validatedRegistrationTime, // Save in registration_time column
            start_date: validatedStartDate, // Save in start_date column
            barngildi: validatedBarngildi, // Save in barngildi column
            student_language: 'english',
            medical_notes_encrypted: cleanMedicalNotes || null, // Clean medical notes without EXTRA_DATA
            allergies_encrypted: data.allergies || null,
            emergency_contact_encrypted: originalEmergencyContact || null, // Use original emergency contact, not JSON
          })
          .select('id,user_id,class_id,created_at')
          .single();

        if (studentError) {
          console.error('❌ Failed to create student:', studentError);
          return NextResponse.json({ 
            error: `Failed to create student: ${studentError.message}` 
          }, { status: 500 });
        }

        console.log('✅ Student created successfully after approval:', studentData);

        // Linking guardians to student after approval is deprecated; use /api/guardian-students via UI

        return NextResponse.json({ 
          student_request: data, 
          student: studentData,
          message: 'Student request approved and student created successfully'
        });
      } catch (createError: any) {
        console.error('❌ Error creating student:', createError);
        return NextResponse.json({ 
          error: `Failed to create student: ${createError.message}` 
        }, { status: 500 });
      }
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
    // DELETE query parameter schema
    const deleteStudentRequestQuerySchema = z.object({
      id: uuidSchema,
    });
    
    const queryValidation = validateQuery(deleteStudentRequestQuerySchema, searchParams);
    if (!queryValidation.success) {
      return queryValidation.error;
    }
    const { id } = queryValidation.data;

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
