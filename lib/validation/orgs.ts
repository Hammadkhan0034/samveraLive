import { z } from 'zod';
import { orgIdSchema } from '@/lib/validation';

/**
 * GET orgs query parameter schema
 */
export const getOrgsQuerySchema = z.object({
  ids: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

/**
 * Helper to preprocess empty strings to undefined for optional fields
 */
const optionalString = (maxLength?: number) => {
  let baseSchema = z.string();
  if (maxLength) {
    baseSchema = baseSchema.max(maxLength);
  }
  return z.preprocess(
    (val) => (val === '' ? undefined : val),
    baseSchema.optional()
  );
};

/**
 * Optional email field that accepts empty strings
 */
const optionalEmail = () => {
  return z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().email().max(255).optional()
  );
};

/**
 * Optional URL field that accepts empty strings
 */
const optionalUrl = () => {
  return z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url().max(255).optional()
  );
};

/**
 * POST org body schema
 */
export const postOrgBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
  email: z.string().email().max(255).min(1, 'Email is required'),
  phone: z.string().min(1, 'Phone is required').max(50),
  website: optionalUrl(), // Only website is optional
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  postal_code: z.string().min(1, 'Postal code is required').max(20),
  timezone: z.string().min(1, 'Timezone is required').default('UTC'),
  total_area: z.coerce.number().positive('Total area must be a positive number'),
  play_area: z.coerce.number().positive('Play area must be a positive number'),
  square_meters_per_student: z.coerce.number().positive('Square meters per student must be a positive number'),
  maximum_allowed_students: z.coerce.number().int().positive('Maximum allowed students must be a positive integer'),
});

/**
 * PUT org body schema
 */
export const putOrgBodySchema = z.object({
  id: orgIdSchema,
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
  email: z.string().email().max(255).min(1, 'Email is required'),
  phone: z.string().min(1, 'Phone is required').max(50),
  website: optionalUrl(), // Only website is optional
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  postal_code: z.string().min(1, 'Postal code is required').max(20),
  timezone: z.string().min(1, 'Timezone is required'),
  total_area: z.coerce.number().positive('Total area must be a positive number'),
  play_area: z.coerce.number().positive('Play area must be a positive number'),
  square_meters_per_student: z.coerce.number().positive('Square meters per student must be a positive number'),
  maximum_allowed_students: z.coerce.number().int().positive('Maximum allowed students must be a positive integer'),
});

/**
 * DELETE org query parameter schema
 */
export const deleteOrgQuerySchema = z.object({
  id: orgIdSchema,
});

/**
 * PUT my-org body schema (for principals updating their own org - no id required)
 */
export const putMyOrgBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
  email: z.string().email().max(255).min(1, 'Email is required'),
  phone: z.string().min(1, 'Phone is required').max(50),
  website: optionalUrl(), // Only website is optional
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  postal_code: z.string().min(1, 'Postal code is required').max(20),
  timezone: z.string().min(1, 'Timezone is required'),
  total_area: z.coerce.number().positive('Total area must be a positive number'),
  play_area: z.coerce.number().positive('Play area must be a positive number'),
  square_meters_per_student: z.coerce.number().positive('Square meters per student must be a positive number'),
  maximum_allowed_students: z.coerce.number().int().positive('Maximum allowed students must be a positive integer'),
});

