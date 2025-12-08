import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetOrgDetails } from '@/lib/handlers/orgs_handler';

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
    (user, adminClient) => handleGetOrgDetails(request, user, adminClient, id)
  );
}
