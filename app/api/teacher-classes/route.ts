import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetTeacherClasses } from '@/lib/handlers/teacher_classes_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['teacher', 'principal', 'admin'],
    },
    (user, adminClient) => handleGetTeacherClasses(request, user, adminClient)
  );
}
