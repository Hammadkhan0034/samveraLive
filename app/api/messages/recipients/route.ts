import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetRecipients } from '@/lib/handlers/messages_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent', 'guardian'],
    },
    (user, adminClient) => handleGetRecipients(request, user, adminClient)
  );
}

