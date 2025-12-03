import { z } from 'zod';

import {
  firstNameSchema,
  lastNameSchema,
  emailSchema,
  roleSchema,
  phoneSchema,
  addressSchema,
  ssnSchema,
  classIdSchema,
  userIdSchema,
} from '@/lib/validation';

/**
 * Phone validation schema for staff (E.164-like format: 7-15 digits, optional +)
 * More strict than the general phoneSchema
 * Accepts empty string, null, or valid phone format
 */
export const staffPhoneSchema = z
  .union([
    z.literal(''),
    z.string().regex(/^\+?[1-9]\d{6,14}$/, {
      message: 'Phone number must be 7-15 digits, optionally starting with +',
    }),
  ])
  .nullable()
  .optional();

/**
 * Education level schema
 */
export const educationLevelSchema = z.string().max(100).nullable().optional();

/**
 * Union membership schema
 * Accepts boolean (transforms to 'Yes' or null), string, or null
 */
export const unionMembershipSchema = z
  .union([
    z.boolean().transform((val) => (val ? 'Yes' : null)),
    z.string().max(100),
    z.null(),
  ])
  .optional();

/**
 * Schema for creating a new staff member (POST)
 */
export const createStaffSchema = z.object({
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  email: emailSchema,
  role: roleSchema,
  phone: phoneSchema,
  class_id: classIdSchema.optional(),
  address: addressSchema,
  ssn: ssnSchema,
  education_level: educationLevelSchema,
  union_membership: unionMembershipSchema,
});

/**
 * Schema for updating an existing staff member (PUT)
 */
export const updateStaffSchema = z.object({
  id: userIdSchema,
  first_name: firstNameSchema.optional(),
  last_name: lastNameSchema,
  email: emailSchema.optional(),
  role: roleSchema.optional(),
  phone: phoneSchema,
  address: addressSchema,
  ssn: ssnSchema,
  is_active: z.boolean().optional(),
  class_id: classIdSchema.optional(),
  education_level: educationLevelSchema,
  union_membership: unionMembershipSchema,
});

/**
 * Schema for deleting a staff member (DELETE query)
 */
export const deleteStaffQuerySchema = z.object({
  id: userIdSchema,
});

/**
 * Client-side form validation schema for staff form
 * This is used in the CreateStaffModal component
 */
export const staffFormSchema = z.object({
  id: userIdSchema.optional(),
  first_name: firstNameSchema,
  last_name: lastNameSchema.or(z.literal('')),
  email: emailSchema,
  phone: staffPhoneSchema,
  address: addressSchema.or(z.literal('')),
  ssn: ssnSchema.or(z.literal('')),
  education_level: educationLevelSchema.or(z.literal('')),
  union_membership: z.string().max(100).or(z.literal('')),
  class_id: classIdSchema.or(z.literal('')),
  role: roleSchema,
  is_active: z.boolean().optional(),
});

/**
 * Type exports
 */
export type CreateStaffBody = z.infer<typeof createStaffSchema>;
export type UpdateStaffBody = z.infer<typeof updateStaffSchema>;
export type DeleteStaffQueryParams = z.infer<typeof deleteStaffQuerySchema>;
export type StaffFormInput = z.infer<typeof staffFormSchema>;

