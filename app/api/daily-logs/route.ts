import { withAuthRoute } from '@/lib/server-helpers';
import {
  handleDeleteDailyLog,
  handleGetDailyLogs,
  handlePostDailyLog,
  handlePutDailyLog,
} from '@/lib/handlers/daily_logs_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handleGetDailyLogs(request, user, adminClient),
  );
}

export async function POST(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handlePostDailyLog(request, user, adminClient),
  );
}

export async function PUT(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (user, adminClient) => handlePutDailyLog(request, user, adminClient),
  );
}

export async function DELETE(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin', 'teacher'],
    },
    (_user, adminClient) => handleDeleteDailyLog(request, adminClient),
  );
}

