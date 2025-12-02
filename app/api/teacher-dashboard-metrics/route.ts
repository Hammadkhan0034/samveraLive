import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetTeacherDashboardMetrics } from '@/lib/handlers/teacher_dashboard_metrics_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['teacher', 'principal', 'admin', 'guardian'],
    },
    (user, adminClient) => handleGetTeacherDashboardMetrics(request, user, adminClient)
  );
}

