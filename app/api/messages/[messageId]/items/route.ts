import { z } from 'zod';
import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetMessageItems, handlePostMessageItem } from '@/lib/handlers/messages_handler';
import { validateParams, uuidSchema } from '@/lib/validation';

// Path parameter schema
const messageIdParamsSchema = z.object({
  messageId: uuidSchema,
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const rawParams = await params;
  const paramsValidation = validateParams(messageIdParamsSchema, rawParams);
  if (!paramsValidation.success) {
    return paramsValidation.error;
  }
  const { messageId } = paramsValidation.data;

  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetMessageItems(request, user, adminClient, messageId)
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const rawParams = await params;
  const paramsValidation = validateParams(messageIdParamsSchema, rawParams);
  if (!paramsValidation.success) {
    return paramsValidation.error;
  }
  const { messageId } = paramsValidation.data;

  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handlePostMessageItem(request, user, adminClient, messageId)
  );
}

