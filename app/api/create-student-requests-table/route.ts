import { withAuthRoute } from '@/lib/server-helpers';
import { handlePostStudentRequestsTable } from '@/lib/handlers/student_requests_handler';

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: ['admin'],
    },
    (user, adminClient) => handlePostStudentRequestsTable(request, user, adminClient)
  );
}