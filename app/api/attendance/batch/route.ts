import { withAuthRoute } from '@/lib/server-helpers';
import { handlePostBatchAttendance } from '@/lib/handlers/attendance_handler';

/**
 * Batch endpoint for saving multiple attendance records in a single request
 * More efficient than individual POST requests
 */
export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'parent'],
    },
    (user, adminClient) =>
      handlePostBatchAttendance(request, user, adminClient),
  );
}
