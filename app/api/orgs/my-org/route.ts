import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetMyOrg, handleUpdateMyOrg } from '@/lib/handlers/orgs_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (user, adminClient) => handleGetMyOrg(request, user, adminClient)
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal'],
    },
    (user, adminClient) => handleUpdateMyOrg(request, user, adminClient)
  );
}
