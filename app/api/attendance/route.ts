import { withAuthRoute } from '@/lib/server-helpers';
import {
  handleDeleteAttendance,
  handleGetAttendance,
  handlePostAttendance,
  handlePutAttendance,
} from '@/lib/handlers/attendance_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetAttendance(request, user, adminClient),
  );
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handlePostAttendance(request, user, adminClient),
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: false,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handlePutAttendance(request, user, adminClient),
  );
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleDeleteAttendance(request, user, adminClient),
  );
}
