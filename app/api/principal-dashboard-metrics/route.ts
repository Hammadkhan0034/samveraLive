import { withAuthRoute } from '@/lib/server-helpers';
import { handleGetPrincipalDashboardMetrics } from '@/lib/handlers/principal_dashboard_metrics_handler';

export async function GET(request: Request) {
  return withAuthRoute(
    request,
    {
      requireOrg: true,
      allowedRoles: ['principal', 'admin'],
    },
    (user, adminClient) => handleGetPrincipalDashboardMetrics(request, user, adminClient)
  );
}

