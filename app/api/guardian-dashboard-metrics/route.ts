import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetGuardianDashboardMetrics } from '@/lib/handlers/guardian_dashboard_metrics_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['guardian', 'parent', 'admin'],
    },
    (user, adminClient) => handleGetGuardianDashboardMetrics(request, user, adminClient)
  );
}
