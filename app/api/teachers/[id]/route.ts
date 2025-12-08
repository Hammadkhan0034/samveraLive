import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetTeacherDetails } from '@/lib/handlers/teachers_handler';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handleGetTeacherDetails(request, user, adminClient, id)
  );
}
