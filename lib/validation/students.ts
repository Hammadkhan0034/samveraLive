import { z } from 'zod';
import {
  classIdSchema,
  studentIdSchema,
  firstNameSchema,
  lastNameSchema,
  studentDobSchema,
  genderSchema,
  studentLanguageSchema,
  barngildiSchema,
  phoneSchema,
  addressSchema,
  ssnSchema,
  medicalNotesSchema,
  allergiesSchema,
  emergencyContactSchema,
  guardianIdsSchema,
  dateSchema,
} from '@/lib/validation';

/**
 * GET /api/students query parameter schema
 */
export const getStudentsQuerySchema = z.object({
  classId: classIdSchema.optional(),
});

/**
 * GET /api/search-students query parameter schema
 */
export const searchStudentsQuerySchema = z.object({
  q: z.string().default(''),
});

/**
 * POST /api/students body schema with date transformations
 */
export const postStudentBodySchema = z
  .object({
    first_name: firstNameSchema,
    last_name: lastNameSchema,
    dob: studentDobSchema.nullable().optional(),
    gender: genderSchema.optional(),
    class_id: classIdSchema.optional(),
    registration_time: z.string().nullable().optional(),
    start_date: dateSchema.nullable().optional(),
    barngildi: barngildiSchema.optional(),
    student_language: studentLanguageSchema.optional(),
    medical_notes: medicalNotesSchema,
    allergies: allergiesSchema,
    emergency_contact: emergencyContactSchema,
    address: addressSchema,
    social_security_number: ssnSchema,
    guardian_ids: guardianIdsSchema.optional().default([]),
  })
  .transform((data) => {
    // Transform dates to ISO format strings
    let validatedDob = null;
    if (data.dob) {
      const birthDate = new Date(data.dob);
      validatedDob = birthDate.toISOString().split('T')[0];
    }

    let validatedStartDate = null;
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      validatedStartDate = startDate.toISOString().split('T')[0];
    }

    return {
      ...data,
      dob: validatedDob,
      start_date: validatedStartDate,
    };
  });

/**
 * PUT /api/students body schema with date transformations
 */
export const putStudentBodySchema = z
  .object({
    id: studentIdSchema,
    first_name: firstNameSchema,
    last_name: lastNameSchema,
    dob: studentDobSchema.nullable().optional(),
    gender: genderSchema.optional(),
    class_id: classIdSchema.optional(),
    registration_time: z.string().nullable().optional(),
    start_date: dateSchema.nullable().optional(),
    barngildi: barngildiSchema.optional(),
    student_language: studentLanguageSchema.optional(),
    medical_notes: medicalNotesSchema,
    allergies: allergiesSchema,
    emergency_contact: emergencyContactSchema,
    address: addressSchema,
    social_security_number: ssnSchema,
    guardian_ids: guardianIdsSchema.optional().default([]),
  })
  .transform((data) => {
    // Transform dates to ISO format strings
    let validatedDob = null;
    if (data.dob) {
      const birthDate = new Date(data.dob);
      validatedDob = birthDate.toISOString().split('T')[0];
    }

    let validatedStartDate = null;
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      validatedStartDate = startDate.toISOString().split('T')[0];
    }

    return {
      ...data,
      dob: validatedDob,
      start_date: validatedStartDate,
    };
  });

/**
 * DELETE /api/students query parameter schema
 */
export const deleteStudentQuerySchema = z.object({
  id: studentIdSchema,
});

/**
 * Student form data schema for client-side validation
 * Used in StudentForm component before submission
 */
export const studentFormDataSchema = z.object({
  id: studentIdSchema.optional(),
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  dob: studentDobSchema.nullable().optional(),
  gender: genderSchema.optional(),
  class_id: classIdSchema.optional(),
  registration_time: z.string().nullable().optional(),
  start_date: dateSchema.nullable().optional(),
  barngildi: barngildiSchema.optional(),
  student_language: studentLanguageSchema.optional(),
  medical_notes: medicalNotesSchema,
  allergies: allergiesSchema,
  emergency_contact: emergencyContactSchema,
  address: addressSchema,
  social_security_number: ssnSchema,
  guardian_ids: guardianIdsSchema.optional().default([]),
});

