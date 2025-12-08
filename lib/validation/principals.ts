import { z } from 'zod';
import { orgIdSchema } from '@/lib/validation';

/**
 * GET principals query parameter schema
 */
export const getPrincipalsQuerySchema = z.object({
  orgId: orgIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
