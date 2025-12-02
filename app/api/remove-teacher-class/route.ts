import { withAuthRoute } from '@/lib/server-helpers';
import { handleRemoveTeacherClass } from '@/lib/handlers/remove_teacher_class_handler';

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handleRemoveTeacherClass(request, user, adminClient)
  );
}

