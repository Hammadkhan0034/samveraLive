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
  addressSchema,
  ssnSchema,
  medicalNotesSchema,
  allergiesSchema,
  emergencyContactSchema,
  guardianIdsSchema,
  dateSchema,
} from '@/lib/validation';

/**
 * Required address schema for students
 */
export const requiredStudentAddressSchema = z
  .string()
  .min(1, { message: 'Address is required' })
  .max(500, { message: 'Address must be 500 characters or less' });

/**
 * Required SSN schema for students
 */
export const requiredStudentSsnSchema = z
  .string()
  .min(1, { message: 'Social Security Number is required' })
  .max(50, { message: 'SSN must be 50 characters or less' });

/**
 * GET /api/students query parameter schema
 */
export const getStudentsQuerySchema = z.object({
  classId: classIdSchema.optional(),
  id: studentIdSchema.optional(),
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
    start_date: dateSchema.nullable().optional(),
    barngildi: barngildiSchema.optional(),
    student_language: studentLanguageSchema.optional(),
    medical_notes: medicalNotesSchema,
    allergies: allergiesSchema,
    emergency_contact: emergencyContactSchema,
    address: requiredStudentAddressSchema,
    social_security_number: requiredStudentSsnSchema,
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
    start_date: dateSchema.nullable().optional(),
    barngildi: barngildiSchema.optional(),
    student_language: studentLanguageSchema.optional(),
    medical_notes: medicalNotesSchema,
    allergies: allergiesSchema,
    emergency_contact: emergencyContactSchema,
    address: requiredStudentAddressSchema,
    social_security_number: requiredStudentSsnSchema,
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
  start_date: dateSchema.nullable().optional(),
  barngildi: barngildiSchema.optional(),
  student_language: studentLanguageSchema.optional(),
  medical_notes: medicalNotesSchema,
  allergies: allergiesSchema,
  emergency_contact: emergencyContactSchema,
  address: requiredStudentAddressSchema,
  social_security_number: requiredStudentSsnSchema,
  guardian_ids: guardianIdsSchema.optional().default([]),
});

/**
 * POST /api/assign-students-class body schema
 * Assigns multiple students to a class
 */
export const assignStudentsClassBodySchema = z.object({
  classId: z.string().uuid({ message: 'Invalid class ID format' }),
  studentIds: z.array(studentIdSchema).min(1, { message: 'At least one student ID is required' }),
});

