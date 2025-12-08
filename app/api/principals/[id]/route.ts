import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetPrincipalDetails } from '@/lib/handlers/principals_handler';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: ['admin'],
    },
    (user, adminClient) => handleGetPrincipalDetails(request, user, adminClient, id)
  );
}
