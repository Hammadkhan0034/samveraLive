import { withAuthRoute } from '@/lib/server-helpers';
import { handleAssignStudentsClass } from '@/lib/handlers/assign_students_class_handler';

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handleAssignStudentsClass(request, user, adminClient),
  );
}
