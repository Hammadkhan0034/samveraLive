import { withAuthRoute } from '@/lib/server-helpers';
import { handleAssignTeacherClass } from '@/lib/handlers/assign_teacher_class_handler';

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['admin', 'principal'],
    },
    (user, adminClient) => handleAssignTeacherClass(request, user, adminClient),
  );
}
