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
});

/**
 * PUT org body schema
 */
export const putOrgBodySchema = z.object({
  id: orgIdSchema,
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  email: z.string().email().max(255).min(1, 'Email is required').optional(),
  phone: z.string().min(1, 'Phone is required').max(50).optional(),
  website: optionalUrl(), // Only website is optional
  address: z.string().min(1, 'Address is required').max(500).optional(),
  city: z.string().min(1, 'City is required').max(100).optional(),
  state: z.string().min(1, 'State is required').max(100).optional(),
  postal_code: z.string().min(1, 'Postal code is required').max(20).optional(),
  timezone: z.string().min(1, 'Timezone is required').optional(),
});

/**
 * DELETE org query parameter schema
 */
export const deleteOrgQuerySchema = z.object({
  id: orgIdSchema,
});

