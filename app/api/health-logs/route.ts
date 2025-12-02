import { withAuthRoute } from '@/lib/server-helpers';
import {
  handleGetHealthLogs,
  handlePostHealthLog,
  handlePutHealthLog,
  handleDeleteHealthLog,
} from '@/lib/handlers/health_logs_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher', 'guardian'],
    },
    (user, adminClient) => handleGetHealthLogs(request, user, adminClient),
  );
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handlePostHealthLog(request, user, adminClient),
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handlePutHealthLog(request, user, adminClient),
  );
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handleDeleteHealthLog(request, user, adminClient),
  );
}
