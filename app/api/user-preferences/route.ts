import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetUserPreferences } from '@/lib/handlers/user_preferences_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
    },
    (user, adminClient) => handleGetUserPreferences(request, user, adminClient)
  );
}

