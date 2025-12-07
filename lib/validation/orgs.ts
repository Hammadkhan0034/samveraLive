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
 * POST org body schema
 */
export const postOrgBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }),
  timezone: z.string().default('UTC'),
});

/**
 * PUT org body schema
 */
export const putOrgBodySchema = z.object({
  id: orgIdSchema,
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  timezone: z.string().optional(),
});

/**
 * DELETE org query parameter schema
 */
export const deleteOrgQuerySchema = z.object({
  id: orgIdSchema,
});

